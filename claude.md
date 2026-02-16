# Claude Notes

## Project Context
Portfolio site for Iris Kim using Next.js 15 and Sanity CMS.

---

## Document Maintenance (AUTO)

**After every major change, Claude MUST:**
1. Update relevant sections in this file (don't append - overwrite outdated info)
2. Mark completed tasks with ~~strikethrough~~ then delete after session
3. Remove resolved issues/bugs immediately
4. Keep total file under 250 lines

**When user shares a plan:**
1. Add to "Active Plan" section below
2. Check off tasks as completed: `- [x] task`
3. Delete plan section entirely when all tasks done

---

## Active Plan

_No active plan. When user provides a plan, add tasks here._

---

## Architecture Overview

### Layout Structure
```
layout.js (server, fetches data) → SiteLayoutClient (client, provides context) → SidebarClient + {children}
```
- Sidebar: fixed position, `w-1/6` (16.666667%)
- Main content: `ml-[16.666667%]` offset
- Context must wrap all client components that need it

### Key Files
| Purpose | File |
|---------|------|
| Project state & URL sync | `context/ProjectContext.js` |
| Hover state (tile/sidebar) | `context/HoverContext.js` |
| Grid layout algorithm | `lib/gridLayout.js` |
| Animation easing | `lib/easing.js` |
| Main shell component | `components/PortfolioShell.js` |
| Video player (HLS) | `components/VideoPlayer.js` |

---

## Critical Patterns

### Tailwind Opacity Bug
**Tailwind opacity classes (`opacity-30`, `opacity-100`) do not work visually.**
Always use inline styles:
```js
style={{ opacity: someCondition ? 0.3 : 1, transition: "opacity 300ms" }}
```

### Sanity Client
Use `freshClient` (bypasses CDN cache) for all project/media queries:
```js
import { freshClient } from "@/sanity/lib/client";
const projects = await freshClient.fetch(allProjectsQuery);
```

### HLS Quality Forcing
**Use hls.js for ALL browsers** (including Safari). Safari's native HLS ignores quality hints.
```js
hls = new Hls({
  autoStartLoad: false,
  capLevelToPlayerSize: false,
  abrEwmaDefaultEstimate: 100000000,
});
// Set levels in MANIFEST_PARSED, THEN attachMedia() and startLoad()
```

---

## URL & Navigation

### URL Structure
- Home: `/`
- Project: `/?project=project-slug`
- Old `/slug` URLs redirect via `next.config.mjs`

**Important**: Redirect regex must use `[a-zA-Z0-9_-]+` (not `.*`) to prevent infinite loop on `/`.

### useSearchParams Requirement
Requires Suspense boundary. `SiteLayoutClient` wraps with `<Suspense>`.

---

## Animation System

### Animation Phases
| Phase | Description |
|-------|-------------|
| `idle` | No project selected |
| `scrolling-to-peek` | Smooth scroll to top |
| `grid-animating` | Grid slides to peek position |
| `gallery-fading-in` | Gallery fades in |
| `ready` | Animation complete, video can autoplay |
| `gallery-preparing-fade-out` | Prep phase (enables CSS transition) |
| `gallery-fading-out` | Gallery fades out |
| `grid-returning-js` | JS animates scroll + padding together |

### Key Insight: JS Animation for Close
CSS transition + JS scroll animation desync. Solution: **pure JavaScript animation** for both scroll and padding in same `requestAnimationFrame`:
- Direct DOM manipulation (`element.style.paddingTop`), not React state
- Use `materialEase` from `lib/easing.js` (matches CSS `cubic-bezier(0.4, 0, 0.2, 1)`)
- Call `requestAnimationFrame` before `onComplete()` to prevent end jitter

### Gallery Fade on Scroll
- Gallery is fixed, grid scrolls over it
- Measure **first row position**, not grid container (container has padding)
- Only calculate opacity during `'ready'` phase
- `pointerEvents: 'none'` when opacity < 0.1

### Grid/Gallery Overlap Detection (Video Pause/Resume)
**CRITICAL**: The overlap threshold MUST include a buffer equal to `peekAmount` (~15% of first row).

Without threshold buffer:
- At peek position, `firstRowTop ≈ galleryBottom` (off by ~0.01px due to float precision)
- Video autoplays → immediately paused because `isGridOverlapping = true`
- Scrolling "up" never triggers resume because overlap never transitions to `false`

Correct implementation (`PortfolioShell.js` ~line 261):
```js
const overlapThreshold = effectivePeek; // ~35-40px
const overlapping = firstRowTop < (galleryBottom - overlapThreshold);
```

This ensures:
- Peek position = NOT overlapping (video keeps playing)
- Scroll up ~40px = overlapping (video pauses)
- Scroll back down = NOT overlapping (video resumes)

---

## Video Integration (Mux)

### Config (`sanity.config.js`)
```js
muxInput({
  static_renditions: ["1080p"],  // MP4 for hover previews
  max_resolution_tier: "2160p",  // 4K HLS streaming
})
```
Settings only apply to NEW uploads. Cache clear required: `rm -rf .next && npm run dev`

### URL Formats
- HLS: `https://stream.mux.com/{PLAYBACK_ID}.m3u8`
- MP4: `https://stream.mux.com/{PLAYBACK_ID}/1080p.mp4`

### VideoPlayer Sizing
To prevent layout shift AND overflow:
```js
wrapperStyle.aspectRatio = parsedAspectRatio;
wrapperStyle.width = `min(100%, calc(73vh * ${parsedAspectRatio}))`;
```
Video autoplay gates on `animationPhase === 'ready'` and `canplaythrough` event.

---

## Grid System

### Layout Algorithm (`lib/gridLayout.js`)
- `MIN_ROW_HEIGHT`: 200px, `MAX_ROW_HEIGHT`: 250px
- Size multipliers: large=1.0, medium=0.85, small=0.7
- Last row NOT forced to fill width
- Uses CSS `aspect-ratio` property, NOT fixed heights

### Landing Page
- Shows 2 full rows + 15% peek of 3rd row
- Grid hidden (`opacity: 0`) until padding calculated to prevent flash
- Padding calculation uses `requestAnimationFrame` for accurate DOM measurements

### Peek Position (Project Open)
Grid pushed down so ~15% of first row peeks at viewport bottom:
```js
const peek = firstRow.offsetHeight * 0.15;
setGridPeekTop(window.innerHeight - peek);
```

---

## Sanity Studio Theme

### Files
- `sanity/studioTheme.js` - Theme config
- `sanity/studioStyles.css` - CSS overrides
- Exportable copy in `/sanity-studio-theme/`

### Brand Colors
```
--brand: #464861
--brand-light: #61677A
--brand-dark: #1E222E
```
Background: #000000, Text: #ffffff

### Site Settings
Singleton pattern - single instance, actions limited to publish/discardChanges/restore.

---

## GROQ Queries

### allProjectsQuery (grid tiles)
```groq
*[_type == "project"] | order(orderRank asc) {
  _id, title, slug, year, tileSize, coverImage,
  "coverAspectRatio": coverImage.asset->metadata.dimensions.aspectRatio,
  "muxPlaybackId": media[_type == "mux.video"][0].asset->playbackId
}
```

### projectDetailQuery (gallery)
```groq
media[] {
  _type == "mux.video" => {
    "playbackId": asset->playbackId,
    "aspectRatio": asset->data.aspect_ratio
  }
}
```

## Animation & Transitions
- Grid/scroll animations are the hardest part of this codebase. ALWAYS produce a written plan and get approval before implementing animation changes.
- Never attempt sequential CSS transition + JS scroll animation combos — they desync due to React batching. Use JS-only animation approaches.
- After any animation change, verify: no stutter, no jump, no flash, no wrong scroll target. Test from both landing and scrolled positions.
- Do NOT introduce new positioning strategies (fixed/absolute/flow swaps) without explicitly listing tradeoffs first.
- **Overlap detection needs threshold buffers** — peek positions have sub-pixel precision issues. See "Grid/Gallery Overlap Detection" section above.

## Workflow Rules
- NEVER implement changes without a plan for complex UI/animation work. Write the plan, present it, wait for approval.
- After implementing a plan, test incrementally — do not batch multiple animation/layout changes into one untested push.
- When a fix attempt fails, STOP and re-analyze the root cause before trying another approach. Do not cycle through random fixes.

## Browser & Video Quirks
- Safari does NOT reliably fire `canplaythrough` — always listen for both `canplay` and `canplaythrough`.
- Chrome's `canPlayType` returns 'maybe' for native HLS, which can bypass hls.js. Always check and force hls.js when needed.
- Use `http://localhost:3000` not `https://localhost:3000` for local dev.
- Mux video: use hls.js for Safari to force max resolution (Safari's native HLS uses adaptive bitrate that starts low quality).

## CSS / Styling
- When targeting Sanity Studio elements with CSS overrides, always inspect the actual rendered DOM selectors — don't guess attribute values or class names.
- Tailwind v4 is in use. For opacity/transition issues, check if Tailwind utilities are conflicting with custom CSS.
- When user says 'revert', revert ONLY the specific thing mentioned. Do not remove adjacent unrelated changes.