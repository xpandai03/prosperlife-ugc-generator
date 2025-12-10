/**
 * RatingStars Component
 *
 * Interactive 5-star rating widget for UGC assets
 * - Shows current rating (highlighted stars)
 * - Click to set new rating
 * - Hover preview effect
 */

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingStarsProps {
  rating: number | null | undefined;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function RatingStars({
  rating,
  onChange,
  readonly = false,
  size = "md",
  className,
}: RatingStarsProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const currentRating = rating || 0;
  const displayRating = hoverRating !== null ? hoverRating : currentRating;

  // Size classes
  const sizeClasses = {
    sm: "h-3.5 w-3.5",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const starSize = sizeClasses[size];

  const handleClick = (star: number) => {
    if (!readonly && onChange) {
      // If clicking the same star, toggle off (set to 0 or keep)
      // For simplicity, we'll just set the rating
      onChange(star);
    }
  };

  const handleMouseEnter = (star: number) => {
    if (!readonly) {
      setHoverRating(star);
    }
  };

  const handleMouseLeave = () => {
    setHoverRating(null);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-0.5",
        !readonly && "cursor-pointer",
        className
      )}
      onMouseLeave={handleMouseLeave}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = star <= displayRating;
        const isHovered = hoverRating !== null && star <= hoverRating;

        return (
          <button
            key={star}
            type="button"
            onClick={() => handleClick(star)}
            onMouseEnter={() => handleMouseEnter(star)}
            disabled={readonly}
            className={cn(
              "transition-all duration-150",
              !readonly && "hover:scale-110",
              readonly && "cursor-default"
            )}
            aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
          >
            <Star
              className={cn(
                starSize,
                "transition-colors duration-150",
                isFilled
                  ? "fill-yellow-400 text-yellow-400"
                  : isHovered
                  ? "fill-yellow-400/50 text-yellow-400/50"
                  : "fill-transparent text-white/30"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
