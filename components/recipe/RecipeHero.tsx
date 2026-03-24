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
        {/*
          Black pillarbox container with centered video:
          - Outer container has black bg and rounded corners
          - Video scales to 55svh max height with 9:16 aspect ratio
          - Black bars show on sides when video doesn't fill width
        */}
        <div
          className="relative mx-auto w-full max-w-sm h-[55svh] rounded-2xl border overflow-hidden flex items-center justify-center"
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
            className="h-full"
            style={{
              aspectRatio: "9 / 16",
              width: "auto",
              height: "100%",
              backgroundColor: "#000",
            }}
          />
        </div>
      </div>
    );
  }

  if (reelUrl) {
    return (
      <div className="px-4 pt-2 pb-4">
        {/*
          Black pillarbox container with centered video:
          - Outer container has black bg and rounded corners
          - Video scales to 55svh max height with 9:16 aspect ratio
          - Black bars show on sides when video doesn't fill width
        */}
        <div
          className="relative mx-auto w-full max-w-sm h-[55svh] rounded-2xl border overflow-hidden flex items-center justify-center"
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
            className="h-full"
            style={{
              aspectRatio: "9 / 16",
              width: "auto",
              height: "100%",
              backgroundColor: "#000",
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
