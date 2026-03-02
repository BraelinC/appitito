"use client";

import { useAuth } from "@clerk/nextjs";
import { SignIn } from "@clerk/nextjs";
import * as Dialog from "@radix-ui/react-dialog";

export function AuthBlockerModal() {
  const { isLoaded, isSignedIn } = useAuth();

  const isOpen = isLoaded && !isSignedIn;

  return (
    <Dialog.Root open={isOpen} modal>
      {/* Non-dismissible overlay */}
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(44, 24, 16, 0.65)", backdropFilter: "blur(6px)" }}
        >
          <Dialog.Content
            className="relative w-full max-w-md mx-4 rounded-2xl overflow-hidden shadow-2xl"
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
            aria-label="Sign in to Appetito"
            aria-describedby={undefined}
          >
            {/* Decorative header */}
            <div
              className="relative flex flex-col items-center pt-8 pb-6 px-6"
              style={{ backgroundColor: "var(--cream)" }}
            >
              {/* Logo mark */}
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-3 shadow-md"
                style={{ backgroundColor: "var(--accent)" }}
              >
                <span className="text-white text-2xl">🌿</span>
              </div>

              <h1
                className="font-display text-2xl font-bold mb-1"
                style={{ color: "var(--ink)" }}
              >
                Appetito
              </h1>
              <p
                className="text-sm text-center leading-relaxed"
                style={{ color: "var(--ink-secondary)" }}
              >
                Sign in to access your family cookbooks
              </p>
            </div>

            {/* Clerk SignIn */}
            <div className="bg-white">
              <SignIn
                routing="hash"
                appearance={{
                  elements: {
                    card: "shadow-none rounded-none border-0",
                    headerTitle: "hidden",
                    headerSubtitle: "hidden",
                    logoBox: "hidden",
                  },
                }}
              />
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
