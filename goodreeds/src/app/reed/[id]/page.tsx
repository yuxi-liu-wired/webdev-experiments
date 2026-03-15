import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StarRating from "@/components/StarRating";
import ReviewCard from "@/components/ReviewCard";
import ReedCard from "@/components/ReedCard";
import { REEDS, REVIEWS } from "@/data/reeds";
import type { Reed } from "@/data/reeds";
import ReedDetailSidebar from "./ReedDetailSidebar";

// ---------------------------------------------------------------------------
// Static generation
// ---------------------------------------------------------------------------
export function generateStaticParams() {
  return REEDS.map((reed) => ({ id: reed.id }));
}

export function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  // For metadata we do a sync lookup — generateMetadata can be async in Next 15
  return params.then(({ id }) => {
    const reed = REEDS.find((r) => r.id === id);
    if (!reed) return { title: "Reed Not Found" };
    return {
      title: `${reed.name} by ${reed.author} — Good Reeds`,
      description: reed.description,
    };
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const COVER_COLORS = [
  "#2D5F2D", "#4A6741", "#3B5998", "#8B4513",
  "#6B3A5D", "#2F4858", "#704214", "#556B2F",
];
const COVER_VARIANTS = [
  "#DCE8D1", "#DEE0ED", "#EDD9DE", "#EBE2D7",
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function ratingHistogram(reed: Reed) {
  const seed = hashStr(reed.id);
  const raw = [
    ((seed * 7 + 13) % 30) + 5,
    ((seed * 3 + 7) % 20) + 10,
    ((seed * 11 + 5) % 15) + 5,
    ((seed * 13 + 3) % 10) + 2,
    ((seed * 17 + 1) % 8) + 1,
  ];
  if (reed.rating >= 4.5) {
    raw[0] += 30;
  } else if (reed.rating >= 4.0) {
    raw[0] += 20;
    raw[1] += 10;
  } else if (reed.rating >= 3.5) {
    raw[1] += 15;
    raw[2] += 10;
  } else {
    raw[2] += 15;
    raw[3] += 10;
  }
  const total = raw.reduce((a, b) => a + b, 0);
  return raw.map((v) => Math.round((v / total) * 100));
}

function alsoEnjoyed(currentId: string): Reed[] {
  const others = REEDS.filter((r) => r.id !== currentId);
  const seed = hashStr(currentId + "also");
  const picked: Reed[] = [];
  const indices = new Set<number>();
  let i = 0;
  while (picked.length < 3 && picked.length < others.length) {
    const idx = (seed + i * 7) % others.length;
    if (!indices.has(idx)) {
      indices.add(idx);
      picked.push(others[idx]);
    }
    i++;
  }
  return picked;
}

// ---------------------------------------------------------------------------
// Page (server component)
// ---------------------------------------------------------------------------
export default async function ReedDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const reed = REEDS.find((r) => r.id === id);
  if (!reed) return notFound();

  const reviews = REVIEWS.filter((r) => r.reedId === reed.id);
  const histogram = ratingHistogram(reed);
  const recommended = alsoEnjoyed(reed.id);

  const coverBg = COVER_COLORS[hashStr(reed.id) % COVER_COLORS.length];
  const coverAccent =
    COVER_VARIANTS[hashStr(reed.id + "v") % COVER_VARIANTS.length];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      {/* Breadcrumb */}
      <div className="bg-[#FAF8F6] border-b border-[#CFCCC9]">
        <div className="max-w-[1260px] mx-auto px-4 sm:px-6 py-3">
          <nav className="text-sm text-[#707070]">
            <a href="/" className="hover:text-[#1E1915] transition-colors">
              Home
            </a>
            <span className="mx-2">/</span>
            <a href="/" className="hover:text-[#1E1915] transition-colors">
              Reeds
            </a>
            <span className="mx-2">/</span>
            <span className="text-[#1E1915] font-medium">{reed.name}</span>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-[1260px] mx-auto px-4 sm:px-6 py-8 flex-1">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* ================================================================
              LEFT COLUMN — Cover, buttons, interactive rating
              ================================================================ */}
          <div className="flex-shrink-0 lg:w-[300px]">
            <div className="lg:sticky lg:top-[90px] space-y-5">
              {/* Large book cover */}
              <div
                className="w-full max-w-[260px] mx-auto aspect-[2/3] rounded-sm flex items-center justify-center relative overflow-hidden shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${coverBg} 60%, ${coverAccent})`,
                }}
              >
                {/* Spine */}
                <div className="absolute left-0 top-0 bottom-0 w-[5px] bg-black/20" />
                <div className="absolute left-[5px] top-0 bottom-0 w-px bg-white/15" />
                {/* Content */}
                <div className="flex flex-col items-center gap-3 px-6">
                  <span className="text-7xl" role="img" aria-label={reed.name}>
                    {reed.coverEmoji}
                  </span>
                  <span className="text-[10px] text-white/70 text-center leading-tight font-medium uppercase tracking-widest">
                    {reed.scientificName}
                  </span>
                  <span className="text-xs text-white/50 text-center font-serif italic">
                    {reed.author}
                  </span>
                </div>
                {/* Sheen */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/10 pointer-events-none" />
              </div>

              {/* Interactive sidebar (client component) */}
              <ReedDetailSidebar isThinkingReed={!!reed.thinkingReed} />
            </div>
          </div>

          {/* ================================================================
              RIGHT COLUMN — All reed details
              ================================================================ */}
          <div className="flex-1 min-w-0">
            {/* Reed name */}
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1E1915] leading-tight">
              {reed.name}
            </h1>

            {/* Scientific name */}
            <p className="mt-1 text-lg italic text-[#707070]">
              {reed.scientificName}
            </p>

            {/* Author */}
            <p className="mt-2 text-lg">
              <span className="text-[#4F4F4D]">by </span>
              <a
                href="#"
                className="text-[#825445] hover:underline font-medium"
              >
                {reed.author}
              </a>
            </p>

            {/* Rating display */}
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <StarRating rating={reed.rating} size="lg" />
              <span className="font-serif text-xl font-bold text-[#1E1915]">
                {reed.rating.toFixed(2)}
              </span>
            </div>
            <p className="mt-1 text-sm text-[#707070]">
              {formatCount(reed.ratingsCount)} ratings &middot;{" "}
              {formatCount(reed.reviewsCount)} reviews
            </p>

            {/* Description */}
            <div className="mt-6">
              <p className="text-[#4F4F4D] leading-relaxed text-base">
                {reed.description}
              </p>
            </div>

            {/* Genre tags */}
            <div className="mt-5 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-[#707070] font-medium">
                Genres:
              </span>
              <span className="text-sm font-semibold text-[#1E1915] bg-[#FAF8F6] border border-[#CFCCC9] rounded-full px-3 py-1 hover:bg-[#F2F2F2] cursor-pointer transition-colors">
                {reed.genre}
              </span>
              {reed.thinkingReed && (
                <span className="text-sm font-semibold text-[#6B3A5D] bg-[#F0E6F0] border border-[#D4B8D4] rounded-full px-3 py-1">
                  Philosophy
                </span>
              )}
              <span className="text-sm font-semibold text-[#1E1915] bg-[#FAF8F6] border border-[#CFCCC9] rounded-full px-3 py-1 hover:bg-[#F2F2F2] cursor-pointer transition-colors">
                Botanical Literature
              </span>
            </div>

            {/* Metadata */}
            <div className="mt-5 flex items-center gap-6 flex-wrap text-sm text-[#4F4F4D]">
              <div>
                <span className="text-[#707070]">Height: </span>
                <span className="font-medium text-[#1E1915]">
                  {reed.pages}
                </span>
              </div>
              <div>
                <span className="text-[#707070]">First catalogued: </span>
                <span className="font-medium text-[#1E1915]">
                  {reed.publishedDate}
                </span>
              </div>
            </div>

            {/* ============================================================
                Rating Breakdown
                ============================================================ */}
            <hr className="gr-divider" />

            <h2 className="font-serif text-xl font-bold text-[#1E1915] mb-4">
              Rating Breakdown
            </h2>

            <div className="bg-[#FAF8F6] border border-[#CFCCC9] rounded-lg p-5">
              <div className="flex flex-col sm:flex-row gap-6">
                {/* Big number */}
                <div className="text-center sm:text-left flex-shrink-0">
                  <p className="font-serif text-5xl font-bold text-[#1E1915]">
                    {reed.rating.toFixed(1)}
                  </p>
                  <div className="mt-1">
                    <StarRating rating={reed.rating} size="md" />
                  </div>
                  <p className="mt-1 text-xs text-[#707070]">
                    {formatCount(reed.ratingsCount)} ratings
                  </p>
                </div>

                {/* Histogram bars */}
                <div className="flex-1 space-y-1.5">
                  {[5, 4, 3, 2, 1].map((star, i) => (
                    <div key={star} className="flex items-center gap-2">
                      <span className="text-sm text-[#707070] w-12 text-right flex-shrink-0">
                        {star} star{star !== 1 && "s"}
                      </span>
                      <div className="flex-1 h-3 bg-[#CFCCC9]/40 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${histogram[i]}%`,
                            backgroundColor: "#E87400",
                          }}
                        />
                      </div>
                      <span className="text-xs text-[#707070] w-8 flex-shrink-0">
                        {histogram[i]}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ============================================================
                Community Reviews
                ============================================================ */}
            <hr className="gr-divider" />

            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <h2 className="font-serif text-xl font-bold text-[#1E1915]">
                Community Reviews
              </h2>
              <span className="text-sm text-[#707070]">
                Showing {reviews.length} of{" "}
                {formatCount(reed.reviewsCount)} reviews
              </span>
            </div>

            {reviews.length > 0 ? (
              <div className="mt-4 grid gap-3">
                {reviews.map((review, i) => (
                  <ReviewCard key={i} review={review} />
                ))}
              </div>
            ) : (
              <div className="mt-4 bg-[#FAF8F6] border border-[#CFCCC9] rounded-lg p-8 text-center">
                <p className="text-4xl mb-2">🌾</p>
                <p className="text-[#707070] text-sm">
                  No reviews yet. Be the first to review this reed!
                </p>
                <button className="btn-wtr mt-4">Write a Review</button>
              </div>
            )}

            {/* ============================================================
                Readers Also Enjoyed
                ============================================================ */}
            <hr className="gr-divider" />

            <h2 className="font-serif text-xl font-bold text-[#1E1915] mb-4">
              Readers Also Enjoyed
            </h2>

            <div className="grid sm:grid-cols-3 gap-4">
              {recommended.map((r) => (
                <ReedCard key={r.id} reed={r} compact />
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
