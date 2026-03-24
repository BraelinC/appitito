export const PENDING_CLAIM_TOKEN_KEY = "appitito_pending_claim_token";

export function setPendingClaimToken(token: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PENDING_CLAIM_TOKEN_KEY, token);
}

export function getPendingClaimToken() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(PENDING_CLAIM_TOKEN_KEY);
}

export function clearPendingClaimToken() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PENDING_CLAIM_TOKEN_KEY);
}
