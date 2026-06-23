// scene3d.js — Babylon presentation layer (reads logic state, renders 2.5D iso scene)
// Classic <script> (file:// friendly, no ES modules). Depends on globals:
//   - window.BABYLON (UMD build, <script src="https://cdn.babylonjs.com/babylon.js">)
//   - globalThis.Nav3D (nav3d.js, loaded before this file)
// These are read lazily when createScene() runs (in the app's onMounted), so the
// script load order between Babylon / nav3d / this file does not matter.
// Wrapped in an IIFE so top-level names stay private (shares global scope with
// nav3d.js as a classic <script>); only globalThis.Scene3D is exposed.
(function () {
let BABYLON, mapSize, cellAt, logicToWorld, worldToLogic, WORLD_SCALE, TILE_PX;

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
  wallMat.diffuseTexture = stoneTexture(scene, '#6a5a44', 'wallTex');   // brighter stone
  wallMat.specularColor = new BABYLON.Color3(0, 0, 0);
  const pillarMat = new BABYLON.StandardMaterial('pillarMat', scene);
  pillarMat.diffuseTexture = stoneTexture(scene, '#544735', 'pillarTex');
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

// A limb that swings from a pivot at its top (hip / shoulder), so rotating the
// pivot's X rotates the whole limb about the joint — a believable walk cycle.
function makeLimb(scene, parent, px, py, len, w, mat, name) {
  const pivot = new BABYLON.TransformNode(name + 'Piv', scene);
  pivot.parent = parent; pivot.position.set(px, py, 0);
  const m = BABYLON.MeshBuilder.CreateBox(name, { width: w, depth: w * 1.15, height: len }, scene);
  m.position.y = -len / 2; m.material = mat; m.parent = pivot; m.isPickable = false;
  return { pivot, mesh: m };
}

// SEAM: future character-selection replaces this primitive build with a GLB load + skeleton.
function createKnight(scene) {
  const unit = TILE_PX * WORLD_SCALE;
  const root = new BABYLON.TransformNode('charRoot', scene);
  const steel = new BABYLON.StandardMaterial('steel', scene);
  steel.diffuseColor = new BABYLON.Color3(0.55, 0.6, 0.7); steel.specularColor = new BABYLON.Color3(0.45, 0.45, 0.5); steel.specularPower = 48;
  const steelDark = new BABYLON.StandardMaterial('steelDark', scene);
  steelDark.diffuseColor = new BABYLON.Color3(0.3, 0.33, 0.4); steelDark.specularColor = new BABYLON.Color3(0.25, 0.25, 0.3);
  const skin = new BABYLON.StandardMaterial('skin', scene);
  skin.diffuseColor = new BABYLON.Color3(0.82, 0.62, 0.5); skin.specularColor = new BABYLON.Color3(0, 0, 0);
  const tabardMat = new BABYLON.StandardMaterial('tabard', scene);
  tabardMat.diffuseColor = new BABYLON.Color3(0.55, 0.12, 0.12); tabardMat.specularColor = new BABYLON.Color3(0, 0, 0);

  const torso = BABYLON.MeshBuilder.CreateBox('torso', { width: unit * 0.5, depth: unit * 0.3, height: unit * 0.62 }, scene);
  torso.position.y = unit * 0.88; torso.material = steel; torso.parent = root; torso.isPickable = false;
  const tabard = BABYLON.MeshBuilder.CreateBox('tabard', { width: unit * 0.26, depth: unit * 0.02, height: unit * 0.72 }, scene);
  tabard.position.set(0, unit * 0.82, unit * 0.16); tabard.material = tabardMat; tabard.parent = root; tabard.isPickable = false;
  const pelvis = BABYLON.MeshBuilder.CreateBox('pelvis', { width: unit * 0.4, depth: unit * 0.28, height: unit * 0.18 }, scene);
  pelvis.position.y = unit * 0.56; pelvis.material = steelDark; pelvis.parent = root; pelvis.isPickable = false;

  const head = BABYLON.MeshBuilder.CreateSphere('head', { diameter: unit * 0.3 }, scene);
  head.position.y = unit * 1.32; head.material = skin; head.parent = root; head.isPickable = false;
  const helmet = BABYLON.MeshBuilder.CreateCylinder('helmet', { diameterTop: unit * 0.08, diameterBottom: unit * 0.36, height: unit * 0.3 }, scene);
  helmet.position.y = unit * 1.45; helmet.material = steel; helmet.parent = root; helmet.isPickable = false;
  const plume = BABYLON.MeshBuilder.CreateBox('plume', { width: unit * 0.05, depth: unit * 0.22, height: unit * 0.18 }, scene);
  plume.position.set(0, unit * 1.62, -unit * 0.02); plume.material = tabardMat; plume.parent = root; plume.isPickable = false;

  const legL = makeLimb(scene, root, -unit * 0.14, unit * 0.56, unit * 0.56, unit * 0.17, steelDark, 'legL');
  const legR = makeLimb(scene, root, unit * 0.14, unit * 0.56, unit * 0.56, unit * 0.17, steelDark, 'legR');
  const armL = makeLimb(scene, root, -unit * 0.33, unit * 1.12, unit * 0.5, unit * 0.13, steel, 'armL');
  const armR = makeLimb(scene, root, unit * 0.33, unit * 1.12, unit * 0.5, unit * 0.13, steel, 'armR');

  // Sword held in the right hand, pointing down-forward.
  const swordMat = new BABYLON.StandardMaterial('swordMat', scene);
  swordMat.diffuseColor = new BABYLON.Color3(0.7, 0.72, 0.8); swordMat.emissiveColor = new BABYLON.Color3(0.06, 0.06, 0.1);
  const blade = BABYLON.MeshBuilder.CreateBox('blade', { width: unit * 0.05, depth: unit * 0.02, height: unit * 0.85 }, scene);
  blade.material = swordMat; blade.parent = armR.mesh; blade.position.set(0, -unit * 0.55, unit * 0.14); blade.isPickable = false;
  const guard = BABYLON.MeshBuilder.CreateBox('guard', { width: unit * 0.22, depth: unit * 0.05, height: unit * 0.05 }, scene);
  guard.material = steelDark; guard.parent = armR.mesh; guard.position.set(0, -unit * 0.2, unit * 0.14); guard.isPickable = false;

  return { root, legL, legR, armL, armR, torso, _t: 0, _baseY: torso.position.y, _tabBaseY: tabard.position.y, tabard, unit };
}

function createOlin(scene) {
  const unit = TILE_PX * WORLD_SCALE;
  const root = new BABYLON.TransformNode('charRoot', scene);
  const robe = new BABYLON.StandardMaterial('robe', scene);
  robe.diffuseColor = new BABYLON.Color3(0.22, 0.18, 0.14); robe.specularColor = new BABYLON.Color3(0, 0, 0);
  const skin = new BABYLON.StandardMaterial('oskin', scene);
  skin.diffuseColor = new BABYLON.Color3(0.72, 0.56, 0.46); skin.specularColor = new BABYLON.Color3(0, 0, 0);
  const body = BABYLON.MeshBuilder.CreateCylinder('obody', { diameterTop: unit * 0.42, diameterBottom: unit * 0.72, height: unit * 1.15 }, scene);
  body.position.y = unit * 0.58; body.material = robe; body.parent = root; body.isPickable = false;
  const hood = BABYLON.MeshBuilder.CreateCylinder('hood', { diameterTop: unit * 0.06, diameterBottom: unit * 0.44, height: unit * 0.42 }, scene);
  hood.position.y = unit * 1.3; hood.material = robe; hood.parent = root; hood.isPickable = false;
  const face = BABYLON.MeshBuilder.CreateSphere('face', { diameter: unit * 0.26 }, scene);
  face.position.set(0, unit * 1.16, unit * 0.06); face.material = skin; face.parent = root; face.isPickable = false;
  return { root };
}

function buildLights(scene) {
  const amb = new BABYLON.HemisphericLight('amb', new BABYLON.Vector3(0, 1, 0), scene);
  amb.intensity = 0.5;                                   // base map visibility (brighter dungeon)
  amb.diffuse = new BABYLON.Color3(0.5, 0.45, 0.4);
  amb.groundColor = new BABYLON.Color3(0.05, 0.04, 0.03);
}
// Soft radial glow used as the fire particle sprite (no external asset).
let _flameTex = null;
function flameTexture(scene) {
  if (_flameTex) return _flameTex;
  const t = new BABYLON.DynamicTexture('flameTex', { width: 64, height: 64 }, scene, false);
  const ctx = t.getContext();
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,220,1)');
  g.addColorStop(0.35, 'rgba(255,190,70,0.9)');
  g.addColorStop(0.7, 'rgba(255,90,15,0.45)');
  g.addColorStop(1, 'rgba(255,40,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  t.hasAlpha = true; t.update();
  _flameTex = t; return t;
}
// A rising, flickering fire built from additive particles — reads as a real flame.
function addFire(scene, X, Y, Z, scale, capacity) {
  const ps = new BABYLON.ParticleSystem('fire', capacity, scene);
  ps.particleTexture = flameTexture(scene);
  ps.emitter = new BABYLON.Vector3(X, Y, Z);
  ps.minEmitBox = new BABYLON.Vector3(-0.06 * scale, 0, -0.06 * scale);
  ps.maxEmitBox = new BABYLON.Vector3(0.06 * scale, 0, 0.06 * scale);
  ps.color1 = new BABYLON.Color4(1, 0.75, 0.25, 1);
  ps.color2 = new BABYLON.Color4(1, 0.4, 0.06, 1);
  ps.colorDead = new BABYLON.Color4(0.25, 0.04, 0, 0);
  ps.minSize = 0.1 * scale; ps.maxSize = 0.34 * scale;
  ps.minLifeTime = 0.18; ps.maxLifeTime = 0.45;
  ps.emitRate = capacity * 5;
  ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
  ps.gravity = new BABYLON.Vector3(0, 2.4 * scale, 0);
  ps.direction1 = new BABYLON.Vector3(-0.12, 1, -0.12);
  ps.direction2 = new BABYLON.Vector3(0.12, 1, 0.12);
  ps.minEmitPower = 0.4 * scale; ps.maxEmitPower = 0.9 * scale;
  ps.updateSpeed = 0.02;
  ps.start();
  return ps;
}
function addTorchLight(scene, X, Y, Z, scale) {
  const pl = new BABYLON.PointLight('torchL', new BABYLON.Vector3(X, Y, Z), scene);
  pl.diffuse = new BABYLON.Color3(1.0, 0.62, 0.28);      // warm orange
  pl.intensity = 1.0 * scale; pl.range = TILE_PX * WORLD_SCALE * 7 * scale;
  let t = Math.random() * 10;
  scene.onBeforeRenderObservable.add(() => { t += 0.13; pl.intensity = (1.0 + Math.sin(t) * 0.18 + Math.sin(t * 2.7) * 0.1) * scale; });
  return pl;
}
function buildFireProps(scene) {
  const { cols, rows } = mapSize();
  const unit = TILE_PX * WORLD_SCALE;
  const woodMat = new BABYLON.StandardMaterial('woodMat', scene);
  woodMat.diffuseColor = new BABYLON.Color3(0.26, 0.16, 0.08); woodMat.specularColor = new BABYLON.Color3(0, 0, 0);
  const metalMat = new BABYLON.StandardMaterial('metalMat', scene);
  metalMat.diffuseColor = new BABYLON.Color3(0.18, 0.18, 0.2); metalMat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
  const emberMat = new BABYLON.StandardMaterial('emberMat', scene);
  emberMat.emissiveColor = new BABYLON.Color3(1, 0.45, 0.12); emberMat.diffuseColor = new BABYLON.Color3(0, 0, 0); emberMat.disableLighting = true;

  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const ch = cellAt(c, r); if (ch !== 't' && ch !== 'C') continue;
    const { X, Z } = logicToWorld(c * TILE_PX + TILE_PX / 2, r * TILE_PX + TILE_PX / 2);
    if (ch === 't') {
      // wall torch: tapered wooden handle + metal cup + ember + flame
      const handle = BABYLON.MeshBuilder.CreateCylinder('thandle', { diameterTop: unit * 0.07, diameterBottom: unit * 0.11, height: unit * 1.25 }, scene);
      handle.position.set(X, unit * 0.62, Z); handle.material = woodMat; handle.isPickable = false;
      const cup = BABYLON.MeshBuilder.CreateCylinder('tcup', { diameterTop: unit * 0.3, diameterBottom: unit * 0.12, height: unit * 0.2 }, scene);
      cup.position.set(X, unit * 1.3, Z); cup.material = metalMat; cup.isPickable = false;
      const ember = BABYLON.MeshBuilder.CreateSphere('tember', { diameter: unit * 0.22 }, scene);
      ember.position.set(X, unit * 1.42, Z); ember.material = emberMat; ember.isPickable = false;
      addFire(scene, X, unit * 1.46, Z, 1.0, 70);
      addTorchLight(scene, X, unit * 1.5, Z, 1.0);
    } else {
      // campfire: crossed logs + stones + big flame
      for (let i = 0; i < 4; i++) {
        const log = BABYLON.MeshBuilder.CreateCylinder('clog', { diameter: unit * 0.13, height: unit * 0.8 }, scene);
        log.rotation.z = Math.PI / 2; log.rotation.y = i * (Math.PI / 4);
        log.position.set(X, unit * 0.1, Z); log.material = woodMat; log.isPickable = false;
      }
      const embers = BABYLON.MeshBuilder.CreateCylinder('cember', { diameter: unit * 0.5, height: unit * 0.08 }, scene);
      embers.position.set(X, unit * 0.16, Z); embers.material = emberMat; embers.isPickable = false;
      addFire(scene, X, unit * 0.2, Z, 2.0, 160);
      addTorchLight(scene, X, unit * 0.55, Z, 1.7);
    }
  }
}

const ISO_BETA = Math.PI * 60 / 180;   // 60° from +Y  => 30° elevation (classic iso feel)
const ISO_ALPHA = -Math.PI / 4;        // upper-left -> lower-right 45°

function createScene(canvas, opts = {}) {
  // Bind globals now (all scripts + Babylon have loaded by the time this runs).
  BABYLON = window.BABYLON;
  ({ mapSize, cellAt, logicToWorld, worldToLogic, WORLD_SCALE, TILE_PX } = globalThis.Nav3D);

  const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true });
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.03, 0.02, 0.02, 1);

  const { widthPx, heightPx } = mapSize();
  const worldW = widthPx * WORLD_SCALE, worldH = heightPx * WORLD_SCALE;
  const unit = TILE_PX * WORLD_SCALE;

  const camera = new BABYLON.ArcRotateCamera('cam', ISO_ALPHA, ISO_BETA, 60, BABYLON.Vector3.Zero(), scene);
  camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
  let orthoSize = unit * 6.5;   // half-height ≈ 13 tiles tall — close enough to read characters
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
      orthoSize = Math.min(Math.max(orthoSize * (e.deltaY > 0 ? 1.1 : 0.9), unit * 4), unit * 18);
      applyOrtho();
    }
  });

  // Ground plane (sized to the map) — pickable for click-to-walk
  const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: worldW, height: worldH }, scene);
  const gmat = new BABYLON.StandardMaterial('gmat', scene);
  gmat.diffuseColor = new BABYLON.Color3(0.36, 0.29, 0.18);  // brighter dirt floor
  gmat.specularColor = new BABYLON.Color3(0, 0, 0);
  ground.material = gmat;

  buildLevel(scene);
  buildLights(scene);
  buildFireProps(scene);

  const player = createKnight(scene);
  let _playerMoving = false, _playerFacing = 0;
  scene.onBeforeRenderObservable.add(() => {
    if (_playerMoving) {
      player._t += 0.28;
      const s = Math.sin(player._t) * 0.6;
      player.legL.pivot.rotation.x = s;  player.legR.pivot.rotation.x = -s;
      player.armL.pivot.rotation.x = -s * 0.85; player.armR.pivot.rotation.x = s * 0.85;
      const bob = Math.abs(Math.sin(player._t)) * unit * 0.05;
      player.torso.position.y = player._baseY + bob;
      player.tabard.position.y = player._tabBaseY + bob;
    } else {
      player.legL.pivot.rotation.x = 0; player.legR.pivot.rotation.x = 0;
      player.armL.pivot.rotation.x = 0; player.armR.pivot.rotation.x = 0;
      player.torso.position.y = player._baseY; player.tabard.position.y = player._tabBaseY;
    }
    player.root.rotation.y = _playerFacing;
  });

  // Candle the knight carries: a bright warm light giving a ~10-tile visibility disc.
  // The light source sits well above the knight (the flame mesh stays in hand) so the
  // lit floor area is a wide, fairly even disc rather than a tight glow at the feet.
  const candle = new BABYLON.PointLight('candle', new BABYLON.Vector3(unit * 0.3, unit * 10, 0), scene);
  candle.parent = player.root;
  candle.diffuse = new BABYLON.Color3(1.0, 0.93, 0.76);
  candle.intensity = 120; candle.range = unit * 36;          // warm "daylight" pool spanning ~20 tiles
  candle.falloffType = BABYLON.Light.FALLOFF_GLTF;           // gentler than inverse-square = wider bright area
  const candleFlame = BABYLON.MeshBuilder.CreateSphere('candleFlame', { diameter: unit * 0.12 }, scene);
  const candleMat = new BABYLON.StandardMaterial('candleMat', scene);
  candleMat.emissiveColor = new BABYLON.Color3(1, 0.85, 0.5); candleMat.disableLighting = true;
  candleFlame.material = candleMat; candleFlame.parent = player.root; candleFlame.position.set(unit * 0.3, unit * 1.1, 0); candleFlame.isPickable = false;
  let _ct = 0;
  scene.onBeforeRenderObservable.add(() => { _ct += 0.18; candle.intensity = 120 + Math.sin(_ct) * 6; });

  const olin = createOlin(scene);
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

  engine.resize(); applyOrtho();   // size to the (now laid-out) canvas
  engine.runRenderLoop(() => scene.render());
  window.addEventListener('resize', () => { engine.resize(); applyOrtho(); });

  return {
    setCameraMode: (m) => { opts.cameraMode = m; setCameraMode(m); },
    setPlayer: (x, y, moving) => {
      const { X, Z } = logicToWorld(x, y);
      if (moving) { const dx = X - player.root.position.x, dz = Z - player.root.position.z; if (dx || dz) _playerFacing = Math.atan2(dx, dz); }
      player.root.position.set(X, 0, Z); _playerMoving = !!moving;
      // Camera follows the knight (keeps the locked iso angle; target drives the orbit pivot).
      camera.target.copyFromFloats(X, unit * 0.6, Z);
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

globalThis.Scene3D = { createScene };
})();
