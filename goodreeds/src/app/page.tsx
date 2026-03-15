import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ReedCard from "@/components/ReedCard";
import ReviewCard from "@/components/ReviewCard";
import PascalQuote from "@/components/PascalQuote";
import StarRating from "@/components/StarRating";
import { REEDS, REVIEWS, PASCAL_QUOTES, REED_SHELVES, GENRES, REEDING_LISTS } from "@/data/reeds";

export default function Home() {
  const featuredReeds = REEDS.filter((r) => r.featured);
  const otherReeds = REEDS.filter((r) => !r.featured);
  const featuredReviews = REVIEWS.slice(0, 6);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Announcement banner */}
      <div className="bg-[#3F8363] text-white text-center py-2 px-4 text-sm font-medium">
        🌾 Did Not Finish growing? There&apos;s a reed bed for that! <span className="underline cursor-pointer">Learn more &rarr;</span>
      </div>

      {/* Hero section */}
      <section className="bg-[#FAF8F6] border-b border-[#CFCCC9]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h1 className="font-serif text-4xl sm:text-5xl font-bold text-[#1E1915] leading-tight">
                What are you <br />
                <span className="text-[#3F8363]">reeding</span>?
              </h1>
              <p className="mt-4 text-lg text-[#4F4F4D] max-w-lg">
                Join the world&apos;s largest community of reed enthusiasts.
                Track reeds you&apos;ve observed, rate and review your favorites,
                and discover new species reed-commended just for you.
              </p>
              <div className="mt-6 flex gap-3 flex-wrap">
                <button className="btn-wtr text-base px-8 py-3">
                  Join Good Reeds
                </button>
                <button className="px-8 py-3 text-base font-semibold rounded-full border border-[#707070] text-[#1E1915] hover:bg-[#F2F2F2] transition-colors">
                  Sign In
                </button>
              </div>
            </div>

            {/* 2026 Reeding Challenge */}
            <div className="bg-white rounded-lg border border-[#CFCCC9] p-6 shadow-sm">
              <div className="text-center">
                <p className="text-[#707070] text-sm uppercase tracking-wider font-medium">
                  Good Reeds
                </p>
                <h2 className="font-serif text-3xl font-bold text-[#1E1915] mt-1">
                  2026 Reeding Challenge
                </h2>
                <p className="text-6xl mt-4 select-none">📜🌾🎋</p>
                <p className="mt-4 text-[#4F4F4D]">
                  How many reeds can you observe this year?
                </p>
                <p className="mt-1 text-sm text-[#707070]">
                  Last year&apos;s champion identified 347 unique species.
                </p>
                <button className="btn-wtr mt-4 px-6">
                  Start My Reeding Challenge
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-1">
        <div className="grid lg:grid-cols-[1fr_300px] gap-8">
          {/* Main content column */}
          <div>
            {/* Pascal's Thought of the Day */}
            <section>
              <h2 className="font-serif text-2xl font-bold text-[#1E1915] mb-4">
                Pascal&apos;s Thought of the Day
              </h2>
              <PascalQuote
                text={PASCAL_QUOTES[0].text}
                source={PASCAL_QUOTES[0].source}
              />
              <PascalQuote
                text={PASCAL_QUOTES[5].text}
                source={PASCAL_QUOTES[5].source}
              />
            </section>

            <hr className="gr-divider" />

            {/* Featured Reeds */}
            <section>
              <h2 className="font-serif text-2xl font-bold text-[#1E1915] mb-1">
                Trending Reeds
              </h2>
              <p className="text-sm text-[#707070] mb-4">
                The most popular reeds on Good Reeds this week
              </p>
              <div className="grid gap-4">
                {featuredReeds.map((reed) => (
                  <ReedCard key={reed.id} reed={reed} />
                ))}
              </div>
            </section>

            <hr className="gr-divider" />

            {/* Reed-commendations */}
            <section>
              <h2 className="font-serif text-2xl font-bold text-[#1E1915] mb-1">
                Reed-commendations
              </h2>
              <p className="text-sm text-[#707070] mb-4">
                Because you enjoyed <span className="font-medium text-[#825445]">Common Reed</span>, you might also like...
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {otherReeds.map((reed) => (
                  <ReedCard key={reed.id} reed={reed} compact />
                ))}
              </div>
            </section>

            <hr className="gr-divider" />

            {/* Community Reviews */}
            <section>
              <h2 className="font-serif text-2xl font-bold text-[#1E1915] mb-1">
                Community Reviews
              </h2>
              <p className="text-sm text-[#707070] mb-4">
                See what fellow reed enthusiasts are saying
              </p>
              <div className="grid gap-3">
                {featuredReviews.map((review, i) => (
                  <ReviewCard key={i} review={review} />
                ))}
              </div>
            </section>

            <hr className="gr-divider" />

            {/* Popular Reeding Lists */}
            <section>
              <h2 className="font-serif text-2xl font-bold text-[#1E1915] mb-1">
                Popular Reeding Lists
              </h2>
              <p className="text-sm text-[#707070] mb-4">
                Curated collections from the Good Reeds community
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {REEDING_LISTS.slice(0, 6).map((list) => (
                  <a
                    key={list.name}
                    href="#"
                    className="bg-white border border-[#CFCCC9] rounded-sm p-4 hover:bg-[#FAF8F6] transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{list.emoji}</span>
                      <div className="min-w-0">
                        <h3 className="font-serif text-sm font-bold text-[#1E1915] group-hover:underline">
                          {list.name}
                        </h3>
                        <p className="text-xs text-[#4F4F4D] mt-1 line-clamp-2">
                          {list.description}
                        </p>
                        <p className="text-xs text-[#707070] mt-1">
                          {list.reedCount} reeds &middot; {list.followers.toLocaleString()} followers
                        </p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </section>

            <hr className="gr-divider" />

            {/* The Thinking Reed Award */}
            <section className="bg-white border border-[#CFCCC9] rounded-lg p-6">
              <div className="text-center">
                <p className="text-sm text-[#707070] uppercase tracking-wider font-medium">
                  Monthly Award
                </p>
                <h2 className="font-serif text-2xl font-bold text-[#1E1915] mt-1">
                  🤔 The Thinking Reed Award
                </h2>
                <p className="text-sm text-[#707070] mt-1 italic">
                  &quot;The most noble reed of the month&quot;
                </p>
                <div className="mt-6 flex items-center justify-center gap-6">
                  <div className="w-24 h-36 bg-[#6B3A5D] rounded-sm flex items-center justify-center shadow-md relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-black/15" />
                    <span className="text-5xl">🤔</span>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-serif text-xl font-bold text-[#1E1915]">
                      Pascal&apos;s Reed
                    </h3>
                    <p className="text-sm italic text-[#825445]">
                      by Blaise Pascal
                    </p>
                    <div className="mt-1">
                      <StarRating rating={5} size="md" showNumeric />
                    </div>
                    <p className="mt-2 text-sm text-[#4F4F4D] max-w-sm">
                      &quot;Man is but a reed... but he is a thinking reed.&quot;
                      The only reed that achieved sentience and then had an
                      existential crisis about it.
                    </p>
                    <p className="mt-2 text-xs text-[#707070]">
                      Winner for 356 consecutive months
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <hr className="gr-divider" />

            {/* More Pascal */}
            <section>
              <h2 className="font-serif text-2xl font-bold text-[#1E1915] mb-4">
                More Thoughts from Pascal
              </h2>
              <div className="grid gap-2">
                {PASCAL_QUOTES.slice(1, 5).map((q, i) => (
                  <PascalQuote key={i} text={q.text} source={q.source} />
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* My Reed Shelves */}
            <div className="bg-white border border-[#CFCCC9] rounded-lg overflow-hidden">
              <div className="bg-[#FAF8F6] px-4 py-3 border-b border-[#CFCCC9]">
                <h3 className="font-serif text-base font-bold text-[#1E1915]">
                  My Reed Shelves
                </h3>
              </div>
              <ul className="divide-y divide-[#CFCCC9]">
                {REED_SHELVES.map((shelf) => (
                  <li key={shelf.name}>
                    <a
                      href="#"
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-[#FAF8F6] transition-colors"
                    >
                      <span className="text-sm text-[#1E1915]">
                        <span className="mr-2">{shelf.emoji}</span>
                        {shelf.name}
                      </span>
                      <span className="text-xs text-[#707070] bg-[#F4F1EA] px-2 py-0.5 rounded-full">
                        {shelf.count}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Browse by Genre */}
            <div className="bg-white border border-[#CFCCC9] rounded-lg overflow-hidden">
              <div className="bg-[#FAF8F6] px-4 py-3 border-b border-[#CFCCC9]">
                <h3 className="font-serif text-base font-bold text-[#1E1915]">
                  Browse by Genre
                </h3>
              </div>
              <ul className="divide-y divide-[#CFCCC9]">
                {GENRES.map((genre) => (
                  <li key={genre.name}>
                    <a
                      href="#"
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-[#FAF8F6] transition-colors"
                    >
                      <span className="text-sm text-[#1E1915]">
                        <span className="mr-2">{genre.emoji}</span>
                        {genre.name}
                      </span>
                      <span className="text-xs text-[#707070]">
                        {genre.count.toLocaleString()}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Stats box */}
            <div className="bg-white border border-[#CFCCC9] rounded-lg p-4">
              <h3 className="font-serif text-base font-bold text-[#1E1915] mb-3">
                Good Reeds Stats
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[#707070]">Total Reeds Catalogued</dt>
                  <dd className="font-semibold text-[#1E1915]">12,847</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#707070]">Reviews Written</dt>
                  <dd className="font-semibold text-[#1E1915]">1,034,521</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#707070]">Active Reed Beds</dt>
                  <dd className="font-semibold text-[#1E1915]">89,234</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#707070]">Thinking Reeds Found</dt>
                  <dd className="font-semibold text-[#1E1915]">2</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#707070]">Years in Operation</dt>
                  <dd className="font-semibold text-[#1E1915]">~65M</dd>
                </div>
              </dl>
            </div>

            {/* Did You Know? */}
            <div className="bg-[#FAF8F6] border border-[#CFCCC9] rounded-lg p-4">
              <h3 className="font-serif text-base font-bold text-[#1E1915] mb-2">
                🌾 Did You Know?
              </h3>
              <p className="text-sm text-[#4F4F4D] leading-relaxed">
                The word &quot;read&quot; and &quot;reed&quot; share the same Old
                English root <em>rēad</em>. This is not true at all, but it
                feels like it should be, and that&apos;s what Good Reeds is all
                about.
              </p>
            </div>

            {/* Seasonal Pick */}
            <div className="bg-white border border-[#CFCCC9] rounded-lg p-4">
              <h3 className="font-serif text-base font-bold text-[#1E1915] mb-2">
                Seasonal Reed Pick
              </h3>
              <div className="flex items-center gap-3">
                <div className="w-12 h-18 bg-[#2D5F2D] rounded-sm flex items-center justify-center text-2xl shadow-sm">
                  🌾
                </div>
                <div>
                  <p className="font-serif text-sm font-bold text-[#1E1915]">
                    Common Reed
                  </p>
                  <p className="text-xs text-[#825445]">
                    Perfect for spring observing
                  </p>
                  <p className="text-xs text-[#707070] mt-0.5">
                    &quot;Excellent plume development this season&quot;
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
