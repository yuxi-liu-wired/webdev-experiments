// One poll cycle: read unseen mentions, answer each, mark them seen.

import { parseCommand } from './parse.js';
import { corpusFromPosts, findBest, rengaChain } from './engine.js';
import {
  poemReply, notFoundReply, errorReply, rengaStanzaReply, rengaMissReply,
  graphemes, POST_LIMIT,
} from './compose.js';
import {
  ensureSession, dropSession, listNotifications, updateSeen,
  resolveHandle, authorPosts, postReply, alreadyAnswered,
} from './bsky.js';

const MAX_PER_CYCLE = 5; // the rest stay unread and are picked up next cycle

/**
 * The reply a mention deserves — a single reply object, or, for a renga,
 * { thread: [reply, ...] } posted as a chain. Exported for the dry run.
 */
export async function replyFor(mention, botHandles, env = process.env) {
  const pinned = env.BOT_PINNED_URL || 'https://found-haiku.netlify.app/';
  const cmd = parseCommand(mention.record?.text || '', botHandles, mention.record?.facets);
  if (cmd.error) return errorReply(cmd.error, pinned);

  if (cmd.formatName === 'renga') {
    // the mentioner opens with the hokku; guests follow in the order named
    const voices = [{ handle: mention.author.handle, did: mention.author.did }];
    for (const t of cmd.renga) {
      const did = t.did || await resolveHandle(t.handle);
      if (!did) return errorReply('user does not exist', pinned);
      voices.push({ handle: t.handle, did });
    }
    for (const v of voices) {
      let posts;
      try {
        posts = await authorPosts(v.did, 5);
      } catch {
        return errorReply('user does not exist', pinned);
      }
      v.corpus = corpusFromPosts(posts);
    }
    const chain = rengaChain(voices);
    if (chain.missing) return rengaMissReply(chain.missing, chain.pattern);
    const total = chain.stanzas.length;
    const thread = chain.stanzas.map((st, i) => rengaStanzaReply(st, i, total)).filter(Boolean);
    if (thread.length < total) return rengaMissReply(voices[thread.length].handle, [5, 7, 5]);
    return { thread };
  }

  let did = mention.author.did;
  let aboutSelf = true;
  if (cmd.target) {
    aboutSelf = false;
    did = cmd.target.did || await resolveHandle(cmd.target.handle);
    if (!did) return errorReply('user does not exist', pinned);
  }

  let posts;
  try {
    posts = await authorPosts(did);
  } catch {
    return errorReply('user does not exist', pinned);
  }
  if (!posts.length) return notFoundReply(aboutSelf);

  const found = findBest(corpusFromPosts(posts), cmd.pattern,
    (poem, url) => graphemes(poem.lines.map((l) => l.text).join('\n')) + graphemes(url) + 2 <= POST_LIMIT);
  if (!found) return notFoundReply(aboutSelf);
  return poemReply(found.poem, found.url) || notFoundReply(aboutSelf);
}

export async function pollOnce(env = process.env, log = console.log) {
  let session;
  try {
    session = await ensureSession(env);
  } catch (e) {
    dropSession();
    throw e;
  }

  const notifications = await listNotifications(session);
  const mentions = notifications
    .filter((n) => n.reason === 'mention' && !n.isRead && n.author.did !== session.did)
    .sort((a, b) => (a.indexedAt < b.indexedAt ? -1 : 1))
    .slice(0, MAX_PER_CYCLE);

  const botHandles = [session.handle, env.BOT_IDENTIFIER].filter(Boolean);
  let answered = 0;
  let lastSeen = null;

  for (const mention of mentions) {
    try {
      // restart/cold-start insurance: never answer the same post twice
      if (await alreadyAnswered(mention.uri, session.did)) {
        log(`already answered @${mention.author.handle}, skipping`);
        lastSeen = mention.indexedAt;
        continue;
      }
      const reply = await replyFor(mention, botHandles, env);
      if (reply.thread) {
        // a renga posts stanza by stanza, each hanging off the last
        let parent = mention;
        for (const stanza of reply.thread) {
          const posted = await postReply(session, parent, stanza);
          parent = { uri: posted.uri, cid: posted.cid, record: { reply: { root: mention.record?.reply?.root || { uri: mention.uri, cid: mention.cid } } } };
        }
        answered++;
        log(`answered @${mention.author.handle}: renga in ${reply.thread.length} stanzas`);
      } else {
        await postReply(session, mention, reply);
        answered++;
        log(`answered @${mention.author.handle}: ${reply.text.split('\n')[0].slice(0, 60)}`);
      }
    } catch (e) {
      // A failed mention is left unread for the next cycle rather than lost.
      log(`failed on @${mention.author.handle}: ${e.message}`);
      if (e.status === 401) dropSession();
      break;
    }
    lastSeen = mention.indexedAt;
  }

  if (lastSeen) await updateSeen(session, lastSeen);
  return { mentions: mentions.length, answered };
}
