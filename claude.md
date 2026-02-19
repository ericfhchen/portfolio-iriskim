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
`idle` → `scrolling-to-peek` → `grid-animating` → `gallery-fading-in` → `ready` → `gallery-preparing-fade-out` → `gallery-fading-out` → `grid-returning-js`

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
Desktop shows 2 rows + 8% peek of 3rd. Mobile shows 4 rows + 8% peek of 5th.
`calculatePadding()` branches on `window.innerWidth <= 640`:
```js
const mobile = window.innerWidth <= 640;
const visibleRows = mobile ? 4 : 2;
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

## Workflow Rules
- **Animation changes**: Write plan, get approval, test incrementally
- **Never**: CSS transition + JS scroll combos
- **Fix failures**: Stop, analyze root cause, don't cycle randomly

---

## TODO: Mobile Layout (sm: ≤640px)

Currently desktop-only with fixed `w-1/6` sidebar and hardcoded 1400px grid. Need mobile adaptation.

### 1. Mobile Header (replaces sidebar)
**Files:** `SidebarClient.js`, `hooks/useIsMobile.js` (new)
- [x] Hide sidebar nav on `sm:` breakpoint
- [x] Add fixed header at top: Title link | Information | Projects button
- [x] Projects button opens 90% white overlay (`bg-white/90 fixed inset-0 z-50`)
- [x] List all projects in overlay below button
- [x] Tapping project: closes overlay → navigates → animates grid to peek

### 2. Full-Width Layout
**Files:** `PortfolioShell.js`, `ProjectGrid.js`, `gridLayout.js`
- [x] Remove `ml-[16.666%]` margin on `sm:`
- [x] Gallery `left: 0` instead of `calc(100% / 6)` on mobile
- [x] Pass actual `window.innerWidth` to `buildGridRows()`
- [x] Grid: 2-3 items per row (reuse existing ratio logic, smaller base)

### 3. Disable Hover States
**Files:** `PortfolioShell.js`, `SidebarClient.js`, `GridTile.js`
- [x] Add `isMobile()` check (reuse `useIsMobile` hook)
- [x] Skip hover scroll handlers on mobile (PortfolioShell.js)
- [x] First click navigates directly (GridTile.js skips hover on mobile)

### 4. Grid Animations - Mobile Rows
**Files:** `PortfolioShell.js`
- [x] Landing: 4 rows visible + 5th peeking
- [x] Project peek: same as desktop (1 row peek)
- [x] Adjust `peekAmount` calculation for mobile row heights (25% on mobile vs 15% desktop)

### 5. Project Page Layout
**Files:** `MediaGallery.js`
- [x] Media player: full container width (reduced padding on mobile: p-2 vs p-4)
- [x] Vertically center media between header and thumbnails (flex-1 fills space, object-center on mobile)
- [x] Move credits text from top to just above gallery thumbnails (conditional render based on isMobile)

---

## TODO: Information Page

### 1. Sanity Schema Changes
**File:** `sanity/schemas/siteSettings.js`
- [x] Consolidate `artistName` + `siteTitle` → single `name` field
- [x] Add `bio` rich text field (bold, italic, links)
- [x] Add `contactLinks` rich text field (same formatting)
- [x] Add `informationImage` field (image with hotspot)

### 2. Update Data Fetching
**Files:** `sanity/lib/queries.js`, `app/(site)/layout.js`, `app/(site)/page.js`
- [x] Update `siteSettingsQuery` to fetch new fields
- [x] Pass `settings` through layout and page → PortfolioShell

### 3. ProjectContext: Information URL
**File:** `context/ProjectContext.js`
- [x] Handle `?information` URL param in sync effect
- [x] Push `/?information` (not `/?project=information`)
- [x] Export `isInformationActive` helper
- [x] Add `seedInformation()` for direct URL loads

### 4. InformationPage Component
**New file:** `components/InformationPage.js`
- [x] Image: full width mobile, ~50% desktop
- [x] Two columns below: bio (wider) | contact/links (narrower)
- [x] Render rich text with `@portabletext/react`
- [x] Same container as MediaGallery (fixed, fades on scroll)

### 5. PortfolioShell Integration
**File:** `components/PortfolioShell.js`
- [x] Conditional render: InformationPage vs MediaGallery based on `activeSlug`
- [x] Pass `settings` prop through
- [x] Handle `initialInformation` for direct URL loads

### 6. SidebarClient: Information Click
**File:** `components/SidebarClient.js`
- [x] Desktop: Make "information" clickable → `selectProject("information")`
- [x] Desktop: Unmute "information" text, highlight when active
- [x] Mobile: Wire header "information" button, close overlay on click
- [x] Update muting: information NOT muted when information active

### 7. Hide "Back to Project" for Information
- [x] Only show "back to project" when `activeSlug && activeSlug !== "information"`

### 8. InformationPage Enhancements
**File:** `components/InformationPage.js`
- [x] Email detection in PortableText: scan plain spans for emails using regex, wrap in `EmailBlock`
- [x] `EmailBlock`: hover fades email text + fades in muted "copy" label; click copies to clipboard + shows "copied" for 2s
- [x] Emails detected inline within paragraphs (not just whole-paragraph emails)
- [x] Empty paragraphs render as `<br />` for double line-break support
- [x] Mobile layout: single column (stacked), desktop: 3-column grid
- [x] `information` sidebar link: always full opacity (unmuted), `cursor: pointer`
