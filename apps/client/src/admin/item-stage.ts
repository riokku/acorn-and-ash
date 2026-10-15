import * as THREE from 'three/webgpu';
import type { ItemId } from '@acorn/shared';
import { createItemModel, type ItemModel } from './item-model';

/** One renderer for the whole editor, redrawn only when the model, view or canvas changes. */
export class ItemStage {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  private readonly pivot = new THREE.Group();
  private model: ItemModel | null = null;
  private generation = 0;
  private disposed = false;
  private frame: number | null = null;
  private yaw = -0.35;
  private pitch = 0.12;
  private drag: { id: number; x: number; y: number } | null = null;
  private readonly resizeObserver: ResizeObserver;
  private readonly cleanups: (() => void)[] = [];

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly renderer: THREE.WebGPURenderer,
  ) {
    this.scene.add(this.pivot, new THREE.HemisphereLight(0xfff9e8, 0x67755b, 2.5));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(3, 4, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xd5e7ed, 1.5);
    rim.position.set(-3, 1, -2);
    this.scene.add(rim);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.listen('pointerdown', (event) => {
      if (event.button !== 0) return;
      this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
      canvas.focus();
    });
    this.listen('pointermove', (event) => {
      if (this.drag?.id !== event.pointerId) return;
      this.yaw += (event.clientX - this.drag.x) * 0.012;
      this.pitch = Math.max(-1, Math.min(1, this.pitch + (event.clientY - this.drag.y) * 0.008));
      this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      this.redraw();
    });
    const release = () => {
      this.drag = null;
    };
    this.listen('pointerup', release);
    this.listen('pointercancel', release);
    this.listen('lostpointercapture', release);
    this.listen('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Home') {
        this.reset();
        return;
      }
      this.yaw += event.key === 'ArrowLeft' ? -0.15 : event.key === 'ArrowRight' ? 0.15 : 0;
      this.pitch = Math.max(
        -1,
        Math.min(
          1,
          this.pitch + (event.key === 'ArrowUp' ? -0.15 : event.key === 'ArrowDown' ? 0.15 : 0),
        ),
      );
      this.redraw();
    });
    const visible = () => {
      if (!document.hidden) this.redraw();
    };
    document.addEventListener('visibilitychange', visible);
    this.cleanups.push(() => document.removeEventListener('visibilitychange', visible));
    this.resize();
  }
  static async open(canvas: HTMLCanvasElement): Promise<ItemStage> {
    // Use the same Three renderer with its WebGL backend for a small, independent inspector.
    const renderer = new THREE.WebGPURenderer({
      canvas,
      antialias: true,
      alpha: true,
      forceWebGL: true,
    });
    try {
      await renderer.init();
      renderer.setClearColor(0, 0);
      return new ItemStage(canvas, renderer);
    } catch (error) {
      renderer.dispose();
      throw error;
    }
  }
  async show(item: ItemId): Promise<boolean> {
    const request = ++this.generation;
    this.clear();
    const model = await createItemModel(item);
    if (this.disposed || request !== this.generation) {
      model.dispose();
      return false;
    }
    const box = new THREE.Box3().setFromObject(model.group);
    if (box.isEmpty()) {
      model.dispose();
      throw new Error('No item surfaces');
    }
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    model.group.position.copy(sphere.center).negate().divideScalar(sphere.radius);
    model.group.scale.setScalar(1 / sphere.radius);
    this.model = model;
    this.pivot.add(model.group);
    this.canvas.dataset.item = item;
    this.reset();
    return true;
  }
  reset(): void {
    this.yaw = -0.35;
    this.pitch = 0.12;
    this.redraw();
  }
  private clear(): void {
    this.model?.group.removeFromParent();
    this.model?.dispose();
    this.model = null;
    delete this.canvas.dataset.item;
    this.redraw();
  }
  private resize(): void {
    if (this.disposed) return;
    const width = Math.max(1, this.canvas.clientWidth),
      height = Math.max(1, this.canvas.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    const vertical = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const half = Math.min(vertical, Math.atan(Math.tan(vertical) * this.camera.aspect));
    this.camera.position.set(0, 0, 1.18 / Math.sin(half));
    this.camera.updateProjectionMatrix();
    this.redraw();
  }
  private redraw(): void {
    if (this.disposed || this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      if (this.disposed || document.hidden) return;
      this.pivot.rotation.set(this.pitch, this.yaw, 0);
      this.renderer.render(this.scene, this.camera);
      this.canvas.dataset.yaw = this.yaw.toFixed(3);
    });
  }
  private listen<K extends keyof HTMLElementEventMap>(
    name: K,
    handler: (event: HTMLElementEventMap[K]) => void,
  ): void {
    this.canvas.addEventListener(name, handler);
    this.cleanups.push(() => this.canvas.removeEventListener(name, handler));
  }
  dispose(): void {
    this.disposed = true;
    ++this.generation;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    for (const cleanup of this.cleanups) cleanup();
    this.clear();
    this.renderer.dispose();
  }
}
