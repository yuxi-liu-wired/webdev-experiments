"use client";

import { useState } from "react";
import type { Reed } from "@/data/reeds";
import StarRating from "./StarRating";

interface ReedCardProps {
  reed: Reed;
  compact?: boolean;
}

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

export default function ReedCard({ reed, compact = false }: ReedCardProps) {
  const [wantToReed, setWantToReed] = useState(false);

  const coverBg = COVER_COLORS[hashStr(reed.id) % COVER_COLORS.length];
  const coverAccent = COVER_VARIANTS[hashStr(reed.id + "v") % COVER_VARIANTS.length];

  const descriptionPreview =
    reed.description.length > 180
      ? reed.description.slice(0, 180) + "..."
      : reed.description;

  return (
    <div className="reed-card bg-white rounded-sm border border-[#CFCCC9] overflow-hidden">
      <div className={`flex ${compact ? "gap-3 p-3" : "gap-4 p-4"}`}>
        {/* "Book cover" */}
        <div className="flex-shrink-0">
          <div
            className={`${compact ? "w-[70px] h-[105px]" : "w-[100px] h-[150px]"} rounded-[2px] flex items-center justify-center relative overflow-hidden`}
            style={{ background: `linear-gradient(135deg, ${coverBg} 60%, ${coverAccent})` }}
          >
            {/* Spine */}
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-black/20" />
            <div className="absolute left-[3px] top-0 bottom-0 w-px bg-white/15" />
            {/* Title area */}
            <div className="flex flex-col items-center gap-1 px-2">
              <span className={compact ? "text-2xl" : "text-4xl"} role="img" aria-label={reed.name}>
                {reed.coverEmoji}
              </span>
              {!compact && (
                <span className="text-[8px] text-white/70 text-center leading-tight font-medium uppercase tracking-wider">
                  {reed.scientificName.split(" ")[0]}
                </span>
              )}
            </div>
            {/* Sheen */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/10 pointer-events-none" />
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <h3 className={`font-serif font-bold text-[#1E1915] leading-tight ${compact ? "text-sm" : "text-lg"}`}>
            <a href={`/reed/${reed.id}`} className="hover:underline">
              {reed.name}
            </a>
          </h3>

          <p className={`italic text-[#707070] ${compact ? "text-xs" : "text-sm"}`}>
            {reed.scientificName}
          </p>

          <p className={`mt-0.5 ${compact ? "text-xs" : "text-sm"}`}>
            <span className="text-[#4F4F4D]">by </span>
            <a href="#" className="text-[#825445] hover:underline font-medium">
              {reed.author}
            </a>
          </p>

          {/* Rating row */}
          <div className={`flex items-center gap-2 flex-wrap ${compact ? "mt-1" : "mt-2"}`}>
            <StarRating rating={reed.rating} size={compact ? "sm" : "md"} />
            <span className="font-serif font-semibold text-[#1E1915] text-sm">
              {reed.rating.toFixed(2)}
            </span>
            <span className="text-xs text-[#707070]">
              {formatCount(reed.ratingsCount)} ratings &middot;{" "}
              {formatCount(reed.reviewsCount)} reviews
            </span>
          </div>

          {/* Description */}
          {!compact && (
            <p className="text-sm text-[#4F4F4D] mt-2 leading-relaxed">
              {descriptionPreview}
            </p>
          )}

          {/* Actions row */}
          <div className={`flex items-center gap-2 flex-wrap ${compact ? "mt-2" : "mt-3"}`}>
            {/* Goodreads-style split pill button */}
            <div className="inline-flex">
              <button
                onClick={() => setWantToReed(!wantToReed)}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold transition-colors ${
                  wantToReed
                    ? "bg-[#FAF8F6] text-[#3F8363] border border-[#3F8363] rounded-l-full"
                    : "bg-[#3F8363] text-white border border-[#377458] rounded-l-full hover:bg-[#409970]"
                }`}
              >
                {wantToReed ? "✓ Want to Reed" : "Want to Reed"}
              </button>
              <button
                className={`px-2 py-1.5 text-xs border-l transition-colors ${
                  wantToReed
                    ? "bg-[#FAF8F6] text-[#3F8363] border border-l-[#3F8363] border-[#3F8363] rounded-r-full"
                    : "bg-[#3F8363] text-white border border-l-[#377458] border-[#377458] rounded-r-full hover:bg-[#409970]"
                }`}
              >
                ▾
              </button>
            </div>

            {/* Genre tags */}
            <span className="text-xs text-[#1E1915] font-semibold underline cursor-pointer">
              {reed.genre}
            </span>

            {reed.thinkingReed && (
              <span className="text-xs text-[#6B3A5D] bg-[#F0E6F0] px-2 py-1 rounded-sm font-medium">
                🤔 Thinking Reed
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
