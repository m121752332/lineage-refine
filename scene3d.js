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

function createCharacter(scene, color) {
  // SEAM: future character-selection replaces this primitive build with a GLB load + skeleton.
  const unit = TILE_PX * WORLD_SCALE;
  const root = new BABYLON.TransformNode('charRoot', scene);
  const mat = new BABYLON.StandardMaterial('charMat', scene); mat.diffuseColor = color; mat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
  const body = BABYLON.MeshBuilder.CreateCapsule('body', { radius: unit * 0.28, height: unit * 1.0 }, scene);
  body.position.y = unit * 0.7; body.material = mat; body.parent = root; body.isPickable = false;
  const head = BABYLON.MeshBuilder.CreateSphere('head', { diameter: unit * 0.42 }, scene);
  head.position.y = unit * 1.25; head.material = mat; head.parent = root; head.isPickable = false;
  const mkLeg = (sx) => { const l = BABYLON.MeshBuilder.CreateBox('leg', { width: unit*0.18, depth: unit*0.22, height: unit*0.5 }, scene); l.position.set(sx, unit*0.25, 0); l.material = mat; l.parent = root; l.isPickable = false; return l; };
  const legL = mkLeg(-unit * 0.16), legR = mkLeg(unit * 0.16);
  return { root, legL, legR, body, _t: 0 };
}

function buildLights(scene) {
  const amb = new BABYLON.HemisphericLight('amb', new BABYLON.Vector3(0, 1, 0), scene);
  amb.intensity = 0.18;                                  // dim base = dungeon dark
  amb.diffuse = new BABYLON.Color3(0.5, 0.45, 0.4);
  amb.groundColor = new BABYLON.Color3(0.05, 0.04, 0.03);
}
function addTorchLight(scene, X, Z, h) {
  const pl = new BABYLON.PointLight('torch', new BABYLON.Vector3(X, h, Z), scene);
  pl.diffuse = new BABYLON.Color3(1.0, 0.6, 0.25);       // warm orange
  pl.intensity = 0.9; pl.range = TILE_PX * WORLD_SCALE * 6;
  let t = Math.random() * 10;
  scene.onBeforeRenderObservable.add(() => { t += 0.08; pl.intensity = 0.8 + Math.sin(t) * 0.12; }); // flicker
  return pl;
}
function buildFireProps(scene) {
  const { cols, rows } = mapSize();
  const unit = TILE_PX * WORLD_SCALE;
  const flameMat = new BABYLON.StandardMaterial('flameMat', scene);
  flameMat.emissiveColor = new BABYLON.Color3(1, 0.5, 0.1); flameMat.disableLighting = true;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const ch = cellAt(c, r); if (ch !== 't' && ch !== 'C') continue;
    const { X, Z } = logicToWorld(c * TILE_PX + TILE_PX / 2, r * TILE_PX + TILE_PX / 2);
    const isFire = ch === 'C';
    const flame = BABYLON.MeshBuilder.CreateCylinder('flame', { diameterTop: 0, diameterBottom: isFire ? unit * 0.7 : unit * 0.25, height: isFire ? unit * 1.1 : unit * 0.7 }, scene);
    flame.position.set(X, (isFire ? unit * 0.55 : unit * 0.9), Z); flame.material = flameMat; flame.isPickable = false;
    if (!isFire) { const pole = BABYLON.MeshBuilder.CreateCylinder('pole', { diameter: unit * 0.12, height: unit * 1.2 }, scene); pole.position.set(X, unit * 0.6, Z); pole.isPickable = false; }
    addTorchLight(scene, X, isFire ? unit * 0.9 : unit * 1.3, Z);
  }
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
  buildLights(scene);
  buildFireProps(scene);

  const player = createCharacter(scene, new BABYLON.Color3(0.62, 0.66, 0.74)); // knight = steel/silver
  let _playerMoving = false, _playerFacing = 0;
  const _bodyBaseY = TILE_PX * WORLD_SCALE * 0.7;
  scene.onBeforeRenderObservable.add(() => {
    if (_playerMoving) { player._t += 0.25; const s = Math.sin(player._t) * 0.5; player.legL.rotation.x = s; player.legR.rotation.x = -s; player.body.position.y = _bodyBaseY + Math.abs(Math.sin(player._t)) * 0.02; }
    else { player.legL.rotation.x = 0; player.legR.rotation.x = 0; }
    player.root.rotation.y = _playerFacing;
  });

  const olin = createCharacter(scene, new BABYLON.Color3(0.16, 0.14, 0.12)); // dark robe
  olin.legL.setEnabled(false); olin.legR.setEnabled(false); // static NPC: no legs/animation
  const plate = new BABYLON.DynamicTexture('plate', { width: 256, height: 64 }, scene, false);
  plate.hasAlpha = true;
  plate.drawText('歐林【雜貨商】', null, 44, 'bold 28px sans-serif', '#f0d060', 'transparent', true);
  const plateMat = new BABYLON.StandardMaterial('plateMat', scene);
  plateMat.diffuseTexture = plate; plateMat.emissiveColor = new BABYLON.Color3(1, 1, 1); plateMat.opacityTexture = plate; plateMat.disableLighting = true; plateMat.backFaceCulling = false;
  const plateMesh = BABYLON.MeshBuilder.CreatePlane('plateMesh', { width: TILE_PX*WORLD_SCALE*2.6, height: TILE_PX*WORLD_SCALE*0.65 }, scene);
  plateMesh.material = plateMat; plateMesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL; plateMesh.isPickable = false;

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
    setPlayer: (x, y, moving) => {
      const { X, Z } = logicToWorld(x, y);
      if (moving) { const dx = X - player.root.position.x, dz = Z - player.root.position.z; if (dx || dz) _playerFacing = Math.atan2(dx, dz); }
      player.root.position.set(X, 0, Z); _playerMoving = !!moving;
    },
    setOlin: (x, y) => {
      const { X, Z } = logicToWorld(x, y);
      olin.root.position.set(X, 0, Z);
      plateMesh.position.set(X, TILE_PX * WORLD_SCALE * 1.9, Z);
    },
    dispose: () => engine.dispose(),
    _internals: { scene, engine, camera, BABYLON },
  };
}
