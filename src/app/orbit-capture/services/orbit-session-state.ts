import { Injectable, signal } from '@angular/core';

/** Baseline elevated 3/4 framing (matches turntable frameModel). */
export const ORBIT_BASE_PHI = Math.PI / 2 - 0.5;
export const ORBIT_BASE_THETA = Math.PI / 4;

/**
 * Cross-viewer session for the 3D model camera. Survives turntable recreate when
 * clicking through assets in the inline viewer.
 */
@Injectable({ providedIn: 'root' })
export class OrbitSessionState {
  autoSpin = true;
  autoSpinSpeed = 2.25;
  /** Last camera azimuth (theta). Restored when browsing without manual orbit. */
  azimuth: number | null = null;
  /**
   * User manually orbited/zoomed/panned. Next model frames at baseline, then
   * this clears so subsequent browse-through can keep spinning in sync again.
   */
  userOrbitDirty = false;
  /**
   * Inline viewer expanded to fill the detail panel (asset list stays usable).
   * Survives asset switches so browsing in expanded mode keeps working.
   */
  readonly panelExpanded = signal(false);
}
