interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: "sm" | "md" | "lg";
  showNumeric?: boolean;
}

export default function StarRating({
  rating,
  maxStars = 5,
  size = "md",
  showNumeric = false,
}: StarRatingProps) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating - fullStars >= 0.25 && rating - fullStars < 0.75;
  const adjustedFull =
    rating - fullStars >= 0.75 ? fullStars + 1 : fullStars;
  const emptyStars = maxStars - adjustedFull - (hasHalfStar ? 1 : 0);

  const sizeClasses = {
    sm: "text-sm gap-0",
    md: "text-lg gap-0.5",
    lg: "text-2xl gap-0.5",
  };

  const numericSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <span
      className={`inline-flex items-center ${sizeClasses[size]}`}
      role="img"
      aria-label={`${rating} out of ${maxStars} stars`}
    >
      {/* Full stars */}
      {Array.from({ length: adjustedFull }, (_, i) => (
        <span key={`full-${i}`} className="star-filled leading-none">
          ★
        </span>
      ))}

      {/* Half star */}
      {hasHalfStar && (
        <span className="relative leading-none" key="half">
          <span className="star-empty">★</span>
          <span
            className="absolute inset-0 overflow-hidden star-filled"
            style={{ width: "50%" }}
          >
            ★
          </span>
        </span>
      )}

      {/* Empty stars */}
      {Array.from({ length: Math.max(0, emptyStars) }, (_, i) => (
        <span key={`empty-${i}`} className="star-empty leading-none">
          ★
        </span>
      ))}

      {showNumeric && (
        <span
          className={`ml-1.5 font-semibold text-[#382110] ${numericSizeClasses[size]}`}
        >
          {rating.toFixed(2)}
        </span>
      )}
    </span>
  );
}
