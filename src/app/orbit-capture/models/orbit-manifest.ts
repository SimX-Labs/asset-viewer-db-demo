// models/orbit-manifest.ts

/** One state of a tool's ToolStateController, as GLB node ids visible while it is selected. */
export interface OrbitToolState {
  name: string;
  visibleNodeIds: string[];
}

/**
 * Optional metadata describing the first root-level ToolStateController on a captured tool.
 * Present only when the exported tool has a qualifying controller; lets the viewer reproduce
 * the controller's show/hide logic against a single multi-state GLB.
 */
export interface OrbitToolStateController {
  /** The controller's metadata StateKey (e.g. "state"). */
  key: string;
  /** State selected on load (controller default, else the first state). */
  defaultState: string;
  /** Every GLB node id the controller toggles (union of all states' show objects). */
  managedNodeIds: string[];
  /** Ordered states; each lists the node ids visible while it is selected. */
  states: OrbitToolState[];
}

/** One independently toggleable container from a Unity VesselContainerObject. */
export interface OrbitVesselContainer {
  id: string;
  defaultOpen: boolean;
  /** False for permanent anchors such as an open "outside" container with no visual variants. */
  toggleable: boolean;
  parentContainerId?: string;
  incompatibleContainerIds: string[];
  contentsNodeId?: string;
  shownNodeIds: string[];
  hiddenNodeIds: string[];
}

/** Optional root-level VesselContainerObject metadata for a multi-container GLB. */
export interface OrbitVesselContainers {
  managedNodeIds: string[];
  containers: OrbitVesselContainer[];
}

/** One customization packet applied when reconstructing a custom vessel. */
export interface OrbitCustomVesselCustomization {
  key: string;
  type: string;
  value: string;
}

/** One saved tool reconstructed inside a custom-vessel container. */
export interface OrbitCustomVesselTool {
  assetAddress: string;
  toolId?: string;
  containerState?: string;
}

/** Saved tools grouped exactly as authored under a vessel container/state. */
export interface OrbitCustomVesselToolGroup {
  containerState: string;
  tools: OrbitCustomVesselTool[];
}

/**
 * Optional provenance and authored contents for a reconstructed custom vessel.
 * Present only on custom-vessel captures; ordinary tool captures omit this block.
 */
export interface OrbitCustomVesselMetadata {
  vesselId: string;
  displayName?: string;
  /** Empty vessel addressable this custom vessel is based on. */
  baseAddressable: string;
  appliedCustomizationPackets?: OrbitCustomVesselCustomization[];
  toolsByContainer?: OrbitCustomVesselToolGroup[];
}

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
  /** Optional tool-state controller metadata for multi-state models. */
  toolStateController?: OrbitToolStateController;
  /** Optional independent open/closed controls from a root-level VesselContainerObject. */
  vesselContainers?: OrbitVesselContainers;
  /** Optional custom-vessel identity, customization, and exact composition. */
  customVessel?: OrbitCustomVesselMetadata;
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
