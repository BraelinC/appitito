/**
 * Validation utilities for Appetito
 */

/**
 * Validates that a string matches the Convex ID format.
 * Convex IDs are base64-like strings, typically 20+ characters.
 */
export function isValidConvexId(id: string): boolean {
  // Convex IDs are alphanumeric with possible underscores, typically 20-32 chars
  return /^[a-zA-Z0-9_]{10,50}$/.test(id);
}

/**
 * Validates and returns the ID, or null if invalid.
 */
export function validateRecipeId(id: string | undefined): string | null {
  if (!id || !isValidConvexId(id)) {
    return null;
  }
  return id;
}
