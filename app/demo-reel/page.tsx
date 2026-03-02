"use client";

import { ReelEmbed } from "@/components/recipe/ReelEmbed";
import { Header } from "@/components/Header";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function DemoReelPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--cream)" }}>
      <Header />

      <div className="px-4 py-6">
        {/* Back link */}
        <Link 
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium mb-4 transition-colors hover:opacity-70"
          style={{ color: "var(--ink-secondary)" }}
        >
          <ArrowLeft size={16} />
          Back to Cookbooks
        </Link>

        <h1 
          className="font-display text-2xl font-bold mb-2"
          style={{ color: "var(--ink)" }}
        >
          Demo: Instagram Reel
        </h1>
        <p 
          className="text-sm mb-6"
          style={{ color: "var(--ink-secondary)" }}
        >
          This is a hardcoded Instagram reel for testing the embed component.
        </p>

        <ReelEmbed shortcode="Ck3Z0OVLtoH" />
      </div>
    </div>
  );
}
