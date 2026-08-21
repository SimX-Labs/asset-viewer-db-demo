// models/birdseye-projection.ts

/**
 * Authored-environment bird's-eye captures are straight-down orthographic renders, so world XZ maps
 * onto the image with a plain 2D transform: image right is world +X, image up is world +Z.
 */

interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

/** Raw birdseye.json written next to birdseye.png by the Unity export. */
export interface BirdsEyeManifest {
  authoringId?: string;
  environmentName?: string;
  /** PNG filename in the same folder. */
  image?: string;
  width?: number;
  height?: number;
  /** World point at the image center. */
  worldCenter?: Vector3Like;
  /** Half the framed extent along world +Z. */
  orthographicSize?: number;
  /** Full framed extent along world +X. */
  worldWidth?: number;
  /** Full framed extent along world +Z. */
  worldHeight?: number;
  cameraHeight?: number;
  /** True when level geometry dwarfed the tools and framing clamped to tools + margin. */
  framedToolsOnly?: boolean;
  framingBoundsMin?: Vector3Like;
  framingBoundsMax?: Vector3Like;
  capturedUtc?: string;
}

/** Validated projection ready for layout math. */
export interface BirdsEyeProjection {
  imageWidth: number;
  imageHeight: number;
  /** Framed world extent along +X, in metres. */
  worldWidth: number;
  /** Framed world extent along +Z, in metres. */
  worldHeight: number;
  centerX: number;
  centerZ: number;
  framedToolsOnly: boolean;
}

export interface Point2 {
  x: number;
  y: number;
}

/** A published authored-environment bird's-eye: the PNG plus its world-space projection. */
export interface BirdsEyeCapture {
  imageUrl: string;
  projection: BirdsEyeProjection;
  manifest: BirdsEyeManifest;
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Read a birdseye.json into a projection, deriving world extents from `orthographicSize` when the
 * explicit extents are missing. Returns null when the manifest cannot describe a real mapping.
 */
export function parseBirdsEyeProjection(
  manifest: BirdsEyeManifest | null | undefined,
): BirdsEyeProjection | null {
  if (!manifest) return null;

  const imageWidth = positive(manifest.width);
  const imageHeight = positive(manifest.height);
  if (!imageWidth || !imageHeight) return null;

  const orthoHeight = positive(manifest.orthographicSize)
    ? positive(manifest.orthographicSize)! * 2
    : null;
  const worldHeight = positive(manifest.worldHeight) ?? orthoHeight;
  const worldWidth =
    positive(manifest.worldWidth) ??
    (worldHeight ? worldHeight * (imageWidth / imageHeight) : null);
  if (!worldWidth || !worldHeight) return null;

  return {
    imageWidth,
    imageHeight,
    worldWidth,
    worldHeight,
    centerX: finiteOr(manifest.worldCenter?.x, 0),
    centerZ: finiteOr(manifest.worldCenter?.z, 0),
    framedToolsOnly: !!manifest.framedToolsOnly,
  };
}

/** Pixels from the image's top-left corner. */
export function worldToImagePixel(
  projection: BirdsEyeProjection,
  world: { x: number; z: number },
): Point2 {
  const u = (world.x - projection.centerX) / projection.worldWidth + 0.5;
  const v = 0.5 - (world.z - projection.centerZ) / projection.worldHeight;
  return { x: u * projection.imageWidth, y: v * projection.imageHeight };
}

/**
 * Graph coordinates for vis-network: image pixels with the origin at the image center and y growing
 * downward, so the image can be drawn at (-width/2, -height/2) and nodes land on top of it.
 */
export function worldToGraphPoint(
  projection: BirdsEyeProjection,
  world: { x: number; z: number },
): Point2 {
  const pixel = worldToImagePixel(projection, world);
  return {
    x: pixel.x - projection.imageWidth / 2,
    y: pixel.y - projection.imageHeight / 2,
  };
}

/** False for tools that sit outside the captured footprint (possible in tools+margin framing). */
export function isInsideCapture(
  projection: BirdsEyeProjection,
  world: { x: number; z: number },
): boolean {
  const pixel = worldToImagePixel(projection, world);
  return (
    pixel.x >= 0 &&
    pixel.x <= projection.imageWidth &&
    pixel.y >= 0 &&
    pixel.y <= projection.imageHeight
  );
}
