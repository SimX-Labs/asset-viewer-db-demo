/** Glyph box used to optically center canvas text. */
export interface CanvasGlyphMetrics {
  width: number;
  actualBoundingBoxLeft?: number;
  actualBoundingBoxRight?: number;
  actualBoundingBoxAscent?: number;
  actualBoundingBoxDescent?: number;
}

/**
 * Alignment point for `textAlign=left` + `textBaseline=alphabetic` so the
 * painted glyph — not the font em-box — is centered on (cx, cy).
 */
export function centeredCanvasTextOrigin(
  cx: number,
  cy: number,
  metrics: CanvasGlyphMetrics,
): { x: number; y: number } {
  const left = metrics.actualBoundingBoxLeft;
  const right = metrics.actualBoundingBoxRight;
  const ascent = metrics.actualBoundingBoxAscent;
  const descent = metrics.actualBoundingBoxDescent;
  if (left == null || right == null || ascent == null || descent == null) {
    return { x: cx - metrics.width / 2, y: cy };
  }
  return {
    x: cx + (left - right) / 2,
    y: cy + (ascent - descent) / 2,
  };
}

/** Font size that keeps a count inside a circled badge. */
export function clusterCountFontSize(innerDiameter: number, count: number): number {
  const digits = String(count).length;
  const ratio = digits > 1 ? 0.4 : 0.52;
  return Math.max(8, innerDiameter * ratio);
}
