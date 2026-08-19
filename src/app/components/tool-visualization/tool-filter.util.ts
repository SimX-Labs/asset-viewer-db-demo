/** Alpha applied to map nodes that do not match the inspector search. */
export const FILTERED_NODE_ALPHA = 0.32;
/** Default fill/ring alpha on a bird's-eye so the capture shows through. */
export const OVERLAY_NODE_ALPHA = 0.4;

export function toolIdMatchesFilter(toolId: string, filter: string): boolean {
  const query = filter.trim().toLowerCase();
  return !query || toolId.toLowerCase().includes(query);
}

export function filterNodeAlpha(matches: boolean, matchedAlpha = 1): number {
  return matches ? matchedAlpha : FILTERED_NODE_ALPHA * matchedAlpha;
}

/**
 * When several tools share a hit, query matches come first so hover/selection
 * does not prefer a dimmed neighbor over a matching node.
 */
export function preferMatchingToolId(ids: string[], filter: string): string | null {
  if (!ids.length) return null;
  const query = filter.trim().toLowerCase();
  if (!query) return ids[0] ?? null;
  return ids.find((id) => id.toLowerCase().includes(query)) ?? ids[0] ?? null;
}

export function colorWithAlpha(color: string, alpha: number): string {
  if (alpha >= 1) return color;
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (!hex) return color;
  const n = hex[1];
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
