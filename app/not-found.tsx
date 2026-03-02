import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4 px-5"
      style={{ backgroundColor: "var(--cream)" }}
    >
      <span className="text-6xl">🍽️</span>
      <h1
        className="font-display text-3xl font-bold"
        style={{ color: "var(--ink)" }}
      >
        Page not found
      </h1>
      <Link
        href="/"
        className="px-6 py-2.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--accent)" }}
      >
        Go home
      </Link>
    </div>
  );
}
