/**
 * VSL Name Normalizer
 * 
 * Handles normalization of VSL names for matching between RedTrack and VTurb.
 * Rules:
 * - Case-insensitive comparison
 * - Ignore minor spacing/punctuation variations
 * - Numeric variations after dots (VSL56.2 -> VSL56)
 * - Extract group name from patterns like "VSL1_US" -> group "VSL1"
 */

/**
 * Normalize a VSL name for comparison/matching.
 * Removes case differences, extra spaces, and numeric sub-versions.
 */
export function normalizeVslName(name: string): string {
  let normalized = name.trim().toLowerCase();
  // Remove numeric sub-versions (e.g., "vsl56.2" -> "vsl56")
  normalized = normalized.replace(/(\d+)\.\d+/g, "$1");
  // Normalize spaces and underscores
  normalized = normalized.replace(/[\s_-]+/g, "_");
  // Remove trailing/leading underscores
  normalized = normalized.replace(/^_+|_+$/g, "");
  return normalized;
}

/**
 * Extract the group name from a VSL name.
 * Examples:
 * - "VSL1_US" -> "VSL1"
 * - "VSL2_UK" -> "VSL2"
 * - "MemoryLift_VSL3_BR" -> "MemoryLift_VSL3"
 * - "VSL 56.2" -> "VSL 56"
 */
export function extractGroupName(name: string): string {
  let groupName = name.trim();
  // Remove numeric sub-versions
  groupName = groupName.replace(/(\d+)\.\d+/g, "$1");
  // Try to extract base name before country/region suffix
  // Pattern: name_XX where XX is a 2-letter country code
  const countryPattern = /^(.+?)[\s_]([A-Z]{2})$/i;
  const match = groupName.match(countryPattern);
  if (match) {
    return match[1].trim();
  }
  return groupName;
}

/**
 * Extract country/region from VSL name if present.
 * Examples:
 * - "VSL1_US" -> "US"
 * - "VSL2_UK" -> "UK"
 * - "VSL3" -> null
 */
export function extractCountry(name: string): string | null {
  const countryPattern = /[\s_]([A-Z]{2})$/i;
  const match = name.trim().match(countryPattern);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Check if two VSL names match (are considered the same VSL).
 */
export function vslNamesMatch(name1: string, name2: string): boolean {
  return normalizeVslName(name1) === normalizeVslName(name2);
}

/**
 * Find the best matching VSL name from a list of candidates.
 * Returns the matching name or null if no match found.
 */
export function findBestMatch(targetName: string, candidates: string[]): string | null {
  const normalizedTarget = normalizeVslName(targetName);
  
  // Exact normalized match
  for (const candidate of candidates) {
    if (normalizeVslName(candidate) === normalizedTarget) {
      return candidate;
    }
  }
  
  // Partial match: check if one contains the other
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeVslName(candidate);
    if (normalizedCandidate.includes(normalizedTarget) || normalizedTarget.includes(normalizedCandidate)) {
      return candidate;
    }
  }
  
  return null;
}
