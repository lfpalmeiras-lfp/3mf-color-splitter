import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Dimensions, ModelPart, Projection, ViewName } from '../types/model';

// Convenção de impressão 3D: Z para cima. Definido antes de criar câmeras/objetos.
THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

/** Direção da câmera (do alvo para a câmera) em cada vista. */
const VIEW_DIRECTIONS: Record<ViewName, THREE.Vector3> = {
  front: new THREE.Vector3(0, -1, 0),
  back: new THREE.Vector3(0, 1, 0),
  left: new THREE.Vector3(-1, 0, 0),
  right: new THREE.Vector3(1, 0, 0),
  // Pequeno desvio em Y evita a singularidade do OrbitControls com up = Z.
  top: new THREE.Vector3(0, -0.0001, 1),
  bottom: new THREE.Vector3(0, -0.0001, -1),
  iso: new THREE.Vector3(1, -1, 0.9),
};

const FOV_DEG = 45;

/**
 * Encapsula toda a lógica Three.js. Não depende de React:
 * o componente Viewer apenas cria, comanda e destrói esta classe.
 */
export class SceneController {
  onDimensions?: (d: Dimensions | null) => void;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private persp: THREE.PerspectiveCamera;
  private ortho: THREE.OrthographicCamera;
  private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private controls: OrbitControls;
  private root = new THREE.Group();
  private meshes = new Map<string, THREE.Mesh>();
  private grid: THREE.GridHelper | null = null;
  private box = new THREE.Box3();
  private hasModel = false;
  private raf = 0;
  private resizeObserver: ResizeObserver;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x13161b);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';

    this.persp = new THREE.PerspectiveCamera(FOV_DEG, 1, 0.1, 5000);
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -5000, 5000);
    this.persp.up.set(0, 0, 1);
    this.ortho.up.set(0, 0, 1);
    this.camera = this.persp;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;

    // Iluminação: hemisférica + duas direcionais para leitura de forma.
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4150, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(80, -120, 160);
    const fill = new THREE.DirectionalLight(0xffffff, 0.4);
    fill.position.set(-100, 80, 40);
    this.scene.add(key, fill);

    this.scene.add(this.root);
    this.scene.add(new THREE.AxesHelper(20));
    this.buildGrid(200, 0, 0, 0);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.setView('iso');

    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  /** Substitui o modelo exibido. As geometrias pertencem ao chamador. */
  setModel(parts: ModelPart[]): void {
    this.clearModel();
    for (const part of parts) {
      const mat = new THREE.MeshStandardMaterial({
        color: part.color,
        roughness: 0.55,
        metalness: 0.05,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(part.geometry, mat);
      mesh.name = part.name;
      this.root.add(mesh);
      this.meshes.set(part.id, mesh);
    }
    this.hasModel = parts.length > 0;
    if (!this.hasModel) {
      this.buildGrid(200, 0, 0, 0);
      this.onDimensions?.(null);
      this.setView('iso');
      return;
    }
    this.box.setFromObject(this.root);
    const size = this.box.getSize(new THREE.Vector3());
    const c = this.box.getCenter(new THREE.Vector3());
    this.buildGrid(Math.max(size.x, size.y, 50) * 2.5, c.x, c.y, this.box.min.z);
    this.onDimensions?.({ x: size.x, y: size.y, z: size.z });
    this.setView('iso');
  }

  setPartVisible(id: string, visible: boolean): void {
    const m = this.meshes.get(id);
    if (m) m.visible = visible;
  }

  setProjection(projection: Projection): void {
    const next = projection === 'perspective' ? this.persp : this.ortho;
    if (next === this.camera) return;
    next.position.copy(this.camera.position);
    next.up.set(0, 0, 1);
    this.camera = next;
    this.controls.object = next;
    this.updateOrtho();
    this.controls.update();
  }

  /** Posiciona a câmera numa das vistas, enquadrando o modelo. */
  setView(view: ViewName): void {
    const { center, radius } = this.bounds();
    const dist = (radius / Math.sin(THREE.MathUtils.degToRad(FOV_DEG / 2))) * 1.1;
    const dir = VIEW_DIRECTIONS[view].clone().normalize();
    this.controls.target.copy(center);
    for (const cam of [this.persp, this.ortho]) {
      cam.position.copy(center).addScaledVector(dir, dist);
      cam.up.set(0, 0, 1);
      cam.lookAt(center);
    }
    this.ortho.zoom = 1;
    this.updateOrtho();
    this.controls.update();
  }

  /** Recentraliza mantendo a direção atual de observação. */
  frame(): void {
    const { center, radius } = this.bounds();
    const dist = (radius / Math.sin(THREE.MathUtils.degToRad(FOV_DEG / 2))) * 1.1;
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.controls.target.copy(center);
    for (const cam of [this.persp, this.ortho]) {
      cam.position.copy(center).addScaledVector(dir, dist);
      cam.lookAt(center);
    }
    this.ortho.zoom = 1;
    this.updateOrtho();
    this.controls.update();
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.clearModel();
    this.grid?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ---- internos ----

  private bounds(): { center: THREE.Vector3; radius: number } {
    if (!this.hasModel) return { center: new THREE.Vector3(0, 0, 0), radius: 100 };
    const center = this.box.getCenter(new THREE.Vector3());
    const radius = Math.max(this.box.getSize(new THREE.Vector3()).length() / 2, 1);
    return { center, radius };
  }

  private clearModel(): void {
    for (const mesh of this.meshes.values()) {
      this.root.remove(mesh);
      (mesh.material as THREE.Material).dispose(); // geometria NÃO é descartada aqui
    }
    this.meshes.clear();
  }

  private buildGrid(size: number, cx: number, cy: number, z: number): void {
    if (this.grid) {
      this.scene.remove(this.grid);
      this.grid.dispose();
    }
    const step = 10; // 1 célula = 10 mm
    const divisions = Math.max(Math.round(size / step), 2);
    this.grid = new THREE.GridHelper(divisions * step, divisions, 0x5b6678, 0x2b323d);
    this.grid.rotateX(Math.PI / 2); // GridHelper nasce no plano XZ; queremos XY
    this.grid.position.set(cx, cy, z);
    this.scene.add(this.grid);
  }

  /** Ajusta o frustum ortográfico à distância atual da câmera ao alvo. */
  private updateOrtho(): void {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    const aspect = w / h;
    const dist = this.persp.position.distanceTo(this.controls.target) || 100;
    const halfH = dist * Math.tan(THREE.MathUtils.degToRad(FOV_DEG / 2));
    this.ortho.left = -halfH * aspect;
    this.ortho.right = halfH * aspect;
    this.ortho.top = halfH;
    this.ortho.bottom = -halfH;
    this.ortho.updateProjectionMatrix();
  }

  private resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h);
    this.persp.aspect = w / h;
    this.persp.updateProjectionMatrix();
    this.updateOrtho();
  }
}
