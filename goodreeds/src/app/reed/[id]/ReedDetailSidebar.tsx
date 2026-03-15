"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// Interactive star rating for "Rate this reed"
// ---------------------------------------------------------------------------
function InteractiveStars() {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => setSelected(star === selected ? 0 : star)}
          className="text-2xl transition-transform hover:scale-110 focus:outline-none"
          aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
        >
          <span
            className={
              star <= (hovered || selected) ? "star-filled" : "star-empty"
            }
          >
            ★
          </span>
        </button>
      ))}
      {selected > 0 && (
        <span className="ml-2 text-sm text-[#4F4F4D]">
          You rated this {selected}/5
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Want to Reed button
// ---------------------------------------------------------------------------
function WantToReedButton() {
  const [wantToReed, setWantToReed] = useState(false);

  return (
    <div className="flex">
      <button
        onClick={() => setWantToReed(!wantToReed)}
        className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-colors rounded-l-full ${
          wantToReed
            ? "bg-[#FAF8F6] text-[#3F8363] border border-[#3F8363]"
            : "bg-[#3F8363] text-white border border-[#377458] hover:bg-[#409970]"
        }`}
      >
        {wantToReed ? "✓ Want to Reed" : "Want to Reed"}
      </button>
      <button
        className={`px-3 py-3 text-sm transition-colors rounded-r-full ${
          wantToReed
            ? "bg-[#FAF8F6] text-[#3F8363] border border-l-0 border-[#3F8363]"
            : "bg-[#3F8363] text-white border border-l-0 border-[#377458] hover:bg-[#409970]"
        }`}
      >
        ▾
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Combined sidebar client component
// ---------------------------------------------------------------------------
interface ReedDetailSidebarProps {
  isThinkingReed: boolean;
}

export default function ReedDetailSidebar({ isThinkingReed }: ReedDetailSidebarProps) {
  return (
    <>
      {/* Want to Reed button */}
      <WantToReedButton />

      {/* Rate this reed */}
      <div className="bg-[#FAF8F6] border border-[#CFCCC9] rounded-lg p-4 text-center">
        <p className="text-sm font-medium text-[#1E1915] mb-2">
          Rate this reed
        </p>
        <div className="flex justify-center">
          <InteractiveStars />
        </div>
      </div>

      {/* Buy on Amazon Swamp */}
      <button className="w-full py-3 px-4 rounded-lg bg-[#FAF0E6] border border-[#D4A843] text-[#8B6914] font-semibold text-sm hover:bg-[#F5E6D0] transition-colors flex items-center justify-center gap-2">
        <span>🛒</span>
        Buy on Amazon Swamp
      </button>

      {/* Thinking Reed badge */}
      {isThinkingReed && (
        <div className="bg-[#F0E6F0] border border-[#D4B8D4] rounded-lg p-4 text-center">
          <p className="text-2xl mb-1">🤔</p>
          <p className="text-sm font-semibold text-[#6B3A5D]">
            Certified Thinking Reed
          </p>
          <p className="text-xs text-[#6B3A5D]/70 mt-1">
            This reed has achieved sentience
          </p>
        </div>
      )}
    </>
  );
}
