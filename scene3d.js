// scene3d.js — Babylon presentation layer (reads logic state, renders 2.5D iso scene)
// Babylon is loaded as a UMD global via <script src="https://cdn.babylonjs.com/babylon.js">
// in lineage.html (the full @babylonjs/core ESM bundle is unreliable/slow on CDNs).
const BABYLON = window.BABYLON;
import { mapSize, cellAt, logicToWorld, worldToLogic, WORLD_SCALE, TILE_PX } from './nav3d.js';

function stoneTexture(scene, base, name) {
  const t = new BABYLON.DynamicTexture(name, { width: 128, height: 128 }, scene, false);
  const ctx = t.getContext();
  ctx.fillStyle = base; ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 220; i++) { // speckle/crack noise -> gritty stone
    const x = Math.random() * 128, y = Math.random() * 128, a = Math.random() * 0.18;
    ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(x, y, 2, 2);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(Math.random()*128, Math.random()*128); ctx.lineTo(Math.random()*128, Math.random()*128); ctx.stroke(); }
  t.update();
  return t;
}

function buildLevel(scene) {
  const { cols, rows } = mapSize();
  const unit = TILE_PX * WORLD_SCALE;          // one tile in world units
  const wallH = unit * 1.6;
  const wallMat = new BABYLON.StandardMaterial('wallMat', scene);
  wallMat.diffuseTexture = stoneTexture(scene, '#3a2f24', 'wallTex');
  wallMat.specularColor = new BABYLON.Color3(0, 0, 0);
  const pillarMat = new BABYLON.StandardMaterial('pillarMat', scene);
  pillarMat.diffuseTexture = stoneTexture(scene, '#2c241b', 'pillarTex');
  pillarMat.specularColor = new BABYLON.Color3(0, 0, 0);

  const walls = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const ch = cellAt(c, r);
    const isWall = ch === '#', isPillar = ch === 'P';
    if (!isWall && !isPillar) continue;
    const { X, Z } = logicToWorld(c * TILE_PX + TILE_PX / 2, r * TILE_PX + TILE_PX / 2);
    const w = isPillar ? unit * 0.55 : unit;
    const box = BABYLON.MeshBuilder.CreateBox('w', { width: w, depth: w, height: wallH }, scene);
    box.position.set(X, wallH / 2, Z);
    box.material = isPillar ? pillarMat : wallMat;
    if (isWall) walls.push(box); else box.isPickable = false;
  }
  if (walls.length) { const merged = BABYLON.Mesh.MergeMeshes(walls, true, true, undefined, false, false); if (merged) merged.isPickable = false; }
}

const ISO_BETA = Math.PI * 60 / 180;   // 60° from +Y  => 30° elevation (classic iso feel)
const ISO_ALPHA = -Math.PI / 4;        // upper-left -> lower-right 45°

export function createScene(canvas, opts = {}) {
  const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true });
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.03, 0.02, 0.02, 1);

  const { widthPx, heightPx } = mapSize();
  const worldW = widthPx * WORLD_SCALE, worldH = heightPx * WORLD_SCALE;

  const camera = new BABYLON.ArcRotateCamera('cam', ISO_ALPHA, ISO_BETA, 60, BABYLON.Vector3.Zero(), scene);
  camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
  let orthoSize = Math.max(worldW, worldH) * 0.62;   // half-extent; smaller = zoomed in
  function applyOrtho() {
    const aspect = engine.getRenderWidth() / engine.getRenderHeight();
    camera.orthoTop = orthoSize; camera.orthoBottom = -orthoSize;
    camera.orthoLeft = -orthoSize * aspect; camera.orthoRight = orthoSize * aspect;
  }
  applyOrtho();
  camera.lowerBetaLimit = ISO_BETA; camera.upperBetaLimit = ISO_BETA; // pitch locked = always 2.5D

  function setCameraMode(mode) {
    camera.detachControl();
    if (mode === 'rotatable') camera.attachControl(canvas, true);
    else camera.alpha = ISO_ALPHA;
  }
  setCameraMode(opts.cameraMode || 'fixed');

  // wheel zoom in rotatable mode (ortho zoom adjusts extents, not radius)
  scene.onPointerObservable.add((p) => {
    if ((opts.cameraMode || 'fixed') !== 'rotatable') return;
    if (p.type === BABYLON.PointerEventTypes.POINTERWHEEL) {
      const e = p.event;
      orthoSize = Math.min(Math.max(orthoSize * (e.deltaY > 0 ? 1.1 : 0.9), worldH * 0.25), worldH * 1.2);
      applyOrtho();
    }
  });

  // Ground plane (sized to the map) — pickable for click-to-walk
  const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: worldW, height: worldH }, scene);
  const gmat = new BABYLON.StandardMaterial('gmat', scene);
  gmat.diffuseColor = new BABYLON.Color3(0.18, 0.14, 0.08);
  gmat.specularColor = new BABYLON.Color3(0, 0, 0);
  ground.material = gmat;

  buildLevel(scene);

  scene.onPointerObservable.add((p) => {
    if (p.type !== BABYLON.PointerEventTypes.POINTERPICK) return;
    const hit = scene.pick(scene.pointerX, scene.pointerY, (m) => m === ground);
    if (hit?.hit && opts.onGroundClick) {
      const { x, y } = worldToLogic(hit.pickedPoint.x, hit.pickedPoint.z);
      opts.onGroundClick(x, y);
    }
  });

  engine.runRenderLoop(() => scene.render());
  window.addEventListener('resize', () => { engine.resize(); applyOrtho(); });

  return {
    setCameraMode: (m) => { opts.cameraMode = m; setCameraMode(m); },
    setPlayer: () => {},
    setOlin: () => {},
    dispose: () => engine.dispose(),
    _internals: { scene, engine, camera, BABYLON },
  };
}
