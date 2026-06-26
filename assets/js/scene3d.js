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

// ── Hybrid texturing: drop a PNG path into ASSETS and that surface uses the image;
//    leave it null and the procedural DynamicTexture fallback is used (works offline). ──
const ASSETS = { floor: null, wall: null, magicCircle: null };
function surfaceTexture(scene, url, fallbackFn, name) {
  if (url) { const t = new BABYLON.Texture(url, scene); t.name = name; return t; }
  return fallbackFn();
}
// Nudge a #rrggbb base color by an additive amount, clamped to byte range.
function shadeColor(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const cl = (v) => Math.max(0, Math.min(255, v | 0));
  return `rgb(${cl((n >> 16) + amt)},${cl(((n >> 8) & 255) + amt)},${cl((n & 255) + amt)})`;
}

// Rugged grey stone: irregular blocks + dark mortar + cracks + grit (ref dungeon walls).
function stoneTexture(scene, base, name) {
  const S = 256;
  const t = new BABYLON.DynamicTexture(name, { width: S, height: S }, scene, false);
  const ctx = t.getContext();
  ctx.fillStyle = base; ctx.fillRect(0, 0, S, S);
  const rowsN = 6, bh = S / rowsN;
  for (let r = 0; r < rowsN; r++) {
    const colsN = 4 + (r % 2);
    const off = (r % 2) * (S / colsN / 2);
    for (let c = -1; c < colsN; c++) {
      const x = c * (S / colsN) + off, y = r * bh, w = S / colsN, h = bh;
      ctx.fillStyle = shadeColor(base, (Math.random() - 0.5) * 44);
      ctx.fillRect(x + 1.5, y + 1.5, w - 3, h - 3);     // gap = dark mortar showing base
    }
  }
  for (let i = 0; i < 700; i++) {                        // grit speckle
    const x = Math.random() * S, y = Math.random() * S, a = Math.random() * 0.18;
    ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(x, y, 2, 2);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.32)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.moveTo(Math.random()*S, Math.random()*S); ctx.lineTo(Math.random()*S, Math.random()*S); ctx.stroke(); }
  t.update();
  return t;
}

// Sandy dungeon floor: warm dirt base + tonal patches + pebbles + cracks + faint red stains.
function groundTexture(scene, name) {
  const S = 512;
  const t = new BABYLON.DynamicTexture(name || 'groundTex', { width: S, height: S }, scene, false);
  const ctx = t.getContext();
  ctx.fillStyle = '#b89a6a'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 60; i++) {                         // patchy light/dark tone
    const x = Math.random()*S, y = Math.random()*S, rad = 20 + Math.random()*70;
    const g = ctx.createRadialGradient(x, y, 1, x, y, rad);
    g.addColorStop(0, Math.random() < 0.5 ? 'rgba(120,96,60,0.25)' : 'rgba(205,182,138,0.22)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill();
  }
  for (let i = 0; i < 1400; i++) {                       // grit
    const x = Math.random()*S, y = Math.random()*S;
    ctx.fillStyle = `rgba(0,0,0,${Math.random()*0.12})`; ctx.fillRect(x, y, 2, 2);
  }
  for (let i = 0; i < 90; i++) {                         // grey pebbles
    const x = Math.random()*S, y = Math.random()*S, r = 1.5 + Math.random()*3;
    ctx.fillStyle = `rgba(${90+Math.random()*40|0},${85+Math.random()*35|0},${78+Math.random()*30|0},0.8)`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(40,28,16,0.4)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 26; i++) {                         // jagged cracks
    let x = Math.random()*S, y = Math.random()*S; ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (Math.random()-0.5)*60; y += (Math.random()-0.5)*60; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  for (let i = 0; i < 8; i++) {                          // faint dried-blood stains
    const x = Math.random()*S, y = Math.random()*S, rad = 15 + Math.random()*40;
    const g = ctx.createRadialGradient(x, y, 1, x, y, rad);
    g.addColorStop(0, 'rgba(120,30,20,0.18)'); g.addColorStop(1, 'rgba(120,30,20,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill();
  }
  t.update();
  return t;
}

function buildLevel(scene) {
  const { cols, rows } = mapSize();
  const unit = TILE_PX * WORLD_SCALE;          // one tile in world units
  const wallH = unit * 1.6;
  const wallMat = new BABYLON.StandardMaterial('wallMat', scene);
  wallMat.diffuseTexture = surfaceTexture(scene, ASSETS.wall, () => stoneTexture(scene, '#8a7e6e', 'wallTex'), 'wallTex');
  wallMat.specularColor = new BABYLON.Color3(0, 0, 0);
  const pillarMat = new BABYLON.StandardMaterial('pillarMat', scene);
  pillarMat.diffuseTexture = surfaceTexture(scene, ASSETS.wall, () => stoneTexture(scene, '#6e6456', 'pillarTex'), 'pillarTex');
  pillarMat.specularColor = new BABYLON.Color3(0, 0, 0);

  // Deterministic 0..1 hash per cell — keeps the jagged crown stable across reloads.
  const hash = (c, r) => { const v = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453; return v - Math.floor(v); };

  const parts = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const ch = cellAt(c, r);
    const isWall = ch === '#', isPillar = ch === 'P';
    if (!isWall && !isPillar) continue;
    const { X, Z } = logicToWorld(c * TILE_PX + TILE_PX / 2, r * TILE_PX + TILE_PX / 2);
    if (isPillar) {
      // rugged stone column (kept separate from the merged wall mass)
      const col = BABYLON.MeshBuilder.CreateCylinder('pil', { diameterTop: unit * 0.42, diameterBottom: unit * 0.6, height: wallH * 1.15, tessellation: 7 }, scene);
      col.position.set(X, wallH * 0.575, Z); col.material = pillarMat; col.isPickable = false;
      continue;
    }
    const j = hash(c, r);
    const h = wallH * (0.92 + j * 0.18);                     // per-cell height jitter -> uneven top line
    const box = BABYLON.MeshBuilder.CreateBox('w', { width: unit, depth: unit, height: h }, scene);
    box.position.set(X, h / 2, Z); box.material = wallMat; parts.push(box);
    // off-centre capstone breaks the flat top into a jagged rocky crown
    const cw = unit * (0.45 + j * 0.3);
    const cap = BABYLON.MeshBuilder.CreateBox('wcap', { width: cw, depth: cw, height: unit * (0.18 + j * 0.22) }, scene);
    cap.position.set(X + (j - 0.5) * unit * 0.4, h + unit * 0.08, Z + (j - 0.5) * unit * 0.4);
    cap.material = wallMat; parts.push(cap);
  }
  if (parts.length) { const merged = BABYLON.Mesh.MergeMeshes(parts, true, true, undefined, false, false); if (merged) merged.isPickable = false; }
}

// Red summoning circle fixed on the player's start tile — pure geometry, swappable for a PNG.
function buildMagicCircle(scene) {
  const unit = TILE_PX * WORLD_SCALE;
  const s = globalThis.Nav3D.findChar('S') || { x: 0, y: 0 };
  const { X, Z } = logicToWorld(s.x, s.y);
  const SZ = 256, t = new BABYLON.DynamicTexture('magicTex', { width: SZ, height: SZ }, scene, false);
  const ctx = t.getContext(), cx = SZ / 2, cy = SZ / 2;
  ctx.clearRect(0, 0, SZ, SZ);
  ctx.strokeStyle = 'rgba(255,60,40,0.95)';
  ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, SZ * 0.46, 0, 7); ctx.stroke();
  ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, SZ * 0.40, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, SZ * 0.22, 0, 7); ctx.stroke();
  const R = SZ * 0.40, pts = [];
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); }
  ctx.lineWidth = 3; ctx.beginPath();
  for (let i = 0; i < 5; i++) { const p = pts[(i * 2) % 5]; i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]); }
  ctx.closePath(); ctx.stroke();
  for (let i = 0; i < 24; i++) { const a = i * 2 * Math.PI / 24; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.lineTo(cx + Math.cos(a) * SZ * 0.46, cy + Math.sin(a) * SZ * 0.46); ctx.stroke(); }
  t.hasAlpha = true; t.update();
  const mat = new BABYLON.StandardMaterial('magicMat', scene);
  mat.diffuseTexture = surfaceTexture(scene, ASSETS.magicCircle, () => t, 'magicTex');
  mat.diffuseTexture.hasAlpha = true; mat.opacityTexture = mat.diffuseTexture;
  mat.emissiveColor = new BABYLON.Color3(0.9, 0.2, 0.12);
  mat.disableLighting = true; mat.backFaceCulling = false;
  const disc = BABYLON.MeshBuilder.CreateGround('magicCircle', { width: unit * 2.4, height: unit * 2.4 }, scene);
  disc.position.set(X, unit * 0.04, Z); disc.material = mat; disc.isPickable = false;
  scene.onBeforeRenderObservable.add(() => {
    disc.rotation.y += 0.004;
    const p = 0.7 + Math.sin(performance.now() / 600) * 0.3;
    mat.emissiveColor.set(0.9 * p, 0.2 * p, 0.12 * p);
  });
}

// Scattered terrain dressing: rocks across the floor, urns hugging walls. Static & merged.
function buildScatter(scene) {
  const { cols, rows } = mapSize();
  const unit = TILE_PX * WORLD_SCALE;
  const rockMat = new BABYLON.StandardMaterial('scatterRock', scene);
  rockMat.diffuseColor = new BABYLON.Color3(0.42, 0.39, 0.34); rockMat.specularColor = new BABYLON.Color3(0, 0, 0);
  const potMat = new BABYLON.StandardMaterial('scatterPot', scene);
  potMat.diffuseColor = new BABYLON.Color3(0.45, 0.3, 0.16); potMat.specularColor = new BABYLON.Color3(0.08, 0.08, 0.08);

  let seed = 1337; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const floors = [];
  for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) if (cellAt(c, r) === '.') floors.push([c, r]);

  const rocks = [];
  for (const [c, r] of floors) {
    if (rnd() > 0.12) continue;
    const { X, Z } = logicToWorld(c * TILE_PX + TILE_PX * (0.3 + rnd() * 0.4), r * TILE_PX + TILE_PX * (0.3 + rnd() * 0.4));
    const sz = unit * (0.12 + rnd() * 0.16);
    const rock = BABYLON.MeshBuilder.CreatePolyhedron('scrock', { type: rnd() < 0.5 ? 0 : 2, size: sz }, scene);
    rock.position.set(X, sz * 0.5, Z); rock.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    rock.material = rockMat; rock.isPickable = false; rocks.push(rock);
  }
  if (rocks.length) { const m = BABYLON.Mesh.MergeMeshes(rocks, true, true, undefined, false, false); if (m) m.isPickable = false; }

  let placed = 0;
  for (const [c, r] of floors) {
    if (placed >= 6) break;
    const nearWall = cellAt(c + 1, r) === '#' || cellAt(c - 1, r) === '#' || cellAt(c, r + 1) === '#' || cellAt(c, r - 1) === '#';
    if (!nearWall || rnd() > 0.25) continue;
    const { X, Z } = logicToWorld(c * TILE_PX + TILE_PX / 2, r * TILE_PX + TILE_PX / 2);
    const pot = BABYLON.MeshBuilder.CreateCylinder('urn', { diameterTop: unit * 0.18, diameterBottom: unit * 0.26, height: unit * 0.5, tessellation: 10 }, scene);
    pot.position.set(X, unit * 0.25, Z); pot.material = potMat; pot.isPickable = false; placed++;
  }
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

  // Sword-ready guard pose for the right arm (refs: Lineage knight sprite + live
  // grip photo). The arm is raised forward so the gripping hand comes up in front
  // of the chest instead of hanging at the hip. This is the BASE pose the idle/walk
  // animation offsets from (so the sword arm never snaps back to a dead hang).
  const armRBaseX = -1.05;   // swing forward+up at the shoulder
  const armRBaseZ = -0.14;   // splay slightly outward so it clears the torso
  armR.pivot.rotation.x = armRBaseX;
  armR.pivot.rotation.z = armRBaseZ;

  // Sword gripped in the right hand and held out forward — a broad flat blade with a
  // cross-guard, wrapped grip and round pommel so it reads clearly as a sword (not a cane).
  const swordMat = new BABYLON.StandardMaterial('swordMat', scene);
  swordMat.diffuseColor = new BABYLON.Color3(0.78, 0.8, 0.88); swordMat.specularColor = new BABYLON.Color3(0.6, 0.6, 0.7);
  swordMat.specularPower = 64; swordMat.emissiveColor = new BABYLON.Color3(0.08, 0.08, 0.12);
  const gripMat = new BABYLON.StandardMaterial('gripMat', scene);
  gripMat.diffuseColor = new BABYLON.Color3(0.3, 0.18, 0.1); gripMat.specularColor = new BABYLON.Color3(0, 0, 0);
  // Brighter, more saturated gold for the fittings (ref: cartoon knight sword).
  const brassMat = new BABYLON.StandardMaterial('brassMat', scene);
  brassMat.diffuseColor = new BABYLON.Color3(0.82, 0.62, 0.22); brassMat.specularColor = new BABYLON.Color3(0.7, 0.55, 0.2);
  brassMat.specularPower = 48; brassMat.emissiveColor = new BABYLON.Color3(0.14, 0.1, 0.03);
  // Cyan jewel set in the cross-guard — the sword's signature accent. Self-lit so it
  // still reads as a glowing gem in the dim dungeon.
  const gemMat = new BABYLON.StandardMaterial('gemMat', scene);
  gemMat.diffuseColor = new BABYLON.Color3(0.2, 0.72, 0.95); gemMat.specularColor = new BABYLON.Color3(0.85, 0.95, 1.0);
  gemMat.specularPower = 96; gemMat.emissiveColor = new BABYLON.Color3(0.12, 0.5, 0.72);
  // Group all sword parts under one node so it can be posed (tilted forward in the hand).
  // Held out forward at ~90° to the hanging arm (blade points ahead, horizontal —
  // not dragging on the floor). Local -Y (blade) maps to +Z forward at rotation.x = -90°.
  const sword = new BABYLON.TransformNode('sword', scene);
  // Seat the hilt right in the fist (the far end of the raised arm, arm-local y≈-0.5)
  // so the guard sits against the hand and the blade rises up-and-forward from it.
  sword.parent = armR.mesh; sword.position.set(unit * 0.02, -unit * 0.52, unit * 0.04); sword.rotation.x = -Math.PI / 2;
  // Blade dims chosen so that AFTER the -90°X pose the broad flat faces sideways
  // (vertical) toward the iso camera: thin across X, broad in Z (→vertical), long in Y (→forward).
  const blade = BABYLON.MeshBuilder.CreateBox('blade', { width: unit * 0.05, depth: unit * 0.2, height: unit * 0.72 }, scene);
  blade.material = swordMat; blade.parent = sword; blade.position.y = -unit * 0.44; blade.isPickable = false;
  // central fuller (raised spine) down the broad face so it reads as forged steel, not a pole
  const fuller = BABYLON.MeshBuilder.CreateBox('fuller', { width: unit * 0.07, depth: unit * 0.05, height: unit * 0.58 }, scene);
  fuller.material = steelDark; fuller.parent = sword; fuller.position.y = -unit * 0.42; fuller.isPickable = false;
  // Blade point — a 4-sided pyramid whose base is the blade's exact rectangle (0.05 × 0.2),
  // tapering to a centred point so the broad flat faces continue straight into the tip.
  // The old tip was a rotated 4-sided cone scaled on X: it ended up narrower than the blade
  // AND offset to one side, so it read as a separate spike. We rotate the square base 45° to
  // axis-align it, BAKE that into the vertices (so scaling then stretches a true rectangle,
  // not a sheared rhombus), then scale X/Z to match the blade exactly.
  const tip = BABYLON.MeshBuilder.CreateCylinder('bladeTip', { diameterTop: unit * 0.2, diameterBottom: 0, height: unit * 0.22, tessellation: 4 }, scene);
  tip.rotation.y = Math.PI / 4; tip.bakeCurrentTransformIntoVertices();
  tip.material = swordMat; tip.parent = sword;
  tip.scaling.x = 0.354;   // 0.05 / 0.1414 → base X == blade width
  tip.scaling.z = 1.414;   // 0.20 / 0.1414 → base Z == blade depth
  tip.position.y = -unit * 0.91; tip.isPickable = false;
  // Cross-guard: a gold bar with rounded knobs flaring out at each tip (ref sword).
  const guard = BABYLON.MeshBuilder.CreateBox('guard', { width: unit * 0.4, depth: unit * 0.13, height: unit * 0.1 }, scene);
  guard.material = brassMat; guard.parent = sword; guard.position.y = -unit * 0.05; guard.isPickable = false;
  for (const sx of [-1, 1]) {
    const knob = BABYLON.MeshBuilder.CreateSphere('guardKnob', { diameter: unit * 0.14 }, scene);
    knob.material = brassMat; knob.parent = sword; knob.position.set(sx * unit * 0.2, -unit * 0.05, 0); knob.isPickable = false;
  }
  // Cyan jewel embedded in the centre of the guard, bulging out the camera-facing face.
  const gem = BABYLON.MeshBuilder.CreateSphere('gem', { diameter: unit * 0.12 }, scene);
  gem.material = gemMat; gem.parent = sword; gem.position.set(0, -unit * 0.05, 0); gem.scaling.z = 1.3; gem.isPickable = false;
  // Leather grip — tapers the NATURAL way: fuller where the hand grips at the guard,
  // slimmer toward the pommel. (An earlier version flared it wider toward the pommel,
  // i.e. an upside-down cone, which made the handle look like it pointed the wrong way.)
  const grip = BABYLON.MeshBuilder.CreateCylinder('grip', { diameterTop: unit * 0.085, diameterBottom: unit * 0.105, height: unit * 0.22 }, scene);
  grip.material = gripMat; grip.parent = sword; grip.position.y = unit * 0.11; grip.isPickable = false;
  // Brass ferrule — a short collar at the grip's pommel end that widens from the slim
  // grip out to the pommel's neck, bridging the seam so grip → pommel reads as one piece.
  const ferrule = BABYLON.MeshBuilder.CreateCylinder('ferrule', { diameterTop: unit * 0.11, diameterBottom: unit * 0.088, height: unit * 0.045 }, scene);
  ferrule.material = brassMat; ferrule.parent = sword; ferrule.position.y = unit * 0.238; ferrule.isPickable = false;
  // Faceted diamond pommel (octahedron), sized to seat on the ferrule with no pinch:
  // its widest middle sits at the ferrule's wide end, the upper half tucks in, and the
  // lower half tapers to the butt point.
  const pommel = BABYLON.MeshBuilder.CreatePolyhedron('pommel', { type: 1, size: unit * 0.062 }, scene);
  pommel.material = brassMat; pommel.parent = sword; pommel.position.y = unit * 0.268; pommel.scaling.y = 1.2; pommel.isPickable = false;

  return { root, legL, legR, armL, armR, torso, _t: 0, _baseY: torso.position.y, _tabBaseY: tabard.position.y, tabard, unit, armRBaseX, armRBaseZ };
}

// Olin the mage: long deep-blue robe, a tall pointed wizard hat with a gold band,
// a white beard and a glowing-tipped staff — clearly a spellcaster, not a peddler.
function createOlin(scene) {
  const unit = TILE_PX * WORLD_SCALE;
  const root = new BABYLON.TransformNode('olinRoot', scene);
  const robe = new BABYLON.StandardMaterial('robe', scene);
  robe.diffuseColor = new BABYLON.Color3(0.16, 0.16, 0.34); robe.specularColor = new BABYLON.Color3(0, 0, 0);
  const hatMat = new BABYLON.StandardMaterial('hatMat', scene);
  hatMat.diffuseColor = new BABYLON.Color3(0.12, 0.12, 0.28); hatMat.specularColor = new BABYLON.Color3(0, 0, 0);
  const goldMat = new BABYLON.StandardMaterial('olinGold', scene);
  goldMat.diffuseColor = new BABYLON.Color3(0.66, 0.52, 0.18); goldMat.emissiveColor = new BABYLON.Color3(0.18, 0.14, 0.03); goldMat.specularColor = new BABYLON.Color3(0.4, 0.35, 0.15);
  const skin = new BABYLON.StandardMaterial('oskin', scene);
  skin.diffuseColor = new BABYLON.Color3(0.74, 0.58, 0.48); skin.specularColor = new BABYLON.Color3(0, 0, 0);
  const beardMat = new BABYLON.StandardMaterial('beardMat', scene);
  beardMat.diffuseColor = new BABYLON.Color3(0.86, 0.86, 0.82); beardMat.specularColor = new BABYLON.Color3(0, 0, 0);

  const body = BABYLON.MeshBuilder.CreateCylinder('obody', { diameterTop: unit * 0.4, diameterBottom: unit * 0.78, height: unit * 1.2 }, scene);
  body.position.y = unit * 0.6; body.material = robe; body.parent = root; body.isPickable = false;
  const trim = BABYLON.MeshBuilder.CreateTorus('otrim', { diameter: unit * 0.62, thickness: unit * 0.06 }, scene);
  trim.position.y = unit * 0.06; trim.material = goldMat; trim.parent = root; trim.isPickable = false;
  const face = BABYLON.MeshBuilder.CreateSphere('face', { diameter: unit * 0.27 }, scene);
  face.position.set(0, unit * 1.3, 0); face.material = skin; face.parent = root; face.isPickable = false;
  const beard = BABYLON.MeshBuilder.CreateCylinder('beard', { diameterTop: unit * 0.22, diameterBottom: unit * 0.02, height: unit * 0.34 }, scene);
  beard.position.set(0, unit * 1.14, unit * 0.1); beard.material = beardMat; beard.parent = root; beard.isPickable = false;

  // Pointed wizard hat: wide brim + tall cone + gold band.
  const brim = BABYLON.MeshBuilder.CreateCylinder('hatBrim', { diameterTop: unit * 0.62, diameterBottom: unit * 0.62, height: unit * 0.05 }, scene);
  brim.position.y = unit * 1.44; brim.material = hatMat; brim.parent = root; brim.isPickable = false;
  const cone = BABYLON.MeshBuilder.CreateCylinder('hatCone', { diameterTop: unit * 0.01, diameterBottom: unit * 0.46, height: unit * 0.72 }, scene);
  cone.position.set(0, unit * 1.82, -unit * 0.02); cone.rotation.x = -0.12; cone.material = hatMat; cone.parent = root; cone.isPickable = false;
  const band = BABYLON.MeshBuilder.CreateTorus('hatBand', { diameter: unit * 0.42, thickness: unit * 0.05 }, scene);
  band.position.y = unit * 1.5; band.material = goldMat; band.parent = root; band.isPickable = false;

  // Staff with a glowing orb, held at his side.
  const staffMat = new BABYLON.StandardMaterial('staffMat', scene);
  staffMat.diffuseColor = new BABYLON.Color3(0.3, 0.2, 0.12); staffMat.specularColor = new BABYLON.Color3(0, 0, 0);
  const staff = BABYLON.MeshBuilder.CreateCylinder('staff', { diameter: unit * 0.06, height: unit * 1.7 }, scene);
  staff.position.set(unit * 0.5, unit * 0.85, 0); staff.material = staffMat; staff.parent = root; staff.isPickable = false;
  const orbMat = new BABYLON.StandardMaterial('orbMat', scene);
  orbMat.emissiveColor = new BABYLON.Color3(0.4, 0.7, 1.0); orbMat.diffuseColor = new BABYLON.Color3(0, 0, 0); orbMat.disableLighting = true;
  const orb = BABYLON.MeshBuilder.CreateSphere('staffOrb', { diameter: unit * 0.2 }, scene);
  orb.position.set(unit * 0.5, unit * 1.74, 0); orb.material = orbMat; orb.parent = root; orb.isPickable = false;
  const orbGlow = new BABYLON.PointLight('orbGlow', new BABYLON.Vector3(0, 0, 0), scene);
  orbGlow.parent = orb; orbGlow.diffuse = new BABYLON.Color3(0.4, 0.7, 1.0); orbGlow.intensity = 6; orbGlow.range = unit * 6; orbGlow.specular = new BABYLON.Color3(0, 0, 0);
  return { root };
}

// Furniture for Olin's study — a writing table and a filled bookshelf placed on fixed
// tiles in the room (problem 5). Positions come from the tilemap so they track the room.
function buildOlinFurniture(scene) {
  const unit = TILE_PX * WORLD_SCALE;
  const woodMat = new BABYLON.StandardMaterial('furnWood', scene);
  woodMat.diffuseColor = new BABYLON.Color3(0.32, 0.2, 0.1); woodMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
  const woodDark = new BABYLON.StandardMaterial('furnWoodDark', scene);
  woodDark.diffuseColor = new BABYLON.Color3(0.22, 0.13, 0.06); woodDark.specularColor = new BABYLON.Color3(0, 0, 0);
  const bookCols = [
    new BABYLON.Color3(0.6, 0.18, 0.16), new BABYLON.Color3(0.18, 0.34, 0.55),
    new BABYLON.Color3(0.2, 0.45, 0.25), new BABYLON.Color3(0.5, 0.42, 0.16),
    new BABYLON.Color3(0.4, 0.2, 0.45),
  ].map((c, i) => { const m = new BABYLON.StandardMaterial('book' + i, scene); m.diffuseColor = c; m.specularColor = new BABYLON.Color3(0, 0, 0); return m; });

  const tileToWorld = (col, row) => logicToWorld(col * TILE_PX + TILE_PX / 2, row * TILE_PX + TILE_PX / 2);

  // ── Writing table (tile col 20, row 3) ──
  (() => {
    const { X, Z } = tileToWorld(20, 3);
    const top = BABYLON.MeshBuilder.CreateBox('tableTop', { width: unit * 1.2, depth: unit * 0.7, height: unit * 0.08 }, scene);
    top.position.set(X, unit * 0.62, Z); top.material = woodMat; top.isPickable = false;
    for (const [sx, sz] of [[-0.5, -0.27], [0.5, -0.27], [-0.5, 0.27], [0.5, 0.27]]) {
      const leg = BABYLON.MeshBuilder.CreateBox('tableLeg', { width: unit * 0.08, depth: unit * 0.08, height: unit * 0.6 }, scene);
      leg.position.set(X + sx * unit, unit * 0.3, Z + sz * unit); leg.material = woodDark; leg.isPickable = false;
    }
    // an open book + a candle on the desk
    const bookM = BABYLON.MeshBuilder.CreateBox('deskBook', { width: unit * 0.34, depth: unit * 0.24, height: unit * 0.04 }, scene);
    bookM.position.set(X, unit * 0.68, Z); bookM.rotation.y = 0.3; bookM.material = bookCols[1]; bookM.isPickable = false;
  })();

  // ── Bookshelf against the back wall (tile col 14, row 1) ──
  (() => {
    const { X, Z } = tileToWorld(14, 1);
    const W = unit * 1.1, H = unit * 1.7, D = unit * 0.4;
    const back = BABYLON.MeshBuilder.CreateBox('shelfBack', { width: W, depth: D, height: H }, scene);
    back.position.set(X, H / 2, Z); back.material = woodDark; back.isPickable = false;
    for (let s = 0; s < 3; s++) {
      const y = H * (0.32 + s * 0.27);
      const shelf = BABYLON.MeshBuilder.CreateBox('shelf', { width: W * 0.92, depth: D * 0.9, height: unit * 0.05 }, scene);
      shelf.position.set(X, y, Z + D * 0.05); shelf.material = woodMat; shelf.isPickable = false;
      for (let b = 0; b < 6; b++) {
        const bw = unit * (0.1 + Math.random() * 0.04);
        const book = BABYLON.MeshBuilder.CreateBox('shelfBook', { width: bw, depth: D * 0.6, height: unit * (0.18 + Math.random() * 0.06) }, scene);
        book.position.set(X - W * 0.4 + b * (W * 0.16), y + unit * 0.13, Z + D * 0.08);
        book.material = bookCols[(s * 6 + b) % bookCols.length]; book.isPickable = false;
      }
    }
  })();
}

function buildLights(scene, brightness) {
  const amb = new BABYLON.HemisphericLight('amb', new BABYLON.Vector3(0, 1, 0), scene);
  amb.intensity = brightnessToAmbient(brightness);       // map brightness slider (1-100) -> ambient
  amb.diffuse = new BABYLON.Color3(0.55, 0.47, 0.38);    // warm sandy daylight tint
  amb.groundColor = new BABYLON.Color3(0.06, 0.045, 0.03);
  return amb;
}
// Brightness slider 0-100 -> ambient intensity 0..MAX, graded full-dark to full-bright.
// MAX is well above 1.0 so that at 100 even the dark stone/floor materials read as
// daylight (0 = pitch black, only fire/candle light; 100 = whole map clearly lit).
const MAX_AMBIENT = 2.6;
function brightnessToAmbient(b) {
  const v = Math.min(100, Math.max(0, typeof b === 'number' ? b : 70));
  return (v / 100) * MAX_AMBIENT;
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
      // iron tripod cooking stand straddling the fire (ref: campfire in the dungeon)
      for (let i = 0; i < 3; i++) {
        const ang = i * (Math.PI * 2 / 3);
        const leg = BABYLON.MeshBuilder.CreateCylinder('tripodLeg', { diameter: unit * 0.05, height: unit * 1.0 }, scene);
        leg.material = metalMat; leg.isPickable = false;
        leg.position.set(X + Math.cos(ang) * unit * 0.26, unit * 0.46, Z + Math.sin(ang) * unit * 0.26);
        leg.rotation.z = -Math.cos(ang) * 0.5; leg.rotation.x = Math.sin(ang) * 0.5;
      }
      const hook = BABYLON.MeshBuilder.CreateCylinder('tripodHook', { diameter: unit * 0.035, height: unit * 0.28 }, scene);
      hook.material = metalMat; hook.position.set(X, unit * 0.78, Z); hook.isPickable = false;
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
  scene.clearColor = new BABYLON.Color4(0.05, 0.035, 0.025, 1);   // warm dungeon murk

  const { widthPx, heightPx, cols, rows } = mapSize();
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
  gmat.diffuseTexture = surfaceTexture(scene, ASSETS.floor, () => groundTexture(scene, 'groundTex'), 'groundTex');
  if (gmat.diffuseTexture.uScale !== undefined) { gmat.diffuseTexture.uScale = cols / 2; gmat.diffuseTexture.vScale = rows / 2; }
  gmat.specularColor = new BABYLON.Color3(0, 0, 0);
  ground.material = gmat;

  buildLevel(scene);
  const ambLight = buildLights(scene, opts.brightness);
  buildFireProps(scene);
  buildMagicCircle(scene);
  buildScatter(scene);

  const player = createKnight(scene);
  let _playerMoving = false, _playerFacing = 0;
  scene.onBeforeRenderObservable.add(() => {
    if (_playerMoving) {
      player._t += 0.28;
      const s = Math.sin(player._t) * 0.6;
      player.legL.pivot.rotation.x = s;  player.legR.pivot.rotation.x = -s;
      // left arm swings freely; right arm holds the sword so it keeps the ready
      // pose and only bobs a little around its raised base.
      player.armL.pivot.rotation.x = -s * 0.85; player.armR.pivot.rotation.x = player.armRBaseX + s * 0.18;
      const bob = Math.abs(Math.sin(player._t)) * unit * 0.05;
      player.torso.position.y = player._baseY + bob;
      player.tabard.position.y = player._tabBaseY + bob;
    } else {
      player.legL.pivot.rotation.x = 0; player.legR.pivot.rotation.x = 0;
      player.armL.pivot.rotation.x = 0; player.armR.pivot.rotation.x = player.armRBaseX;
      player.torso.position.y = player._baseY; player.tabard.position.y = player._tabBaseY;
    }
    player.root.rotation.y = _playerFacing;
  });

  // (Player-carried light removed by request — visibility is governed solely by the
  //  ambient brightness slider plus the torch/campfire lights.)

  const olin = createOlin(scene);
  buildOlinFurniture(scene);
  // Nameplate: two stacked lines like the old 2D label — name big, role small.
  const plate = new BABYLON.DynamicTexture('plate', { width: 256, height: 128 }, scene, false);
  plate.hasAlpha = true;
  {
    const ctx = plate.getContext();
    ctx.clearRect(0, 0, 256, 128);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f0d060';
    ctx.font = 'bold 20px "Noto Sans TC", sans-serif';
    ctx.fillText('歐林', 128, 20);
    ctx.fillStyle = '#e8d5a0';
    ctx.font = '16px "Noto Sans TC", sans-serif';
    ctx.fillText('【雜貨商】', 128, 40);
    plate.update(true);
  }
  const plateMat = new BABYLON.StandardMaterial('plateMat', scene);
  plateMat.diffuseTexture = plate; plateMat.emissiveColor = new BABYLON.Color3(1, 1, 1); plateMat.opacityTexture = plate; plateMat.disableLighting = true; plateMat.backFaceCulling = false;
  const plateMesh = BABYLON.MeshBuilder.CreatePlane('plateMesh', { width: unit*2.6, height: unit*1.3 }, scene);
  plateMesh.material = plateMat; plateMesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL; plateMesh.isPickable = false;

  // Dynamic "click to talk" prompt — hidden until the player is in range, then it
  // bobs/pulses above the nameplate (toggled by sceneApi.setOlinHint).
  const hintTex = new BABYLON.DynamicTexture('olinHint', { width: 256, height: 64 }, scene, false);
  hintTex.hasAlpha = true;
  {
    const ctx = hintTex.getContext();
    ctx.clearRect(0, 0, 256, 64);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f0d060';
    ctx.font = 'bold 24px "Noto Sans TC", sans-serif';
    ctx.fillText('▼ 點擊交談', 128, 44);
    hintTex.update(true);
  }
  const hintMat = new BABYLON.StandardMaterial('olinHintMat', scene);
  hintMat.diffuseTexture = hintTex; hintMat.emissiveColor = new BABYLON.Color3(1, 1, 1); hintMat.opacityTexture = hintTex; hintMat.disableLighting = true; hintMat.backFaceCulling = false;
  const hintMesh = BABYLON.MeshBuilder.CreatePlane('olinHintMesh', { width: unit*2.4, height: unit*0.6 }, scene);
  hintMesh.material = hintMat; hintMesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL; hintMesh.isPickable = false; hintMesh.setEnabled(false);
  const hintBaseY = unit * 2.7;   // floats above the two-line nameplate
  scene.onBeforeRenderObservable.add(() => {
    if (!hintMesh.isEnabled()) return;
    const t = performance.now();
    hintMesh.position.y = hintBaseY + Math.sin(t / 220) * unit * 0.18;
    const s = 1 + Math.sin(t / 180) * 0.07;
    hintMesh.scaling.set(s, s, s);
  });

  scene.onPointerObservable.add((p) => {
    if (p.type !== BABYLON.PointerEventTypes.POINTERPICK) return;
    const hit = scene.pick(scene.pointerX, scene.pointerY, (m) => m === ground);
    if (hit?.hit && opts.onGroundClick) {
      const { x, y } = worldToLogic(hit.pickedPoint.x, hit.pickedPoint.z);
      opts.onGroundClick(x, y);
    }
  });

  // ── Navigation guide: white dashed trail along the path + a bobbing arrow at the
  //    destination (problem 2 — restores the 2D nav overlay in the 3D scene). ──
  let navLine = null;
  const navArrowMat = new BABYLON.StandardMaterial('navArrowMat', scene);
  navArrowMat.emissiveColor = new BABYLON.Color3(1, 1, 1); navArrowMat.diffuseColor = new BABYLON.Color3(0, 0, 0); navArrowMat.disableLighting = true;
  const navArrow = BABYLON.MeshBuilder.CreateCylinder('navArrow', { diameterTop: unit * 0.5, diameterBottom: 0, height: unit * 0.5, tessellation: 4 }, scene);
  navArrow.rotation.y = Math.PI / 4; navArrow.material = navArrowMat; navArrow.isPickable = false; navArrow.setEnabled(false);
  const navArrowBaseY = unit * 0.9;
  scene.onBeforeRenderObservable.add(() => {
    if (navArrow.isEnabled()) { navArrow.position.y = navArrowBaseY + Math.sin(performance.now() / 250) * unit * 0.18; navArrow.rotation.y += 0.03; }
  });
  function setNavPath(path) {
    if (navLine) { navLine.dispose(); navLine = null; }
    if (!path || path.length < 2) { navArrow.setEnabled(false); return; }
    const pts = path.map((p) => { const { X, Z } = logicToWorld(p.x, p.y); return new BABYLON.Vector3(X, unit * 0.08, Z); });
    navLine = BABYLON.MeshBuilder.CreateDashedLines('navLine', { points: pts, dashSize: 5, gapSize: 4, dashNb: 240 }, scene);
    navLine.color = new BABYLON.Color3(1, 1, 1); navLine.isPickable = false;
    const dest = pts[pts.length - 1];
    navArrow.position.set(dest.x, navArrowBaseY, dest.z); navArrow.setEnabled(true);
  }

  // We have ambient + ~7 torch/campfire lights. StandardMaterial keeps only 4 lights
  // by default, which would silently drop nearby torches on some surfaces — raise the
  // cap so every lit surface receives all the fire lights it's within range of.
  scene.materials.forEach((m) => { if (m.maxSimultaneousLights !== undefined) m.maxSimultaneousLights = 10; });

  engine.resize(); applyOrtho();   // size to the (now laid-out) canvas
  engine.runRenderLoop(() => scene.render());
  window.addEventListener('resize', () => { engine.resize(); applyOrtho(); });

  return {
    setCameraMode: (m) => { opts.cameraMode = m; setCameraMode(m); },
    setBrightness: (b) => { ambLight.intensity = brightnessToAmbient(b); },
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
      hintMesh.position.set(X, hintBaseY, Z);
    },
    setOlinHint: (visible) => { hintMesh.setEnabled(!!visible); if (!visible) hintMesh.scaling.set(1, 1, 1); },
    setNavPath,
    dispose: () => engine.dispose(),
    _internals: { scene, engine, camera, BABYLON },
  };
}

globalThis.Scene3D = { createScene };
})();
