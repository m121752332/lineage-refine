# Lineage Refine — Scene & Camera Context

The vocabulary for the game scene as it moves from a 2D top-down canvas to a Babylon.js 2.5D isometric world. This glossary covers how the scene is rendered, framed, and inhabited — not the refining/economy systems.

## Language

**Scene**:
The rendered 3D dungeon world the player walks around in (floor, walls, props, characters). Replaces the former canvas 2D map.
_Avoid_: Map (reserve "map" for the navigation grid / minimap), Canvas

**Isometric view (2.5D)**:
The framing of the Scene: a 3D world viewed at a fixed downward 45° angle so it reads as the classic Lineage dungeon look.
_Avoid_: Top-down, 3D view

**Fixed view**:
Camera mode where the isometric angle is locked — the player cannot rotate it.
_Avoid_: Static camera, locked angle

**Rotatable view**:
Camera mode where the player may rotate the camera around the Scene while it stays isometric.
_Avoid_: Free camera, orbit mode

**Character**:
A swappable, animated, player-controllable figure in the Scene (currently the Knight). Distinct from an NPC. Designed so future character-selection can add more.
_Avoid_: Player model, avatar, hero

**Knight (騎士)**:
The default Character — the first selectable class. Combat-focused; highest starting Strength.
_Avoid_: Warrior, fighter

**NPC**:
A non-controllable scene figure that the player interacts with but which does not move. Olin is an NPC.
_Avoid_: Vendor model, mob

**Olin (歐林)**:
The shopkeeper NPC (雜貨商). Styled to match the dungeon art direction but stays static (no walk animation).
_Avoid_: Merchant, shop NPC
