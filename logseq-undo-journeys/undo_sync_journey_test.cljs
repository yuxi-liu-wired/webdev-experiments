(ns frontend.worker.undo-sync-journey-test
  "Box-local. Undo journeys through the sync code. Alice's client is the
  worker conn; Bob's client and the server share `server-conn`. Bob's op
  runs on `server-conn`; its normalized tx reaches Alice through
  `apply-remote-tx!`; Alice's pending rows reach the server through
  `apply-tx-entry!`.
  :online  Alice's op is uploaded, Bob's op lands, Alice presses Ctrl+Z,
           the undo is uploaded.
  :offline Alice does the op and presses Ctrl+Z, both pending; Bob's op
           lands (rebase); Alice's rows are uploaded.
  :semantic undoes through the worker, :raw transacts the stored reversed
  datoms. Prints SYNCJ lines; asserts nothing."
  (:require [cljs.test :refer [deftest is]]
            [datascript.core :as d]
            [frontend.worker.a-test-env]
            [frontend.worker.pipeline :as worker-pipeline]
            [frontend.worker.state :as worker-state]
            [frontend.worker.sync :as db-sync]
            [frontend.worker.sync.apply-txs :as sync-apply]
            [frontend.worker.sync.client-op :as client-op]
            [frontend.worker.undo-redo :as worker-undo-redo]
            [logseq.db :as ldb]
            [logseq.db-sync.checksum :as sync-checksum]
            [logseq.db-sync.worker.handler.sync :as sync-handler]
            [logseq.db.common.normalize :as db-normalize]
            [logseq.db.sqlite.util :as sqlite-util]
            [logseq.db.test.helper :as db-test]
            [logseq.outliner.op :as outliner-op]))

(def ^:private repo "test-undo-sync-journey")

(defn- new-client-ops-db []
  (let [Database (js/require "better-sqlite3")
        db (new Database ":memory:")]
    (client-op/ensure-sqlite-schema! db)
    db))

(defn- initial-graph []
  (db-test/create-conn-with-blocks
   {:pages-and-blocks
    [{:page {:block/title "Groceries"}
      :blocks [{:block/title "apples"}
               {:block/title "bread"}
               {:block/title "milk"}
               {:block/title "Fruit"
                :build/children [{:block/title "pear"}
                                 {:block/title "plum"}]}]}
     {:page {:block/title "Notes"}
      :blocks [{:block/title "call mom"}]}]}))

(defn- with-worker [f]
  (let [ds-prev @worker-state/*datascript-conns
        co-prev @worker-state/*client-ops-conns
        ah-prev @worker-undo-redo/*apply-history-action!
        pipeline-prev @ldb/*transact-pipeline-fn
        conn (initial-graph)
        server-conn (d/conn-from-db @conn)
        co (new-client-ops-db)]
    (ldb/register-transact-pipeline-fn! worker-pipeline/transact-pipeline)
    (swap! client-op/*repo->pending-local-tx-count dissoc repo)
    (reset! worker-state/*datascript-conns {repo conn})
    (reset! worker-state/*client-ops-conns {repo co})
    (reset! worker-undo-redo/*apply-history-action! sync-apply/apply-history-action!)
    (when (nil? (client-op/get-local-tx repo))
      (client-op/update-local-tx repo 0))
    (d/listen! conn ::journey (fn [tx-report] (db-sync/enqueue-local-tx! repo tx-report)))
    (worker-undo-redo/clear-history! repo)
    (try
      (f conn server-conn)
      (finally
        (d/unlisten! conn ::journey)
        (worker-undo-redo/clear-history! repo)
        (swap! client-op/*repo->pending-local-tx-count dissoc repo)
        (.close co)
        (reset! ldb/*transact-pipeline-fn pipeline-prev)
        (reset! worker-undo-redo/*apply-history-action! ah-prev)
        (reset! worker-state/*datascript-conns ds-prev)
        (reset! worker-state/*client-ops-conns co-prev)))))

(defn- by-title [db title]
  (d/entity db (d/q '[:find ?e . :in $ ?t :where [?e :block/title ?t]] db title)))
(defn- u [db title] (:block/uuid (by-title db title)))

(defn- children [db e]
  (->> (d/q '[:find [?c ...] :in $ ?p :where [?c :block/parent ?p]] db e)
       (map #(d/entity db %))
       (sort-by :block/order)))

(defn- outline [db e]
  (vec (for [c (children db e)]
         (let [kids (children db (:db/id c))]
           (if (seq kids)
             [(:block/title c) (outline db (:db/id c))]
             (:block/title c))))))

(defn- view [db]
  (let [g (by-title db "Groceries")
        n (by-title db "Notes")]
    {:groceries (when g (outline db (:db/id g)))
     :notes (when n (outline db (:db/id n)))}))

(defn- depth [] (count (:undo-ops (worker-undo-redo/get-debug-state repo))))

(defn- attempt [f]
  (try (let [r (f)]
         (cond (and (some? r) (fn? (.-then r))) :PROMISE
               (keyword? r) r
               (map? r) (select-keys r [:undo?])
               :else :ok))
       (catch :default e {:threw (subs (str (ex-message e)) 0 100)})))

(defn- alice! [conn ops]
  (outliner-op/apply-ops! conn ops {:local-tx? true :db-sync/tx-id (random-uuid) :client-id "alice"})
  (:db-sync/tx-id (second (some #(when (= :frontend.worker.undo-redo/db-transact (first %)) %)
                                (last (:undo-ops (worker-undo-redo/get-debug-state repo)))))))

(defn- raw-undo! [conn tx-id]
  (let [reversed (:reversed-tx (client-op/get-local-tx-entry repo tx-id))
        tx-data (->> reversed
                     (mapv (fn [item]
                             (if (and (vector? item) (= 5 (count item)))
                               (let [[op e a v _t] item] [op e a v])
                               item)))
                     db-normalize/reorder-retract-entity)]
    (d/transact! conn tx-data {:local-tx? true :gen-undo-ops? false :undo? true :outliner-op :undo})
    {:undo? true}))

(defn- ctrl-z! [conn mode tx-id]
  (attempt (if (= mode :semantic)
             #(worker-undo-redo/undo repo)
             #(raw-undo! conn tx-id))))

(defn- upload! [conn server-conn]
  (let [{:keys [tx-entries drop-tx-ids]}
        (sync-apply/prepare-upload-tx-entries conn (sync-apply/pending-txs repo))
        results (mapv (fn [{:keys [tx-data outliner-op]}]
                        (attempt #(#'sync-handler/apply-tx-entry!
                                   server-conn {:tx (sqlite-util/write-transit-str tx-data)
                                                :outliner-op outliner-op})))
                      tx-entries)]
    (sync-apply/mark-pending-txs-false! repo (into drop-tx-ids (map :tx-id tx-entries)))
    {:rows (count tx-entries) :results (vec (distinct results))}))

(defn- bob! [server-conn ops-fn]
  (let [report (atom nil)]
    (d/listen! server-conn ::bob #(reset! report %))
    (try
      (outliner-op/apply-ops! server-conn (ops-fn @server-conn) {:local-tx? true :client-id "bob"})
      (finally (d/unlisten! server-conn ::bob)))
    (:normalized-tx-data (sync-apply/normalize-rebased-pending-tx @report))))

(defn- last-top [db]
  (:block/uuid (last (children db (:db/id (by-title db "Groceries"))))))

;; Each :alice / :bob fn takes the db it runs on and `id`, title -> uuid of
;; the initial graph (both clients share the uuids).
(def ^:private journeys
  [{:name "1 move milk to the end / Bob deletes bread"
    :alice (fn [_ id] [[:move-blocks [[(id "milk")] (id "Fruit") {:sibling? true}]]])
    :bob (fn [_ id] [[:delete-blocks [[(id "bread")] {}]]])}
   {:name "2 move milk to the end / Bob renames milk"
    :alice (fn [_ id] [[:move-blocks [[(id "milk")] (id "Fruit") {:sibling? true}]]])
    :bob (fn [_ id] [[:save-block [{:block/uuid (id "milk") :block/title "oat milk"} {}]]])}
   {:name "3 delete milk / Bob deletes bread"
    :alice (fn [_ id] [[:delete-blocks [[(id "milk")] {}]]])
    :bob (fn [_ id] [[:delete-blocks [[(id "bread")] {}]]])}
   {:name "4 delete milk / Bob renames apples"
    :alice (fn [_ id] [[:delete-blocks [[(id "milk")] {}]]])
    :bob (fn [_ id] [[:save-block [{:block/uuid (id "apples") :block/title "green apples"} {}]]])}
   {:name "5 move pear out of Fruit / Bob deletes Fruit"
    :alice (fn [_ id] [[:move-blocks [[(id "pear")] (id "Fruit") {:sibling? true}]]])
    :bob (fn [_ id] [[:delete-blocks [[(id "Fruit")] {}]]])}
   {:name "6 delete Fruit / Bob deletes apples"
    :alice (fn [_ id] [[:delete-blocks [[(id "Fruit")] {}]]])
    :bob (fn [_ id] [[:delete-blocks [[(id "apples")] {}]]])}
   {:name "7 move milk to the end / Bob moves bread to the end"
    :alice (fn [_ id] [[:move-blocks [[(id "milk")] (id "Fruit") {:sibling? true}]]])
    :bob (fn [db id] [[:move-blocks [[(id "bread")] (last-top db) {:sibling? true}]]])}
   {:name "8 rename milk / Bob renames milk"
    :alice (fn [_ id] [[:save-block [{:block/uuid (id "milk") :block/title "whole milk"} {}]]])
    :bob (fn [_ id] [[:save-block [{:block/uuid (id "milk") :block/title "oat milk"} {}]]])}
   {:name "9 delete milk / Bob renames milk"
    :offline-only? true
    :alice (fn [_ id] [[:delete-blocks [[(id "milk")] {}]]])
    :bob (fn [_ id] [[:save-block [{:block/uuid (id "milk") :block/title "oat milk"} {}]]])}
   {:name "10 indent milk under bread / Bob deletes bread"
    :alice (fn [_ id] [[:indent-outdent-blocks [[(id "milk")] true {}]]])
    :bob (fn [_ id] [[:delete-blocks [[(id "bread")] {}]]])}
   {:name "11 rename milk / Bob renames apples"
    :alice (fn [_ id] [[:save-block [{:block/uuid (id "milk") :block/title "whole milk"} {}]]])
    :bob (fn [_ id] [[:save-block [{:block/uuid (id "apples") :block/title "green apples"} {}]]])}
   {:name "12 insert eggs after milk / Bob deletes milk"
    :alice (fn [_ id] [[:insert-blocks [[{:block/uuid (id "eggs") :block/title "eggs"}] (id "milk") {:sibling? true :keep-uuid? true}]]])
    :bob (fn [_ id] [[:delete-blocks [[(id "milk")] {}]]])}])

(defn- run-journey [{:keys [name alice bob]} sync-mode undo-mode]
  (with-worker
    (fn [conn server-conn]
      (let [id (let [m (into {"eggs" (random-uuid)}
                             (map (fn [t] [t (u @conn t)]))
                             ["apples" "bread" "milk" "Fruit" "pear" "plum" "call mom"])]
                 (fn [t] (or (m t) (throw (ex-info "no id" {:title t})))))
            start (view @conn)
            _ (alice! conn [[:save-block [{:block/uuid (id "call mom") :block/title "call dad"} {}]]])
            after-call-dad (view @conn)
            tx-id (alice! conn (alice @conn id))
            after-alice (view @conn)
            bob-ops #(bob % id)
            out (if (= sync-mode :online)
                  (let [up1 (upload! conn server-conn)
                        server-after-upload-1 (view @server-conn)
                        bob-tx (bob! server-conn bob-ops)
                        server-after-bob (view @server-conn)
                        remote (attempt #(sync-apply/apply-remote-tx! repo nil bob-tx))
                        after-bob (view @conn)
                        depth0 (depth)
                        undo (ctrl-z! conn undo-mode tx-id)
                        after-undo (view @conn)
                        depth1 (depth)
                        up2 (upload! conn server-conn)]
                    {:upload-1 up1 :server-after-upload-1 server-after-upload-1
                     :server-after-bob server-after-bob :remote remote :after-bob after-bob
                     :undo undo :after-undo after-undo :undo-stack [depth0 depth1]
                     :upload-2 up2})
                  (let [depth0 (depth)
                        undo (ctrl-z! conn undo-mode tx-id)
                        after-undo (view @conn)
                        depth1 (depth)
                        bob-tx (bob! server-conn bob-ops)
                        server-after-bob (view @server-conn)
                        remote (attempt #(sync-apply/apply-remote-tx! repo nil bob-tx))
                        after-rebase (view @conn)
                        depth2 (depth)
                        up (upload! conn server-conn)]
                    {:undo undo :after-undo after-undo :undo-stack [depth0 depth1 depth2]
                     :server-after-bob server-after-bob
                     :remote remote :after-rebase after-rebase :upload up}))]
        (println "SYNCJ"
                 (js/JSON.stringify
                  (clj->js (merge {:journey name :sync sync-mode :undo-mode undo-mode
                                 :start start :after-call-dad after-call-dad
                                 :after-alice after-alice}
                                out
                                {:alice-final (view @conn)
                                 :server-final (view @server-conn)
                                 :converged? (= (sync-checksum/recompute-checksum @conn)
                                                (sync-checksum/recompute-checksum @server-conn))}))))))))

(deftest undo-sync-journeys
  (doseq [j journeys
          sync-mode (if (:offline-only? j) [:offline] [:online :offline])
          undo-mode [:semantic :raw]]
    (try
      (run-journey j sync-mode undo-mode)
      (catch :default e
        (println "SYNCJ" (js/JSON.stringify
                          (clj->js {:journey (:name j) :sync sync-mode :undo-mode undo-mode
                                    :crashed (ex-message e)}))))))
  (is true))
