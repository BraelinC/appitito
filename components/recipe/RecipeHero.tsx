"use client";

import MuxPlayer from "@mux/mux-player-react";

interface RecipeHeroProps {
  imageUrl?: string;
  muxPlaybackId?: string;
  reelUrl?: string;
  title: string;
  fallbackEmoji?: string;
}

/**
 * Hero section for recipe - shows either Instagram reel or image.
 */
export function RecipeHero({ 
  imageUrl, 
  muxPlaybackId,
  reelUrl,
  title, 
  fallbackEmoji = "🍽️" 
}: RecipeHeroProps) {
  if (muxPlaybackId) {
    return (
      <div className="px-4 pt-2 pb-4">
        {/* Container uses max-h to ensure bookmark/description fit on first screen */}
        <div
          className="relative mx-auto aspect-[9/16] w-full max-w-sm overflow-hidden rounded-2xl border max-h-[55svh]"
          style={{ borderColor: "var(--line)", backgroundColor: "#000" }}
        >
          <MuxPlayer
            playbackId={muxPlaybackId}
            streamType="on-demand"
            accentColor="var(--accent)"
            autoPlay="muted"
            muted
            playsInline
            poster={imageUrl ?? `https://image.mux.com/${muxPlaybackId}/thumbnail.jpg?time=1`}
            className="absolute inset-0 block h-full w-full"
            style={{
              height: "100%",
              width: "100%",
              backgroundColor: "#000",
              objectFit: "cover",
              aspectRatio: "9 / 16",
            }}
          />
        </div>
      </div>
    );
  }

  if (reelUrl) {
    return (
      <div className="px-4 pt-2 pb-4">
        {/* Container uses max-h to ensure bookmark/description fit on first screen */}
        <div
          className="relative mx-auto aspect-[9/16] w-full max-w-sm overflow-hidden rounded-2xl border max-h-[55svh]"
          style={{ borderColor: "var(--line)", backgroundColor: "#000" }}
        >
          <video
            src={reelUrl}
            controls
            autoPlay
            muted
            playsInline
            preload="metadata"
            poster={imageUrl}
            className="absolute inset-0 block h-full w-full object-cover"
            style={{
              height: "100%",
              width: "100%",
              backgroundColor: "#000",
              objectFit: "cover",
              aspectRatio: "9 / 16",
            }}
          />
        </div>
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
