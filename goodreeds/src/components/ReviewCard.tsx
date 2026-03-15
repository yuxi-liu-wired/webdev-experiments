"use client";

import { useState } from "react";
import type { Review } from "@/data/reeds";
import StarRating from "./StarRating";

interface ReviewCardProps {
  review: Review;
}

function formatLikes(n: number): string {
  if (n >= 100_000) return `${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export default function ReviewCard({ review }: ReviewCardProps) {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(review.likes);

  const handleLike = () => {
    if (liked) {
      setLikesCount(likesCount - 1);
    } else {
      setLikesCount(likesCount + 1);
    }
    setLiked(!liked);
  };

  // Generate a deterministic avatar color from the reviewer name
  let hash = 0;
  for (let i = 0; i < review.reviewer.length; i++) {
    hash = review.reviewer.charCodeAt(i) + ((hash << 5) - hash);
  }
  const avatarColors = [
    "bg-[#2D5F2D]",
    "bg-[#4A6741]",
    "bg-[#3B5998]",
    "bg-[#8B4513]",
    "bg-[#6B3A5D]",
    "bg-[#2F4858]",
    "bg-[#704214]",
    "bg-[#C44D33]",
  ];
  const avatarColor = avatarColors[Math.abs(hash) % avatarColors.length];

  return (
    <div className="bg-white border border-[#D8D4CC] rounded-sm p-4">
      {/* Reviewer header */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-9 h-9 rounded-full ${avatarColor} flex items-center justify-center text-white font-bold text-sm`}
        >
          {review.reviewer.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          {/* Name + date row */}
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <a
              href={`/user/${encodeURIComponent(review.reviewer)}`}
              className="font-semibold text-sm text-[#382110] hover:underline"
            >
              {review.reviewer}
            </a>
            <span className="text-xs text-[#8C7B6B]">{review.date}</span>
          </div>

          {/* Stars */}
          <div className="mt-1">
            <StarRating rating={review.rating} size="sm" />
          </div>

          {/* Review text */}
          <p className="mt-2 text-sm text-[#5C4A3A] leading-relaxed whitespace-pre-line">
            {review.text}
          </p>

          {/* Like button */}
          <div className="mt-3 flex items-center gap-1">
            <button
              onClick={handleLike}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-sm border transition-colors ${
                liked
                  ? "bg-[#382110] text-[#F4F1EA] border-[#382110]"
                  : "bg-[#F4F1EA] text-[#5C4A3A] border-[#D8D4CC] hover:bg-[#EBE8E1]"
              }`}
              aria-label={liked ? "Unlike this review" : "Like this review"}
            >
              <span className={liked ? "scale-110 inline-block" : "inline-block"}>
                👍
              </span>
              <span>{formatLikes(likesCount)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
