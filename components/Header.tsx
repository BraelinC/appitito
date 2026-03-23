"use client";

import { SignInButton, useUser, useClerk } from "@clerk/nextjs";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LogOut, User } from "lucide-react";

export function Header() {
  const { isLoaded, user } = useUser();
  const { signOut } = useClerk();

  const initials = user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0] ?? "?";
  const displayName = user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ?? "Account";
  const avatarUrl = user?.imageUrl;

  return (
    <header className="mx-4 mt-4 sm:mx-6 sm:mt-6">
      <div
        className="flex items-center justify-between rounded-3xl border px-5 py-4 shadow-[0_14px_50px_var(--shadow-warm)] backdrop-blur sm:px-7"
        style={{
          backgroundColor: "var(--panel)",
          borderColor: "var(--line)",
        }}
      >
        {/* Brand */}
        <div>
          <p
            className="text-xs uppercase tracking-[0.28em]"
            style={{ color: "var(--ink-muted)" }}
          >
            Appetito
          </p>
          <h1
            className="font-display text-2xl sm:text-3xl"
            style={{ color: "var(--ink)" }}
          >
            My Cookbooks
          </h1>
        </div>

        {!isLoaded ? (
          <div className="h-10 w-24 rounded-full" aria-hidden="true" />
        ) : !user ? (
          <SignInButton mode="modal">
            <button
              className="rounded-full border px-4 py-2 text-sm font-semibold transition-colors hover:opacity-85"
              style={{
                borderColor: "var(--accent)",
                backgroundColor: "var(--accent)",
                color: "#fff",
              }}
            >
              Sign in
            </button>
          </SignInButton>
        ) : (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                className="flex items-center gap-2 rounded-full transition-opacity hover:opacity-80 outline-none"
                aria-label="User menu"
              >
                <span
                  className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold shadow-md"
                  style={{ backgroundColor: "var(--accent)", color: "#fff" }}
                >
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    initials.toUpperCase()
                  )}
                </span>
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                className="rounded-2xl shadow-[0_14px_34px_var(--shadow-warm-strong)] border py-2 w-52 z-50"
                style={{
                  backgroundColor: "var(--panel)",
                  borderColor: "var(--line)",
                }}
              >
                <div className="px-4 py-3 border-b" style={{ borderColor: "var(--line)" }}>
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>
                    {displayName}
                  </p>
                  <p className="text-xs truncate mt-0.5" style={{ color: "var(--ink-muted)" }}>
                    {user.emailAddresses?.[0]?.emailAddress}
                  </p>
                </div>

                <DropdownMenu.Item
                  className="flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer outline-none transition-colors hover:bg-[var(--cream-warm)] rounded-xl mx-1.5 mt-1.5"
                  style={{ color: "var(--ink-secondary)" }}
                  disabled
                >
                  <User size={16} />
                  Profile
                </DropdownMenu.Item>

                <DropdownMenu.Separator
                  className="my-1.5 mx-3"
                  style={{ backgroundColor: "var(--line)", height: 1 }}
                />

                <DropdownMenu.Item
                  className="flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer outline-none transition-colors hover:bg-[var(--accent-soft)] rounded-xl mx-1.5 mb-1.5"
                  style={{ color: "var(--accent)" }}
                  onSelect={() => signOut({ redirectUrl: "/" })}
                >
                  <LogOut size={16} />
                  Sign out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </div>
    </header>
  );
}
