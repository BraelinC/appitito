/**
 * Time parsing and formatting utilities for recipe durations.
 * 
 * Supported input formats:
 * - "15 minutes" or "15 mins" or "15"
 * - "1 hour" or "1 hr"  
 * - "1 hour 30 minutes"
 * - "45-60 minutes" (ranges - uses average)
 */

/**
 * Parse a time string into minutes.
 * 
 * @param timeStr - Time string like "15 minutes", "1 hour", "45-60 minutes"
 * @returns Number of minutes, or 0 if unparseable
 * 
 * @example
 * parseMinutes("15 minutes") // 15
 * parseMinutes("1 hour") // 60
 * parseMinutes("45-60 minutes") // 52.5 (average)
 */
export function parseMinutes(timeStr: string | undefined): number {
  if (!timeStr) return 0;
  
  // Handle ranges like "45-60 minutes" - use average
  const rangeMatch = timeStr.match(/(\d+)\s*-\s*(\d+)/);
  if (rangeMatch) {
    const low = parseInt(rangeMatch[1], 10);
    const high = parseInt(rangeMatch[2], 10);
    return (low + high) / 2;
  }
  
  // Handle hours like "1 hour" or "2 hours"
  const hourMatch = timeStr.match(/(\d+)\s*h(?:our|r)?s?/i);
  if (hourMatch) {
    return parseInt(hourMatch[1], 10) * 60;
  }
  
  // Handle plain numbers or "X minutes"
  const minMatch = timeStr.match(/(\d+)/);
  return minMatch ? parseInt(minMatch[1], 10) : 0;
}

/**
 * Format prep + cook time into a readable total.
 * 
 * @param prepTime - Prep time string
 * @param cookTime - Cook time string
 * @returns Formatted string like "45 min" or "1h 30m", or null if no times
 * 
 * @example
 * formatTotalTime("15 minutes", "30 minutes") // "45 min"
 * formatTotalTime("15 minutes", "1 hour") // "1h 15m"
 * formatTotalTime(undefined, undefined) // null
 */
export function formatTotalTime(
  prepTime: string | undefined, 
  cookTime: string | undefined
): string | null {
  const prepMins = parseMinutes(prepTime);
  const cookMins = parseMinutes(cookTime);
  const total = prepMins + cookMins;
  
  if (total === 0) return null;
  
  if (total >= 60) {
    const hours = Math.floor(total / 60);
    const mins = Math.round(total % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  // Just return the number - the clock icon indicates it's minutes
  return `${Math.round(total)}`;
}
