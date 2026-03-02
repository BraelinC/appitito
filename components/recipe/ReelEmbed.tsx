"use client";

interface ReelEmbedProps {
  shortcode: string;
}

/**
 * Instagram Reel embed component.
 * 
 * Uses overflow clipping to hide Instagram's engagement UI (likes, comments, etc.)
 * while keeping the video and username attribution visible.
 * 
 * How it works:
 * - Container is 440px tall with overflow:hidden
 * - Iframe is 700px tall (taller than container)
 * - This clips ~260px from the bottom, hiding "View more on Instagram", 
 *   like/comment buttons, and comment input
 * - Top attribution (username + "View profile") stays visible
 */

// Container height - shows video + top attribution, clips bottom UI
const CLIP_HEIGHT = 440;

// Iframe height - must be taller than container to enable clipping
// Instagram embed is ~640px, we use 700px for safety margin
const IFRAME_HEIGHT = 700;

export function ReelEmbed({ shortcode }: ReelEmbedProps) {
  const embedUrl = `https://www.instagram.com/reel/${shortcode}/embed/`;

  return (
    <div
      className="reel-clip rounded-2xl overflow-hidden border"
      style={{
        height: CLIP_HEIGHT,
        borderColor: "var(--line)",
      }}
    >
      <iframe
        src={embedUrl}
        title="Instagram Reel"
        allowFullScreen
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
        // Security: Restrict iframe permissions to only what's needed
        // - allow-scripts: Required for Instagram player to work
        // - allow-same-origin: Required for Instagram to access its own cookies/storage
        // - allow-popups: Required for "View on Instagram" links to open
        sandbox="allow-scripts allow-same-origin allow-popups"
        loading="lazy"
        referrerPolicy="no-referrer"
        style={{
          width: "100%",
          height: IFRAME_HEIGHT,
          border: "none",
        }}
      />
    </div>
  );
}
