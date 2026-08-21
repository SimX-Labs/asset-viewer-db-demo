import { Injectable, computed, signal } from '@angular/core';
import {
  OrbitCaptureManifest,
  OrbitToolStateController,
  OrbitVesselContainer,
  OrbitVesselContainers,
} from '../models/orbit-manifest';
import { resolveDefaultStateName } from '../models/tool-state';
import { resolveDefaultOpenContainers, setVesselContainerOpen } from '../models/vessel-containers';

/**
 * Current tool-state / vessel-container selection for one model viewer.
 *
 * Split out of the turntable so surrounding UI (the detail panel list) can drive
 * the same selection the renderer applies. Provided at the root for standalone
 * viewers, and re-provided by any component that hosts its own viewer so two
 * viewers on screen at once do not share one selection.
 */
@Injectable({ providedIn: 'root' })
export class OrbitModelControlsService {
  readonly controller = signal<OrbitToolStateController | null>(null);
  readonly containers = signal<OrbitVesselContainers | null>(null);
  /** Currently applied tool state name ('' when the model has no states). */
  readonly selectedState = signal<string>('');
  /** Canonical ids of the containers currently open. */
  readonly openContainerIds = signal<ReadonlySet<string>>(new Set<string>());

  readonly states = computed(() => this.controller()?.states ?? []);
  readonly containerOptions = computed(() => this.containers()?.containers ?? []);
  readonly hasControls = computed(
    () => this.states().length > 0 || this.containerOptions().length > 0,
  );
  readonly openContainerCount = computed(
    () =>
      this.containerOptions().filter((c) => c.toggleable && this.isContainerOpen(c.id)).length,
  );
  readonly toggleableContainerCount = computed(
    () => this.containerOptions().filter((c) => c.toggleable).length,
  );

  /** Adopt a capture's manifest controls and reset the selection to its defaults. */
  load(manifest: OrbitCaptureManifest | null | undefined): void {
    const controller = manifest?.toolStateController ?? null;
    const hasStates = !!controller?.states?.length;
    this.controller.set(hasStates ? controller : null);
    this.selectedState.set(hasStates ? resolveDefaultStateName(controller) : '');

    const containers = manifest?.vesselContainers ?? null;
    const hasContainers = !!containers?.containers?.length;
    this.containers.set(hasContainers ? containers : null);
    this.openContainerIds.set(resolveDefaultOpenContainers(hasContainers ? containers : null));
  }

  selectState(name: string): void {
    if (!this.states().some((s) => s.name === name)) return;
    this.selectedState.set(name);
  }

  /** The controller's declared default, falling back to the state actually selected on load. */
  isDefaultState(name: string): boolean {
    return name === resolveDefaultStateName(this.controller());
  }

  isContainerOpen(id: string): boolean {
    const wanted = id.toLocaleLowerCase();
    return [...this.openContainerIds()].some((open) => open.toLocaleLowerCase() === wanted);
  }

  setContainerOpen(container: OrbitVesselContainer, open: boolean): void {
    this.openContainerIds.set(
      setVesselContainerOpen(this.containers(), this.openContainerIds(), container.id, open),
    );
  }

  /**
   * Containers with no visual difference between open and closed are permanent
   * anchors in Unity, so they read as always open and cannot be toggled here.
   */
  toggleContainer(container: OrbitVesselContainer): void {
    if (!container.toggleable) return;
    this.setContainerOpen(container, !this.isContainerOpen(container.id));
  }
}
