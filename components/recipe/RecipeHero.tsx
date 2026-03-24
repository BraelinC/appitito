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
      <div className="px-4 pt-2 pb-4 flex justify-center">
        {/*
          Responsive video scaling:
          - max-h-[55svh] caps height to 55% of viewport
          - MuxPlayer maintains 9:16 aspect ratio and scales width proportionally
          - Video shrinks on smaller phones, grows on larger ones
        */}
        <MuxPlayer
          playbackId={muxPlaybackId}
          streamType="on-demand"
          accentColor="var(--accent)"
          autoPlay="muted"
          muted
          playsInline
          poster={imageUrl ?? `https://image.mux.com/${muxPlaybackId}/thumbnail.jpg?time=1`}
          className="rounded-2xl border max-h-[55svh]"
          style={{
            aspectRatio: "9 / 16",
            width: "auto",
            height: "auto",
            maxHeight: "55svh",
            borderColor: "var(--line)",
            backgroundColor: "#000",
          }}
        />
      </div>
    );
  }

  if (reelUrl) {
    return (
      <div className="px-4 pt-2 pb-4 flex justify-center">
        {/*
          Responsive video scaling:
          - max-h-[55svh] caps height to 55% of viewport
          - Video maintains 9:16 aspect ratio and scales width proportionally
        */}
        <video
          src={reelUrl}
          controls
          autoPlay
          muted
          playsInline
          preload="metadata"
          poster={imageUrl}
          className="rounded-2xl border max-h-[55svh]"
          style={{
            aspectRatio: "9 / 16",
            width: "auto",
            height: "auto",
            maxHeight: "55svh",
            borderColor: "var(--line)",
            backgroundColor: "#000",
          }}
        />
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
