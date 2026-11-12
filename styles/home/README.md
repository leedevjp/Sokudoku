# Home screen CSS architecture

Home-only styles live in this directory and are loaded from `app/globals.css`.
**The import order is intentional:** older viewport-specific rules rely on later
rules with matching specificity. Do not alphabetize or consolidate imports
without checking the resulting cascade at all responsive breakpoints.

## Modules (in import order)

| File | Responsibility |
| --- | --- |
| `base.css` | Original home page layout, brand, and general home preview sizing |
| `responsive.css` | Original small-height and narrow-width home breakpoints |
| `controls.css` | Shared training selection controls and legacy preview constraints |
| `preview-layout.css` | Compact home preview/quiz geometry and shorter-height adjustments |
| `header-actions.css` | Header actions, logout button, and narrow header layout |
| `viewport-layout.css` | Tall/wide viewport layouts and responsive preview grid |
| `deployment-layout.css` | Deployment label and final compact-mobile preview adjustments |
| `folder.css` | Folder palettes, time switch, SVG perimeter surface, and mode tabs |
| `folder-controls.css` | Folder body layout, selected kind/level styles, and launch control |
| `folder-adaptive.css` | Flat button styling, mobile spacing, dark-mode folder palettes |
| `sheen.css` | One synchronized diagonal light beam for every selected control |

## Design boundaries

- **Folder outline:** A single SVG path, produced by
  `components/home/folder-outline-path.ts` and positioned by
  `components/home/use-folder-outline.ts`. Never add an overlapping
  `border`, `::before` or `::after` seam to fake the folder connection.
- **Controls:** Keep the four mode buttons the same size, with independent
  rounded hit targets. Explore + Review may share one raised folder tab.
- **Shimmer:** Keep one global animation in `sheen.css`; selection clipping
  is calculated in `components/home/home-screen.tsx`.
- **Preferences:** Per-mode kind/level selection persists in the browser.
  CSS changes must not alter this behavior.
- **No cast button shadows:** The home-specific flat-button reset lives in
  `folder-adaptive.css`, deliberately later than generic button styles.
- **Shared game styling:** Keep gameplay CSS outside this feature directory.

## Safe changes

1. Edit the file that owns the intended visual responsibility; avoid adding
   another override in an unrelated stylesheet.
2. Check responsive viewport and container-query rules before removing a
   declaration that appears redundant.
3. Keep `app/globals.css` import order stable unless a deliberate visual
   redesign is planned.
4. Run `pnpm typecheck`, `pnpm test`, and `pnpm build` when available.

The initial refactor was **move-only**: concatenating the split CSS modules in
the same import sequence reproduced the old source exactly, byte for byte.
