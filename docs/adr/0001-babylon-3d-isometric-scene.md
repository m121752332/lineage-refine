# Rewrite the game scene to a Babylon.js true-3D, 2.5D isometric world

The scene was a vanilla canvas 2D top-down renderer in `lineage.html`. We are rewriting it as a **true 3D scene** rendered with **Babylon.js** (CDN ES module, no build step) and framed at a fixed isometric 45° angle, with a settings toggle between a fixed view and a rotatable (yaw-only) view.

We chose **true 3D over staying 2D / fake-isometric** because the headline requirement is a player-selectable *rotatable* camera, which is fundamentally incompatible with pre-rendered/fake-iso sprites that only look right from one angle. We accept that this caps visual fidelity: the target Lineage screenshot is treated as an **art-direction reference (mood, palette, framing), not a pixel-perfect target** — see [[3d-scene-babylon]].

We chose **Babylon.js over three.js** specifically because of a confirmed roadmap feature: a **character-selection system with multiple swappable, walk-animated characters** (the Knight is the default). Babylon's built-in skeletal animation, instancing, and GLB loaders pay off there; for this small static dungeon alone, three.js would have been lighter. The borrowed techniques from craig7351/zombie-survivors (procedural DynamicTexture, object pooling, spatial grid) are concepts, not literal code, so they did not force the engine choice.

Constraint preserved: no build step, no bundler — Babylon loads as a CDN ES module, and scene code lives in a separate `scene3d.js` imported by `lineage.html`.
