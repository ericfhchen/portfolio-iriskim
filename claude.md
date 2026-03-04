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
Safari uses **native HLS** (`video.src = url.m3u8?min_resolution=720p`) for faster autoplay — hls.js is not loaded at all.
Chrome/Firefox use **hls.js** for quality pinning (native HLS not supported). Detection: `canPlayType("application/vnd.apple.mpegurl")`.

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

### HLS Prefetch Timing — Adaptive Canplay Gate
Fixed-delay prefetches are fragile. A 1.5s timer caused canplay regression from 2.7s→5.8s in dev because prefetches competed with AVFoundation's segment fetching (Safari uses NSURLSession, a separate network stack from `fetch()`, but they share bandwidth + CDN connection pool).

**Solution**: Gate prefetches on the main video's `canplay` event + 500ms buffer.
- `VideoPlayer.js` has `onCanPlay` prop — fires when `canplay`/`canplaythrough` events trigger `handleReady`
- `MediaGallery.js` tracks `mainVideoCanPlay` state, only passed to primary VideoPlayer (layer 0, id 0)
- Prefetch `useEffect` depends on `[allowAutoPlay, mainVideoCanPlay]`
- **Non-video fallback**: If first media item is an image, `handleInitialMediaReady` sets `mainVideoCanPlay=true` immediately so prefetches aren't blocked

**Key insight**: Never use fixed timers for network-dependent sequencing. CDN latency varies (cold: ~1s, warm: ~200ms). Signal-based gating adapts automatically.

---

## Workflow Rules
- **Animation changes**: Write plan, get approval, test incrementally
- **Never**: CSS transition + JS scroll combos
- **Fix failures**: Stop, analyze root cause, don't cycle randomly
