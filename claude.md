# Claude Notes

## Project Context
Portfolio site for Iris Kim using Next.js 15 and Sanity CMS.

---

## Document Maintenance (AUTO)
1. Update relevant sections (don't append - overwrite outdated info)
2. Remove resolved issues immediately
3. Keep under 250 lines

---

## Architecture

### Layout: `layout.js` → `SiteLayoutClient` → `SidebarClient` + `{children}`
- Sidebar: fixed, `w-1/6`
- Main: `ml-[16.666667%]` offset

### Key Files
| Purpose | File |
|---------|------|
| Project state & URL sync | `context/ProjectContext.js` |
| Hover state + scroll handler | `context/HoverContext.js` |
| Grid layout algorithm | `lib/gridLayout.js` |
| Animation easing | `lib/easing.js` |
| Main shell component | `components/PortfolioShell.js` |
| Sidebar + hover | `components/SidebarClient.js` |

---

## Critical Patterns

### Tailwind Opacity Bug
Tailwind opacity classes don't work. Use inline styles:
```js
style={{ opacity: condition ? 0.3 : 1, transition: "opacity 300ms" }}
```

### Sanity: Use `freshClient`
```js
import { freshClient } from "@/sanity/lib/client";
```

### HLS: Force hls.js for ALL browsers (Safari ignores native quality hints)

---

## Sidebar Hover Scroll System

### Architecture (`SidebarClient.js` + `PortfolioShell.js` + `HoverContext.js`)
Sidebar hover triggers grid scroll to show hovered project's row.

### Oscillation Detection (`SidebarClient.js`)
Cursor on boundary between items causes rapid mouseenter oscillation (~10ms intervals).
Solution: Track recent hovers; if oscillating between same 2 slugs within 100ms, stay locked to first.
```js
if (state.oscillationPair?.has(slug) && state.oscillationPair?.has(state.committedSlug)) return;
```

### Scroll Debouncing (`PortfolioShell.js`)
- `RAPID_SWEEP_THRESHOLD = 80ms` — slower hovers scroll immediately
- `SWEEP_DEBOUNCE = 100ms` — rapid sweeping waits for settle
- Track `currentScrollTargetRowRef` to skip redundant scrolls to same row
- Reset row ref via `clearCallback` when mouse leaves sidebar

### HoverContext Registration
```js
registerScrollHandler(handleSidebarHoverScroll, handleHoverClear);
```
Second param is called on `clearHover()` to reset scroll state.

---

## Animation System

### Phases
`idle` → `scrolling-to-peek` → `grid-animating` → `gallery-fading-in` → `ready` → `gallery-preparing-fade-out` → `gallery-fading-out` → `grid-returning-js`

### Key Rule: JS Animation for Close
CSS transition + JS scroll desync. Use pure JS animation for both in same `requestAnimationFrame`.

### Overlap Detection Buffer
Peek position has sub-pixel precision issues. Add threshold buffer:
```js
const overlapThreshold = effectivePeek;
const overlapping = firstRowTop < (galleryBottom - overlapThreshold);
```

### Button Toggle Animation (`PortfolioShell.js`)
"keep browsing" ↔ "back to project" button uses sequenced fade:
- `buttonPhase`: `'idle'` | `'fading-out'` | `'fading-in'`
- Opacity only 1 when `buttonPhase === 'idle'`, otherwise 0
- Scroll animation starts immediately on click (no delay before scroll)
- Button fades out via CSS while scroll runs, fades in after scroll completes
- Manual scroll overlap changes also trigger fade sequence
- All fade transitions: 300ms

---

## Grid System

- `MIN_ROW_HEIGHT`: 200px, `MAX_ROW_HEIGHT`: 250px
- Landing: 2 rows + 15% peek of 3rd
- Project open: 15% of first row peeks at viewport bottom
- Grid hidden until padding calculated (prevents flash)

---

## Video (Mux)

- HLS: `https://stream.mux.com/{ID}.m3u8`
- MP4: `https://stream.mux.com/{ID}/1080p.mp4`
- Autoplay gates on `animationPhase === 'ready'`
- Safari: listen for both `canplay` and `canplaythrough`

---

## URL Structure
- Home: `/`
- Project: `/?project=slug`
- Redirect regex: `[a-zA-Z0-9_-]+` (not `.*` — causes infinite loop)

---

## Workflow Rules
- **Animation changes**: Write plan, get approval, test incrementally
- **Never**: CSS transition + JS scroll combos, new positioning strategies without listing tradeoffs
- **Fix failures**: Stop, analyze root cause, don't cycle through random fixes
- **Revert**: Only the specific thing mentioned

## Browser Quirks
- Chrome `canPlayType` returns 'maybe' for HLS — force hls.js
- Local dev: `http://` not `https://`
