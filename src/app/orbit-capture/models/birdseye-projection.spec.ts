import {
  BirdsEyeManifest,
  isInsideCapture,
  parseBirdsEyeProjection,
  worldToGraphPoint,
  worldToImagePixel,
} from './birdseye-projection';

function manifest(overrides: Partial<BirdsEyeManifest> = {}): BirdsEyeManifest {
  return {
    authoringId: '275136-Waiting Room',
    image: 'birdseye.png',
    width: 1000,
    height: 500,
    worldCenter: { x: 2, y: 0, z: -3 },
    orthographicSize: 5,
    worldWidth: 20,
    worldHeight: 10,
    framedToolsOnly: false,
    ...overrides,
  };
}

describe('parseBirdsEyeProjection', () => {
  it('reads image size, framed world extents, and center', () => {
    const projection = parseBirdsEyeProjection(manifest())!;
    expect(projection.imageWidth).toBe(1000);
    expect(projection.imageHeight).toBe(500);
    expect(projection.worldWidth).toBe(20);
    expect(projection.worldHeight).toBe(10);
    expect(projection.centerX).toBe(2);
    expect(projection.centerZ).toBe(-3);
  });

  it('derives extents from orthographicSize and aspect when absent', () => {
    const projection = parseBirdsEyeProjection(
      manifest({ worldWidth: undefined, worldHeight: undefined }),
    )!;
    expect(projection.worldHeight).toBe(10);
    expect(projection.worldWidth).toBe(20);
  });

  it('returns null without usable image size or world extent', () => {
    expect(parseBirdsEyeProjection(null)).toBeNull();
    expect(parseBirdsEyeProjection(manifest({ width: 0 }))).toBeNull();
    expect(
      parseBirdsEyeProjection(
        manifest({ orthographicSize: undefined, worldWidth: undefined, worldHeight: undefined }),
      ),
    ).toBeNull();
  });
});

describe('worldToImagePixel', () => {
  const projection = parseBirdsEyeProjection(manifest())!;

  it('maps the framing center to the image center', () => {
    expect(worldToImagePixel(projection, { x: 2, z: -3 })).toEqual({ x: 500, y: 250 });
  });

  it('maps world +X right and world +Z up', () => {
    // +10m on X is the right edge; +5m on Z is the top edge.
    expect(worldToImagePixel(projection, { x: 12, z: -3 })).toEqual({ x: 1000, y: 250 });
    expect(worldToImagePixel(projection, { x: 2, z: 2 })).toEqual({ x: 500, y: 0 });
    expect(worldToImagePixel(projection, { x: 2, z: -8 })).toEqual({ x: 500, y: 500 });
  });

  it('scales each axis by its own metres-per-pixel', () => {
    // 50 px/m on both axes here (1000/20 and 500/10).
    expect(worldToImagePixel(projection, { x: 3, z: -2 })).toEqual({ x: 550, y: 200 });
  });
});

describe('worldToGraphPoint', () => {
  const projection = parseBirdsEyeProjection(manifest())!;

  it('centers the pixel space on the origin so the image draws behind the nodes', () => {
    expect(worldToGraphPoint(projection, { x: 2, z: -3 })).toEqual({ x: 0, y: 0 });
    expect(worldToGraphPoint(projection, { x: 12, z: 2 })).toEqual({ x: 500, y: -250 });
  });
});

describe('isInsideCapture', () => {
  const projection = parseBirdsEyeProjection(manifest())!;

  it('flags tools outside the captured footprint', () => {
    expect(isInsideCapture(projection, { x: 2, z: -3 })).toBeTrue();
    expect(isInsideCapture(projection, { x: 40, z: -3 })).toBeFalse();
    expect(isInsideCapture(projection, { x: 2, z: 40 })).toBeFalse();
  });
});
