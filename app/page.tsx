export const dynamic = "force-dynamic";

import { Header } from "@/components/Header";
import { CookbookGrid } from "@/components/cookbook/CookbookGrid";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Header />
      <CookbookGrid />
    </main>
  );
}
