# Claude Notes

## Project Context
Portfolio site for Iris Kim using Next.js 15 and Sanity CMS.

## Key Files
| Purpose | File |
|---------|------|
| Main shell + grid + animations | `components/PortfolioShell.js` |
| Media gallery + thumbnails | `components/MediaGallery.js` |
| Sidebar + hover | `components/SidebarClient.js` |
| Project state & URL sync | `context/ProjectContext.js` |
| Hover state + scroll handler | `context/HoverContext.js` |
| Information page | `components/InformationPage.js` |

---

## Critical Patterns

### Tailwind Opacity Bug
Tailwind opacity classes don't work. Use inline styles:
```js
style={{ opacity: condition ? 0.3 : 1, transition: "opacity 300ms" }}
```

### Sanity
```js
import { freshClient } from "@/sanity/lib/client";
```

### HLS Video
Force hls.js for ALL browsers (Safari ignores native quality hints, Chrome returns 'maybe' for HLS).

---

## Hover Zone Auto-Scroll Pattern (`MediaGallery.js`)
When hover zones conditionally render based on scroll state, the element can disappear while cursor is over it - no `mouseLeave` fires and animation continues forever.

**Solution**: Check scroll boundaries inside the RAF loop and self-terminate:
```js
const canScrollInDirection = direction === 'left'
  ? el.scrollLeft > 1
  : el.scrollLeft < maxScroll - 1;
if (!canScrollInDirection) {
  scrollAnimationRef.current = null;
  return;
}
```

---

## Animation System

### Phases
`grid-entering` → `idle` → `scrolling-to-peek` → `grid-animating` → `gallery-fading-in` → `ready` → `gallery-preparing-fade-out` → `gallery-fading-out` → `grid-returning-js`

### Key Rules
- Use pure JS animation (RAF) for scroll + style changes together - CSS transitions desync
- Overlap detection needs threshold buffer for sub-pixel precision

---

## Sidebar Hover Scroll

### Oscillation Detection (`SidebarClient.js`)
Cursor on boundary causes rapid mouseenter oscillation. Track recent hovers; if oscillating between same 2 slugs within 100ms, stay locked to first.

### Scroll Debouncing (`PortfolioShell.js`)
- `RAPID_SWEEP_THRESHOLD = 80ms` — slower hovers scroll immediately
- `SWEEP_DEBOUNCE = 100ms` — rapid sweeping waits for settle

---

## Mobile Grid Logic (`PortfolioShell.js`, `gridLayout.js`, `ProjectGrid.js`)

### Landing Row Peek
Desktop shows 2 rows + 8% peek of 3rd. Mobile shows 3 rows + 8% peek of 4th.
`calculatePadding()` branches on `window.innerWidth <= 640`:
```js
const mobile = window.innerWidth <= 640;
const visibleRows = mobile ? 3 : 2;
const peekRowIndex = visibleRows; // row after visible ones
```
Sums heights of `visibleRows` rows + gaps, adds 8% of peek row height, then computes padding.

### Mobile Row Heights (`gridLayout.js`)
Mobile uses smaller height constraints to allow 2–3 tiles per row (vs desktop 200–250px):
- `MOBILE_MIN_ROW_HEIGHT = 100`, `MOBILE_MAX_ROW_HEIGHT = 150`
- `MOBILE_BREAKPOINT = 640`
- `buildGridRows()` detects mobile via `viewportWidth <= MOBILE_BREAKPOINT` and selects heights accordingly
- `finalizeRow()` accepts `minRowHeight`/`maxRowHeight` as params (passed from `buildGridRows`)

### Real Viewport Width (`ProjectGrid.js`)
`buildGridRows(projects, windowWidth || 1400)` — `windowWidth` tracked via `useState`/`useEffect` resize listener. Initializes to `0` (SSR-safe), falls back to `1400` until client hydrates.

---

## Information Page (`InformationPage.js`)

- Loaded via `/?information` URL param; `seedInformation()` in `ProjectContext.js` seeds state directly to `ready` with `galleryScrollOpacity = 1`
- Scroll handler in `PortfolioShell.js` guards: when `isInformationActive && window.scrollY === 0`, forces opacity to 1 — prevents mount-time scroll event from computing opacity=0 due to grid's natural top position
- `isGridOverlapping` drives sidebar hover scroll; guard above keeps it false on info page load
- Layout: 3-column grid desktop (image | bio | contact), single column mobile
- Email detection in PortableText: scans spans with regex, wraps in `EmailBlock` (hover shows "copy", click copies + shows "copied" for 2s)
- Empty paragraphs render as `<br />` for double line-break support

---

## Grid Entrance Animation (`PortfolioShell.js`, `ProjectContext.js`, `ProjectGrid.js`)

On hard refresh of `/` (navType `navigate` or `reload`), the grid slides up from below the fold into landing position over 800ms.

### Phase: `grid-entering`
Triggered by `triggerEntrance()` in the mount effect. Gate: `performance.getEntriesByType('navigation')[0].type === 'navigate' || 'reload'`. Does NOT fire on SPA back-navigation or when `initialProject`/`initialInformation` is set.

### Timing problem: SSR mobile → desktop reflow
`ProjectGrid` starts with `windowWidth=0`, falls back to `375` (mobile layout). `calculatePadding` must NOT run until the desktop layout is committed. Fix: stamp `data-rendered-width={windowWidth || 375}` on the row container. `attemptCalculation` retries (up to 30 RAFs) until `renderedWidth === window.innerWidth`.

### React style prop must stay out of the way during animation
During `grid-entering`, the paddingTop IIFE returns `undefined` — otherwise React writes `16px` mid-animation and kills the transition. Only `el.style.paddingTop` (set imperatively) drives the animation.

### Handoff without jump
At animation end: pin `el.style.transition = 'none'` and `el.style.paddingTop = targetPadding` synchronously, then call `completeEntrance()`. React's `idle` render writes the same `targetPadding` value — no jump. Inline styles are naturally overwritten by React on subsequent renders.

---

## Performance Investigation Results (Feb 2026)

**JS code paths are fast** (<2ms per frame). Jank comes from browser-level work during `gallery-fading-in` phase.

### Root causes identified

1. **HLS.js dynamic import + init (PRIMARY)** — `import("hls.js")` in `VideoPlayer.js:114` loads ~1.1MB JS during the animation. Parsing + executing causes 4 long tasks of 130–172ms each, then HLS manifest/media attachment adds 8+ more long tasks of 50–76ms. Total: ~2s blocked main thread.
2. **24 thumbnail images loading simultaneously** — `MediaGallery.js:438` uses plain `<img>` tags (no lazy loading). All 24 thumbnails start decoding at once during `gallery-fading-in`, each taking 650–850ms.
3. **81 opacity layers** — minor contributor but worth noting: 81 elements have non-1 opacity creating compositor layers.

### Ruled out
- JS animation code (RAF work <2ms/frame)
- React re-renders (only 8 DOM mutation batches during animation)
- `will-change`/transform layers (only 1 on page)
- CSS padding transition (secondary at most)
- `getBoundingClientRect`, `querySelector`, Newton-Raphson easing — all negligible

### Debug instrumentation files (can be removed)
- `lib/debugPerf.js` — shared frame timing utility, gated behind `window.__PERF_DEBUG = true`
- `components/PortfolioShell.js` — has debug imports from debugPerf
- `components/MediaGallery.js` — has debug imports from debugPerf
- `lib/easing.js` — has debug imports from debugPerf

---

## TODO: Animation Jank Fixes

Work through these in order. Each is an independent fix. Test each by clicking a project from the grid and checking for smooth animation (no frame drops >20ms during the transition).

### 1. Preload hls.js on page load
**File:** `components/VideoPlayer.js`
**Problem:** `import("hls.js")` at line 114 dynamically loads ~1.1MB during animation, blocking main thread for ~2s.
**Fix:** Eagerly import hls.js at module level (`import Hls from "hls.js"`) or trigger the dynamic import on page load so it's cached before any project click. The HLS constructor/config can stay lazy — just ensure the module is already parsed.
**Verify:** After fix, clicking a project should show 0 long tasks >100ms in the console. Use `PerformanceObserver` for `longtask` type to check.

### 2. Defer HLS initialization until animation completes
**File:** `components/VideoPlayer.js`, `components/MediaGallery.js`
**Problem:** HLS `loadSource()` + `attachMedia()` + `startLoad()` run during `gallery-fading-in` phase, causing long tasks even after the module is cached.
**Fix:** Don't start HLS loading until `allowAutoPlay` is true (which maps to `animationPhase === 'ready'`). The poster image already loads via the `useEffect` at line 78 — so the user sees the poster during the fade-in, then HLS initializes after `ready`. Pass a prop like `deferLoad` or gate `loadSource` behind `allowAutoPlay`.
**Verify:** Long tasks should not appear during `gallery-fading-in` → `ready` transition.

### 3. Add `loading="lazy"` or `decoding="async"` to thumbnail images
**File:** `components/MediaGallery.js` (line 438)
**Problem:** 24 `<img>` tags load eagerly and simultaneously, causing main-thread decode contention during animation.
**Fix:** Add `decoding="async"` to each thumbnail `<img>` tag. This tells the browser to decode off the main thread. Optionally also add `loading="lazy"` for thumbnails not in the initial viewport (though all thumbnails are in a horizontal scroll container, so `decoding="async"` is the higher-impact fix).
**Verify:** Image resource entries during animation should no longer cluster with 650–850ms decode durations.

### 4. Remove debug instrumentation
**Files:** `components/PortfolioShell.js`, `components/MediaGallery.js`, `lib/easing.js`, `lib/debugPerf.js`
**Problem:** Debug imports and `perfFrame`/`perfMark`/`perfEnd` calls are still in production code.
**Fix:** Remove all imports of `debugPerf.js` and all `perfFrame()`, `perfMark()`, `perfEnd()` calls from PortfolioShell, MediaGallery, and easing.js. Then delete `lib/debugPerf.js`. Search for `debugPerf` and `perfFrame\|perfMark\|perfEnd` to find all call sites.
**Verify:** `grep -r "debugPerf\|perfFrame\|perfMark\|perfEnd" components/ lib/` returns nothing.

---

## Workflow Rules
- **Animation changes**: Write plan, get approval, test incrementally
- **Never**: CSS transition + JS scroll combos
- **Fix failures**: Stop, analyze root cause, don't cycle randomly
