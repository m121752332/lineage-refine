# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A browser-based Lineage Classic (天堂：經典版) game simulation focused on the equipment refining (精煉) system. Entirely static HTML/CSS/JS — no build step, no package manager, no server required.

Open `index.html` (auto-redirects to `login.html`) in a browser to run. For development, use any local HTTP server to serve the files (required for `fetch('refine_rates.json')` to work):

```
npx serve .
```

## Architecture

All pages are self-contained HTML files with inline CSS and Vue 3 (loaded from CDN). State persists entirely via `localStorage` — there is no backend.

### Page Flow

```
index.html → login.html → lineage.html (main game)
                              ├── cash_pay.html  (top-up)
                              ├── setting.html   (Olin NPC config)
                              └── refine_table.html (probability table)
```

### localStorage Keys

| Key | Contents |
|-----|----------|
| `lineage_player` | `{ name, gold, loggedIn, server, loginTime }` |
| `lineage_inventory` | Array of item objects (100 slots) |
| `lineage_config` | `{ maxEnhLevel, priceConfig: { weapon, armor, twdRate } }` |

All pages guard against unauthenticated access by checking `lineage_player.loggedIn` in `onMounted`.

### Refine Rate Configuration

Success rates live in [`refine_rates.json`](refine_rates.json). `refine_table.html` fetches it at runtime with a fallback to hardcoded values if the fetch fails (needs HTTP server). `lineage.html` loads its rates from the same JSON at startup.

Rate entries use `{ from, to, base, safe }` where `base` is a percentage (0–100, supports 6 decimal places). Scroll bonuses add to `base` and are clamped to 100.

- Weapon safe zone: +0–+5 (safe_level = 6)
- Armor safe zone: +0–+3 (safe_level = 4)
- Enhancement cost formula: `500 * 2^currentLevel` (天幣)

### lineage.html Structure

The main game file (~1900 lines) is a single Vue 3 `createApp` with all game logic inline:

- **Canvas rendering**: NPC map scene drawn on `<canvas id="gameCanvas">`
- **Inventory**: 100-slot grid, item types: `weapon`, `armor`, `scroll_weapon`, `scroll_armor`, consumables
- **Hammer mode** (`hammerMode`): cursor-based UX where clicking a scroll activates hammer mode; player then clicks an inventory slot to apply the scroll
- **Olin shop** (`ui.shop`): buy items and sell back refined equipment at list/custom prices
- **Enhance panel** (`ui.enhance`): direct enhancement without scroll, or triggered by hammer mode
- **Result modal** (`result`): full-screen overlay for success/fail/boom outcomes

### CSS Design System

All pages share the same CSS variable palette:

```css
--gold: #c8a84b   /* primary gold */
--gold2: #f0d060  /* bright gold / headings */
--panel: #150e06  /* dark panel background */
--border: #6a4420 /* panel borders */
--text: #e8d5a0   /* body text */
```

### Docs

Design reference documents are in [`docs/`](docs/) (Chinese). Key files:
- [`06_refine_system.md`](docs/06_refine_system.md) — refining mechanics spec (authoritative)
- [`04_topup_system.md`](docs/04_topup_system.md) — top-up / exchange rate design
- [`05_inventory_design.md`](docs/05_inventory_design.md) — inventory and item spec

## Key Constraints

- No transpilation or bundling — all code must be valid vanilla JS/HTML/CSS that runs directly in the browser.
- Vue 3 is loaded from CDN (`vue.global.prod.min.js`). Use the Options-free Composition API (`setup()` pattern) consistent with existing pages.
- `refine_rates.json` must be fetched over HTTP; opening HTML files directly (`file://`) will cause CORS errors on that fetch.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on m121752332/lineage-refine; external PRs are also a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses default label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
