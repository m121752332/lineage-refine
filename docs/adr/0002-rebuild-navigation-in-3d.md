# Rebuild navigation and collision in 3D, without a physics engine

The 2D map-navigation system (the `walkable()` point test + A* nav grid + click-to-walk, designed 2026-06-19) is being **rebuilt to operate in 3D** rather than kept as a 2D logic plane with Babylon as a presentation-only layer. The user explicitly wants navigation and collision-stop refactored into the 3D world.

Movement, collision-stop, and pathfinding now run on the x/z plane: walls are Babylon meshes, collision-stop is a forward ray cast against wall meshes, the A* nav grid and the 3D wall geometry are both generated from a **single tilemap source of truth**, and click-to-walk uses ground-mesh picking. This is a deliberate departure from the lower-risk "keep 2D logic, render in 2.5D" option, accepted because the user wants a genuinely 3D-native scene.

We deliberately **do not add a physics engine (Havok)**. The dungeon is a static map with no dynamic obstacles, gravity, or projectiles, so ray casts + grid A* fully cover navigation and collision-stop at far lower complexity. This should be revisited only if real-time combat (projectiles, knockback, character-vs-character collision) lands after the character-selection feature.
