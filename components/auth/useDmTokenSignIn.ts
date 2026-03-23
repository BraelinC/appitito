"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSignIn, useUser } from "@clerk/nextjs";

type DmTokenState = {
  authToken: string | null;
  isAutoSigningIn: boolean;
  justClaimed: boolean;
};

export function useDmTokenSignIn(): DmTokenState {
  const searchParams = useSearchParams();
  const { isLoaded: signInLoaded, signIn, setActive } = useSignIn();
  const { user } = useUser();
  const [isAutoSigningIn, setIsAutoSigningIn] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);
  const authToken = searchParams.get("auth");

  useEffect(() => {
    if (!authToken || user || !signInLoaded || !signIn || !setActive) {
      return;
    }

    const signInResource = signIn;
    const activateSession = setActive;
    let cancelled = false;

    async function exchangeDmToken() {
      setIsAutoSigningIn(true);

      try {
        const response = await fetch("/api/dm-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: authToken }),
        });

        if (!response.ok) {
          return;
        }

        const result = await response.json() as { success?: boolean; signInToken?: string };
        if (!result.success || !result.signInToken) {
          return;
        }

        const attempt = await signInResource.create({ strategy: "ticket", ticket: result.signInToken });
        if (attempt.status === "complete" && attempt.createdSessionId) {
          await activateSession({ session: attempt.createdSessionId });
          await fetch("/api/dm-auth/consume", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: authToken }),
          });

          if (!cancelled) {
            setJustClaimed(true);
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.delete("auth");
            window.history.replaceState({}, "", nextUrl.toString());
          }
        }
      } catch (error) {
        console.error("Failed to auto sign in from DM token:", error);
      } finally {
        if (!cancelled) {
          setIsAutoSigningIn(false);
        }
      }
    }

    void exchangeDmToken();

    return () => {
      cancelled = true;
    };
  }, [authToken, setActive, signIn, signInLoaded, user]);

  return {
    authToken,
    isAutoSigningIn,
    justClaimed,
  };
}
