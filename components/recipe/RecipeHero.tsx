"use client";

import { ReelEmbed } from "./ReelEmbed";

interface RecipeHeroProps {
  imageUrl?: string;
  instagramReelShortcode?: string;
  title: string;
  fallbackEmoji?: string;
}

/**
 * Hero section for recipe - shows either Instagram reel or image.
 */
export function RecipeHero({ 
  imageUrl, 
  instagramReelShortcode, 
  title, 
  fallbackEmoji = "🍽️" 
}: RecipeHeroProps) {
  // Show Instagram reel if available
  if (instagramReelShortcode) {
    return (
      <div className="px-4 pt-2 pb-6">
        <ReelEmbed shortcode={instagramReelShortcode} />
      </div>
    );
  }

  // Show image or emoji fallback
  return (
    <div className="relative w-full" style={{ aspectRatio: "4/3", maxHeight: 320 }}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-7xl"
          style={{ backgroundColor: "var(--cream-warm)" }}
        >
          {fallbackEmoji}
        </div>
      )}
      
      {/* Gradient fade into page */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24"
        style={{
          background: "linear-gradient(to bottom, transparent, var(--cream))",
        }}
      />
    </div>
  );
}
