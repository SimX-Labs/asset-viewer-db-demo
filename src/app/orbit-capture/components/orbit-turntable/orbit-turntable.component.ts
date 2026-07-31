// orbit-turntable.component.ts
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OrbitCaptureBundle } from '../../models/orbit-manifest';
import {
  ORBIT_BASE_PHI,
  ORBIT_BASE_THETA,
  OrbitSessionState,
} from '../../services/orbit-session-state';

type ViewMode = 'orbit' | 'model';

@Component({
  selector: 'app-orbit-turntable',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (showToolbar) {
    <div class="toolbar">
      @if (hasCarousel) {
        <div class="group">
          <span class="group-label">Turntable</span>
          <button type="button" [class.active]="mode() === 'orbit'" (click)="setMode('orbit')">Orbit</button>
        </div>
      }
      @if (bundle.modelUrl) {
        <div class="group">
          <span class="group-label">Model</span>
          <button type="button" [class.active]="mode() === 'model'" (click)="setMode('model')">3D Model</button>
        </div>
      }
      <span class="status">{{ status() }}</span>
    </div>
    }
    <div class="viewport-shell">
      @if (mode() === 'model' || showExpandButton) {
        <div class="viewer-controls" (pointerdown)="$event.stopPropagation()">
          @if (mode() === 'model') {
            <input
              type="range"
              class="spin-slider"
              min="1"
              max="8"
              step="0.1"
              [value]="autoSpinSpeed()"
              [disabled]="!autoSpin()"
              title="Auto-spin speed"
              aria-label="Auto-spin speed"
              (input)="onSpinSpeedInput($event)"
            />
            <button
              type="button"
              class="viewer-btn"
              [class.active]="autoSpin()"
              [title]="autoSpin() ? 'Pause auto-spin' : 'Resume auto-spin'"
              [attr.aria-pressed]="autoSpin()"
              (click)="toggleAutoSpin()"
            ><i class="pi" [class.pi-pause]="autoSpin()" [class.pi-play]="!autoSpin()" aria-hidden="true"></i></button>
          }
          @if (showExpandButton) {
            <button
              type="button"
              class="viewer-btn"
              [title]="expanded ? 'Exit expanded view' : 'Expand in detail panel'"
              (click)="expand.emit()"
            ><i class="pi" [class.pi-times]="expanded" [class.pi-expand]="!expanded" aria-hidden="true"></i></button>
          }
        </div>
      }
      <div #host class="viewport" tabindex="0" [class.grab]="mode() !== 'model'"></div>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 200px;
      }
      .toolbar {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 8px 0;
        flex-wrap: wrap;
      }
      .group {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .group-label {
        font-size: var(--text-caption, 12px);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-muted, #6b7280);
        margin-right: 2px;
      }
      .toolbar button {
        font: inherit;
        padding: 4px 12px;
        border: 1px solid var(--border, #ccc);
        border-radius: var(--radius-default, 4px);
        background: var(--bg-input, #fff);
        color: var(--text-main, #18171d);
        cursor: pointer;
      }
      .toolbar button:hover:not(:disabled) {
        background: var(--bg-hover, rgba(0, 124, 192, 0.08));
      }
      .toolbar button.active {
        background: var(--accent, #007cc0);
        border-color: var(--accent, #007cc0);
        color: rgba(255, 255, 255, 0.95);
      }
      .toolbar button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .status {
        margin-left: auto;
        font-size: var(--text-caption, 12px);
        color: var(--text-muted, #6b7280);
        font-family: var(--font-mono, monospace);
      }
      .viewport-shell {
        position: relative;
        flex: 1;
        min-height: 180px;
        display: flex;
        flex-direction: column;
      }
      .viewport {
        flex: 1;
        min-height: 180px;
        touch-action: none;
        border-radius: var(--radius-default, 4px);
        overflow: hidden;
        outline: none;
      }
      .viewport.grab {
        cursor: grab;
      }
      .viewport.grab:active {
        cursor: grabbing;
      }
      .viewer-controls {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 2;
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 3px 4px;
        border-radius: 6px;
        background: rgba(0, 0, 0, 0.22);
        opacity: 0.72;
        transition: opacity 0.15s ease, background 0.15s ease;
      }
      .viewer-controls:hover,
      .viewer-controls:focus-within {
        opacity: 1;
        background: rgba(0, 0, 0, 0.38);
      }
      .viewer-btn {
        width: 22px;
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: rgba(255, 255, 255, 0.88);
        cursor: pointer;
        flex-shrink: 0;
        padding: 0;
      }
      .viewer-btn .pi {
        font-size: 11px;
        line-height: 1;
        color: inherit;
      }
      .viewer-btn:hover,
      .viewer-btn.active {
        background: rgba(255, 255, 255, 0.14);
        color: #fff;
      }
      .spin-slider {
        width: 56px;
        height: 22px;
        margin: 0;
        padding: 0 2px;
        border: none;
        border-radius: 0;
        background: transparent;
        accent-color: rgba(255, 255, 255, 0.85);
        cursor: pointer;
        box-sizing: border-box;
        opacity: 0.9;
      }
      .spin-slider:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }
    `,
  ],
})
export class OrbitTurntableComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;
  @Input({ required: true }) bundle!: OrbitCaptureBundle;
  /** Start in 3D model mode when a model exists, even if carousel frames are present. */
  @Input() preferModel = false;
  /** Hide the mode toolbar (compact embeds). */
  @Input() showToolbar = true;
  /** Show a fullscreen/expand control in the overlay (inline embeds). */
  @Input() showExpandButton = false;
  /** Whether the inline viewer is currently expanded within the detail panel. */
  @Input() expanded = false;
  @Output() expand = new EventEmitter<void>();

  private readonly session = inject(OrbitSessionState);

  readonly status = signal('');
  readonly mode = signal<ViewMode>('orbit');
  /** Whether the model auto-rotates around the target (model mode only). */
  readonly autoSpin = signal(this.session.autoSpin);
  /** OrbitControls autoRotateSpeed (≈2 ≈ 30°/s at 60fps). */
  readonly autoSpinSpeed = signal(this.session.autoSpinSpeed);

  /** Whether this capture has yaw carousel frames (optional now). */
  get hasCarousel(): boolean {
    return (this.bundle?.yawUrls?.length ?? 0) > 0;
  }

  private initialized = false;
  private yawIndex = 0;
  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private material?: THREE.MeshBasicMaterial;
  private plane?: THREE.Mesh;
  private raf = 0;
  private cache = new Map<string, THREE.Texture>();
  private loader = new THREE.TextureLoader();
  private dragAcc = 0;
  private lastX = 0;
  private dragging = false;
  private ro?: ResizeObserver;
  private readonly spherical = new THREE.Spherical();
  private readonly offset = new THREE.Vector3();

  // --- 3D model ---
  private controls?: OrbitControls;
  private modelRoot?: THREE.Group;
  private modelLoaded = false;
  private modelLoading = false;
  private modelFitDistance = 3;
  private lights?: THREE.Group;
  private onControlsStart = (): void => {
    // Manual orbit/zoom/pan: stop spinning and mark session dirty so the next
    // asset resets to baseline framing (even if auto-spin is turned back on).
    this.session.userOrbitDirty = true;
    if (this.autoSpin()) this.setAutoSpin(false);
  };

  toggleAutoSpin(): void {
    this.setAutoSpin(!this.autoSpin());
  }

  onSpinSpeedInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) return;
    this.setAutoSpinSpeed(value);
  }

  /** Toggle continuous yaw spin in model mode. */
  setAutoSpin(on: boolean): void {
    this.autoSpin.set(on);
    this.session.autoSpin = on;
    if (this.controls) this.controls.autoRotate = on;
  }

  /** Set spin rate (OrbitControls units; typical range 1–8). */
  setAutoSpinSpeed(speed: number): void {
    const clamped = Math.max(0.1, Math.min(8, speed));
    this.autoSpinSpeed.set(clamped);
    this.session.autoSpinSpeed = clamped;
    if (this.controls) this.controls.autoRotateSpeed = clamped;
  }

  ngAfterViewInit(): void {
    const el = this.host.nativeElement;
    this.scene = new THREE.Scene();
    // No scene background in either mode — the renderer clears to a translucent
    // black so the viewport reads as a darker shade of the panel behind it.
    this.scene.background = null;
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    this.camera.position.set(0, 0, 2.4);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0.3);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    // Make the canvas fill the viewport (setSize below only sizes the buffer).
    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    el.appendChild(canvas);

    // Image plane (turntable modes). transparent:true honors the PNG alpha channel
    // (captures clear to backgroundColor RGB with alpha 0, so without this the
    // transparent pixels render as an opaque grey square).
    this.material = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false });
    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), this.material);
    this.scene.add(this.plane);

    // Lights for the 3D model (ignored by the unlit plane material).
    this.lights = new THREE.Group();
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 5, 4);
    const fill = new THREE.DirectionalLight(0xffffff, 1.0);
    fill.position.set(-4, 1, -2);
    this.lights.add(new THREE.AmbientLight(0xffffff, 0.9), key, fill);
    this.lights.visible = false;
    this.scene.add(this.lights);

    // OrbitControls, only active in model mode. Auto-spin starts on by default.
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enabled = false;
    this.controls.autoRotate = this.autoSpin();
    this.controls.autoRotateSpeed = this.autoSpinSpeed();
    this.controls.addEventListener('start', this.onControlsStart);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(el);
    this.resize();
    this.bindPointer(el);
    this.applyInitialMode();

    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      if (this.controls?.enabled) this.controls.update();
      this.renderer!.render(this.scene!, this.camera!);
    };
    tick();
    this.initialized = true;
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Reused across captures (e.g. library browser): reset when the input swaps.
    if (this.initialized && changes['bundle'] && !changes['bundle'].firstChange) {
      this.resetForNewBundle();
    }
  }

  /** Tear down per-capture GPU state and re-render for the new bundle. */
  private resetForNewBundle(): void {
    this.captureAzimuth();
    this.disposeModel();
    this.modelLoaded = false;
    this.modelLoading = false;
    this.cache.forEach((t) => t.dispose());
    this.cache.clear();
    this.yawIndex = 0;
    if (this.plane) this.plane.visible = true;
    if (this.lights) this.lights.visible = false;
    if (this.controls) this.controls.enabled = false;
    this.camera?.position.set(0, 0, 2.4);
    this.camera?.lookAt(0, 0, 0);
    this.applyInitialMode();
  }

  /** Choose the starting mode: model when preferred/only option, else the carousel. */
  private applyInitialMode(): void {
    const preferModel = (this.preferModel || !this.hasCarousel) && !!this.bundle.modelUrl;
    if (preferModel) {
      this.setMode('model');
    } else {
      this.mode.set('orbit');
      void this.showCurrent();
    }
  }

  ngOnDestroy(): void {
    this.captureAzimuth();
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.controls?.removeEventListener('start', this.onControlsStart);
    this.controls?.dispose();
    this.cache.forEach((t) => t.dispose());
    this.material?.dispose();
    (this.plane?.geometry as THREE.BufferGeometry | undefined)?.dispose();
    this.disposeModel();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }

  setMode(mode: ViewMode): void {
    if (mode === 'model' && !this.bundle.modelUrl) return;
    this.mode.set(mode);
    if (mode === 'model') {
      this.enterModelMode();
    } else {
      this.exitModelMode();
      void this.showCurrent();
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowLeft':
        this.stepYaw(-1);
        break;
      case 'ArrowRight':
        this.stepYaw(1);
        break;
      case 'o':
      case 'O':
        this.setMode('orbit');
        break;
      case 'm':
      case 'M':
        this.setMode('model');
        break;
      default:
        return;
    }
    e.preventDefault();
  }

  private stepYaw(delta: number): void {
    const n = this.bundle.yawUrls.length;
    if (!n) return;
    if (this.mode() === 'model') this.exitModelMode();
    this.mode.set('orbit');
    this.yawIndex = (this.yawIndex + delta + n) % n;
    void this.showCurrent();
  }

  private currentUrl(): string | undefined {
    return this.bundle.yawUrls[this.yawIndex];
  }

  private async showCurrent(): Promise<void> {
    const url = this.currentUrl();
    if (!url || !this.material) return;
    const tex = await this.loadTexture(url);
    this.material.map = tex;
    this.material.needsUpdate = true;
    const img = tex.image as { width?: number; height?: number };
    if (img?.width && img?.height && this.plane) {
      const aspect = img.width / img.height;
      this.plane.scale.set(aspect >= 1 ? aspect : 1, aspect >= 1 ? 1 : 1 / aspect, 1);
    }
    const step = this.bundle.manifest.stepDegrees ?? 15;
    const label = `yaw ${this.yawIndex}/${Math.max(this.bundle.yawUrls.length - 1, 0)} · ${this.yawIndex * step}°`;
    const key = this.bundle.manifest.addressableKey ?? '';
    this.status.set(key ? `${label} · ${key}` : label);
  }

  private loadTexture(url: string): Promise<THREE.Texture> {
    const hit = this.cache.get(url);
    if (hit) return Promise.resolve(hit);
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          this.cache.set(url, tex);
          resolve(tex);
        },
        undefined,
        reject,
      );
    });
  }

  // --- 3D model mode -------------------------------------------------------

  private enterModelMode(): void {
    if (this.plane) this.plane.visible = false;
    if (this.lights) this.lights.visible = true;
    if (this.controls) this.controls.enabled = true;
    const key = this.bundle.manifest.addressableKey ?? '';
    if (!this.modelLoaded && !this.modelLoading) {
      void this.loadModel();
    } else if (this.modelLoaded) {
      this.frameModel();
      this.status.set(key ? `3D model · ${key}` : '3D model');
    }
  }

  private exitModelMode(): void {
    if (this.plane) this.plane.visible = true;
    if (this.lights) this.lights.visible = false;
    if (this.controls) this.controls.enabled = false;
    if (this.modelRoot) this.modelRoot.visible = false;
    // Restore the fixed turntable camera.
    this.camera?.position.set(0, 0, 2.4);
    this.camera?.lookAt(0, 0, 0);
  }

  private async loadModel(): Promise<void> {
    const url = this.bundle.modelUrl;
    if (!url || !this.scene) return;
    this.modelLoading = true;
    this.status.set('Loading 3D model…');
    try {
      const gltf = await new GLTFLoader().loadAsync(url);
      const root = gltf.scene;
      this.modelRoot = root;
      this.scene.add(root);
      this.modelLoaded = true;
      this.frameModel();
      const key = this.bundle.manifest.addressableKey ?? '';
      this.status.set(key ? `3D model · ${key}` : '3D model');
    } catch (e) {
      console.error('[orbit-turntable] Failed to load GLB:', e);
      this.status.set('Failed to load 3D model.');
    } finally {
      this.modelLoading = false;
    }
  }

  /** Center the model at the origin and position the camera to frame it. */
  private frameModel(): void {
    if (!this.modelRoot || !this.camera || !this.controls) return;
    this.modelRoot.visible = true;
    // Reset any prior recenter offset before measuring.
    this.modelRoot.position.set(0, 0, 0);
    const box = new THREE.Box3().setFromObject(this.modelRoot);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    this.modelRoot.position.sub(center); // recenter to origin

    const radius = Math.max(size.x, size.y, size.z) * 0.5 || 1;
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const distance = (radius / Math.sin(fov / 2)) * 1.4;
    this.modelFitDistance = distance;

    this.camera.near = Math.max(distance / 1000, 0.001);
    this.camera.far = distance * 1000;

    // Keep spinning azimuth when browsing assets; after a manual orbit, the next
    // model snaps back to baseline (then browsing can stay in sync again).
    let theta = this.session.azimuth ?? ORBIT_BASE_THETA;
    if (this.session.userOrbitDirty) {
      theta = ORBIT_BASE_THETA;
      this.session.userOrbitDirty = false;
    }
    this.camera.position.setFromSphericalCoords(distance, ORBIT_BASE_PHI, theta);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    this.session.azimuth = theta;

    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = distance * 0.2;
    this.controls.maxDistance = distance * 5;
    this.controls.autoRotate = this.autoSpin();
    this.controls.autoRotateSpeed = this.autoSpinSpeed();
    this.controls.update();
  }

  /** Persist current yaw so the next asset can continue from the same angle. */
  private captureAzimuth(): void {
    if (!this.camera || !this.controls || this.mode() !== 'model') return;
    this.offset.subVectors(this.camera.position, this.controls.target);
    if (this.offset.lengthSq() < 1e-10) return;
    this.spherical.setFromVector3(this.offset);
    this.session.azimuth = this.spherical.theta;
  }

  private disposeModel(): void {
    if (!this.modelRoot) return;
    this.modelRoot.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    });
    this.scene?.remove(this.modelRoot);
    this.modelRoot = undefined;
  }

  private resize(): void {
    const el = this.host.nativeElement;
    const w = el.clientWidth || 1;
    const h = el.clientHeight || 1;
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  private bindPointer(el: HTMLElement): void {
    el.addEventListener('pointerdown', (e) => {
      if (this.mode() === 'model') return; // OrbitControls handles model drag
      this.dragging = true;
      this.lastX = e.clientX;
      this.dragAcc = 0;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointerup', () => (this.dragging = false));
    el.addEventListener('pointercancel', () => (this.dragging = false));
    el.addEventListener('pointermove', (e) => {
      if (!this.dragging || this.mode() === 'model') return;
      const dx = e.clientX - this.lastX;
      this.lastX = e.clientX;
      this.dragAcc += dx;
      const threshold = 12;
      while (this.dragAcc >= threshold) {
        this.dragAcc -= threshold;
        this.stepYaw(1);
      }
      while (this.dragAcc <= -threshold) {
        this.dragAcc += threshold;
        this.stepYaw(-1);
      }
    });
  }
}
