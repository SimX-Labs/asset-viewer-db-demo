import { centeredCanvasTextOrigin, clusterCountFontSize } from './canvas-text.util';

describe('centeredCanvasTextOrigin', () => {
  it('shifts down when the glyph has more ascent than descent', () => {
    const origin = centeredCanvasTextOrigin(0, 0, {
      width: 10,
      actualBoundingBoxLeft: 1,
      actualBoundingBoxRight: 9,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
    });
    expect(origin.x).toBe(-4);
    expect(origin.y).toBe(3);
  });

  it('leaves a symmetric glyph on the given center', () => {
    const origin = centeredCanvasTextOrigin(20, 10, {
      width: 8,
      actualBoundingBoxLeft: 4,
      actualBoundingBoxRight: 4,
      actualBoundingBoxAscent: 5,
      actualBoundingBoxDescent: 5,
    });
    expect(origin).toEqual({ x: 20, y: 10 });
  });

  it('falls back to advance width when the glyph box is missing', () => {
    expect(centeredCanvasTextOrigin(10, 5, { width: 8 })).toEqual({ x: 6, y: 5 });
  });
});

describe('clusterCountFontSize', () => {
  it('keeps single digits larger than two-digit counts', () => {
    expect(clusterCountFontSize(32, 2)).toBeGreaterThan(clusterCountFontSize(32, 12));
  });

  it('never drops below a readable floor', () => {
    expect(clusterCountFontSize(4, 2)).toBe(8);
  });
});
