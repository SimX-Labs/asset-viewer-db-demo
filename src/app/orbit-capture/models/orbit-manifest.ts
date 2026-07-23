// models/orbit-manifest.ts

/** Raw manifest.json written by the Unity Orbit Capture pipeline. */
export interface OrbitCaptureManifest {
  addressableKey?: string;
  distance?: number;
  fov?: number;
  stepDegrees?: number;
  width?: number;
  height?: number;
  backgroundColor?: string;
  images: string[];
  top?: string;
  bottom?: string;
  /** Optional GLB filename in the same folder (e.g. "model.glb"). */
  model?: string;
}

/** Resolved in-memory capture ready for the turntable. */
export interface OrbitCaptureBundle {
  manifest: OrbitCaptureManifest;
  /** Parallel to manifest.images — object URLs or https URLs */
  yawUrls: string[];
  topUrl?: string;
  bottomUrl?: string;
  /** Object/https URL to the GLB model, when the capture includes one. */
  modelUrl?: string;
  /** Call on close to avoid leaks when using blob: URLs */
  revoke: () => void;
}
