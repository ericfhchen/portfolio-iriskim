# Claude Notes

## Project Context
Portfolio site for Iris Kim using Next.js 15 and Sanity CMS.

## Session Notes

### Sidebar Implementation
- Added `Sidebar` component to `app/layout.js`
- Sidebar is fixed position, takes `w-1/6` (16.666667%) of screen width
- Main content has `ml-[16.666667%]` to offset the fixed sidebar
- Do NOT run `npm run dev` or attempt to check if rendering works

### Hover State System
- Created `context/HoverContext.js` for shared hover state between sidebar and grid tiles
- Tracks `hoveredProject` (slug) and `hoverSource` ("tile" or "sidebar")
- `SiteLayoutClient.js` wraps the app with `HoverProvider` - this is a client component that receives data fetched in `app/(site)/layout.js` (server component)
- The old `Sidebar.js` server component was deleted - data fetching moved to layout.js

#### Architecture Notes
- Context must wrap all client components that need it
- Server components break the context chain - the `HoverProvider` must be in a client component that wraps both `SidebarClient` and the page content
- Layout structure: `layout.js` (server, fetches data) → `SiteLayoutClient` (client, provides context) → `SidebarClient` + `{children}`

#### CSS/Tailwind Issue
- **Tailwind opacity classes (`opacity-30`, `opacity-100`) do not work visually** even though they're applied correctly
- **Use inline styles instead**: `style={{ opacity: someCondition ? 0.3 : 1, transition: "opacity 300ms" }}`
- This applies to both `GridTile.js` and `SidebarClient.js`

#### Hover Behavior
- Hovering a tile: dims all other tiles to 0.3 opacity, mutes sidebar text (except title and hovered project name)
- Hovering sidebar project name: mutes other sidebar text, autoplays the corresponding tile's video if in viewport, dims other tiles
- `GridTile.js` has `shouldAutoplay` logic that triggers when `hoverSource === "sidebar"` and tile is in viewport

#### Cleanup Needed
- Remove console.log from `SidebarClient.js` (line 12)
- Remove console.log from `context/HoverContext.js` (line 14)

---

## Sanity Client Configuration

### Overview
Two Sanity clients are available: `client` (CDN-cached) and `freshClient` (bypasses cache).

### Files
- `sanity/lib/client.js` - Exports both clients

### Why freshClient Exists
- Sanity CDN caches responses for performance
- New uploads (especially Mux videos) may not appear immediately with cached client
- For portfolio sites, fresh data is more important than CDN speed

### Usage
```js
import { freshClient } from "@/sanity/lib/client";

// Always use freshClient for project data to ensure new uploads appear immediately
const projects = await freshClient.fetch(allProjectsQuery);
```

### Current Usage
- `app/(site)/page.js` - Uses `freshClient` for all project queries
- `app/(site)/layout.js` - Uses `freshClient` for settings and projects
- `context/ProjectContext.js` - Uses `freshClient` for client-side fetches

### When to Use Each
- `freshClient` - Project data, media queries, anything that might be recently updated
- `client` - Static content that rarely changes (if needed for performance)

---

## Sanity Studio Custom Theme

### Overview
Custom dark theme for Sanity Studio with brand colors, hidden branding, and scaled-down UI.

### Files
- `sanity/studioTheme.js` - Legacy theme configuration using `buildLegacyTheme`
- `sanity/studioStyles.css` - CSS overrides for complete UI customization
- `sanity.config.js` - Imports theme and styles, configures studio components

### Brand Colors
```
--brand: #464861       (primary - buttons, focus, links)
--brand-light: #61677A (hover states)
--brand-dark: #1E222E  (selected/active states, text selection)
```

### Key Customizations

#### Typography
- Font: Helvetica Neue
- Base size: 11px
- Heading sizes: h1=16px, h2=14px, h3=12px, h4-h6=11px
- Small text: 9px
- Removed uppercase/small-caps transforms

#### Colors
- Background: #000000 (pure black)
- Text: #ffffff (white)
- Input fields: #2a2a2a background, #3a3a3a border
- Disabled buttons: #3a3a3a background, #666666 text

#### Hidden Elements
- Sanity logos (navbar, popups)
- Workspace menu button / avatar
- Promo popups and announcements
- Resources/help button
- Links to sanity.io

#### Status Indicators (preserved, not overridden)
- Published: #3ab667 (green)
- Draft: #f5a623 (yellow/orange)
- Error: #f03e2f (red)

### sanity.config.js Structure
```js
import { studioTheme } from "./sanity/studioTheme";
import "./sanity/studioStyles.css";

export default defineConfig({
  theme: studioTheme,
  studio: {
    components: {
      logo: () => null,  // Hide navbar logo
    },
  },
  // ... plugins, schema, document actions
});
```

### Singleton Pattern (Site Settings)
- Site Settings is a singleton document (single instance)
- Shows as direct document link, not a folder
- Actions limited to: publish, discardChanges, restore
- Template filtered to prevent creating new instances

### CSS Selectors Reference

#### Buttons
- Primary: `button[data-tone="primary"]`, `[data-ui="Button"][data-tone="primary"]`
- Publish: `button[data-testid="action-publish"]`
- Disabled: `[data-disabled="true"]`, `:disabled`

#### Cards/Rows
- Selected: `[data-selected]`, `[data-selected="true"]`
- Active: `[data-active="true"]`
- Pane items: `[data-ui="PaneItem"]`

#### Status Dots
- Published/draft/error: `[data-status="published"]`, `[data-status="draft"]`, `[data-status="error"]`

#### Exclude Status Tones (to preserve green/yellow/red)
- `:not([data-tone="positive"]):not([data-tone="caution"]):not([data-tone="critical"])`

### Exportable Theme
Copy of theme files in `/sanity-studio-theme/` for use in other projects:
- `studioStyles.css`
- `studioTheme.js`
- `README.md` (installation instructions)

### Important Notes
- Global 9px styles are in `app/site.css` (only imported in `(site)` layout)
- Studio does NOT import site.css, so it uses its own font sizing
- The `(studio)` layout is minimal and doesn't inherit site styles

---

## Mux Video Integration

### Overview
Videos are hosted on Mux and integrated via `sanity-plugin-mux-input`. The site uses HLS streaming for the main player and MP4 for hover previews.

### Mux Tier
- Using **Mux Basic** tier
- Basic tier supports up to **4K streaming** via HLS
- Static renditions at 1080p for hover previews

### sanity.config.js Mux Settings
```js
muxInput({
  // static_renditions replaces deprecated mp4_support
  // Automatically creates MP4 files for all new uploads
  static_renditions: ["1080p"],
  max_resolution_tier: "2160p",   // Allows up to 4K HLS streaming
}),
```

### Important: These settings only apply to NEW uploads
- Existing assets keep their original settings
- To enable static renditions on existing assets, use the Mux API (see below)
- After changing config, must clear cache (`rm -rf .next`) and restart dev server

### Static Renditions Options
- `["1080p"]` - Current option, generates 1080p MP4 (filename: `1080p.mp4`)
- `["highest"]` - Generates MP4 at highest quality up to 4K (filename: `highest.mp4`)
- `["720p", "1080p"]` - Multiple resolutions
- `["highest", "audio-only"]` - Includes M4A audio file

### URL Format for Static Renditions
```
https://stream.mux.com/{PLAYBACK_ID}/{RESOLUTION}.mp4
```
Examples:
- `https://stream.mux.com/abc123/1080p.mp4`
- `https://stream.mux.com/abc123/highest.mp4`

### Deprecated: mp4_support
The old `mp4_support: "capped-1080p"` option is deprecated. Use `static_renditions` instead.
- Cannot coexist with `static_renditions` on same asset
- Old URL format was: `capped-1080p.mp4`

### Enable Static Renditions on Existing Assets via API
```js
// Requires MUX_TOKEN_ID and MUX_TOKEN_SECRET in .env.local
const auth = Buffer.from(MUX_TOKEN_ID + ':' + MUX_TOKEN_SECRET).toString('base64');

// Use the static-renditions endpoint (not mp4-support)
fetch(`https://api.mux.com/video/v1/assets/${assetId}`, {
  method: 'PATCH',
  headers: {
    'Authorization': 'Basic ' + auth,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    static_renditions: [{ name: "1080p" }]
  }),
});
```

### Video Components

#### GridTile.js (Hover Preview)
- Uses MP4 for fast hover playback: `https://stream.mux.com/${playbackId}/1080p.mp4`
- Muted, loops, plays on hover
- Lazy loads when tile is near viewport (200px margin)

#### VideoPlayer.js (Main Player)
- Uses HLS streaming: `https://stream.mux.com/${playbackId}.m3u8`
- Uses hls.js for non-Safari browsers (Safari has native HLS)
- Configured to force highest quality immediately (no adaptive bitrate ramp-up)
- Desktop: Forces highest available quality
- Mobile (≤768px): Caps at 1440p

##### HLS Quality Forcing

**Critical**: Must detect Safari specifically, not just check `canPlayType('application/vnd.apple.mpegurl')`.
Chrome returns "maybe" for this check but doesn't support HLS well natively.

```js
// WRONG - Chrome returns "maybe" and uses native (low quality) HLS
if (video.canPlayType("application/vnd.apple.mpegurl")) { ... }

// CORRECT - Check for Safari specifically
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
if (isSafari && video.canPlayType("application/vnd.apple.mpegurl")) { ... }
```

For hls.js (non-Safari browsers):
```js
hls = new Hls({
  autoStartLoad: false,
  capLevelToPlayerSize: false,
  abrEwmaDefaultEstimate: 100000000, // 100 Mbps - assume fast connection
  abrBandWidthFactor: 0,
  abrBandWidthUpFactor: 0,
});

hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
  const levels = data.levels;
  const targetLevel = levels.length - 1; // Highest quality

  // Lock level BEFORE attaching media
  hls.currentLevel = targetLevel;
  hls.nextLevel = targetLevel;
  hls.loadLevel = targetLevel;

  // NOW attach and start loading
  hls.attachMedia(video);
  hls.startLoad();
});

// Also enforce on LEVEL_SWITCHING and LEVEL_SWITCHED
```

Key points:
- Call `loadSource()` first (fetches manifest)
- Set levels in `MANIFEST_PARSED` callback
- Call `attachMedia()` and `startLoad()` AFTER setting levels
- Enforce level on `LEVEL_SWITCHING` and `LEVEL_SWITCHED` events

#### MediaGallery.js
- Displays project media (videos and images)
- Videos autoplay with sound when:
  1. Project is first opened
  2. Thumbnail is clicked to switch media
- Uses `key={videoKey}` to force VideoPlayer remount for autoplay

### Sanity Queries for Video

#### Get playbackId for grid tiles (allProjectsQuery)
```groq
"muxPlaybackId": media[_type == "mux.video"][0].asset->playbackId
```

#### Get playbackId for media gallery (projectDetailQuery)
```groq
media[] {
  _type == "mux.video" => {
    "playbackId": asset->playbackId,
    "aspectRatio": asset->data.aspect_ratio
  }
}
```

### Mux API Credentials
Stored in `.env.local`:
```
MUX_TOKEN_ID=xxx
MUX_TOKEN_SECRET=xxx
```
Get from: https://dashboard.mux.com/settings/api-access-tokens

### Troubleshooting

#### 404 on MP4 hover preview (new upload)
- **Most likely:** Sanity CDN is returning stale/cached data without the new playbackId
- **Solution:** Use `freshClient` instead of `client` for all project queries (already implemented)
- **Verify:** Check if MP4 works when accessing `https://stream.mux.com/{PLAYBACK_ID}/1080p.mp4` directly with the playback ID from Mux dashboard

#### 404 on MP4 hover preview (existing asset)
- Asset doesn't have static renditions enabled
- Enable via Mux API (see above)
- Or re-upload after config is set

#### Video starts at low quality (e.g., 404x270 instead of 2160x1440)
- **Most likely:** Chrome is using native HLS instead of hls.js
- The old code checked `canPlayType("application/vnd.apple.mpegurl")` - Chrome returns "maybe" (truthy)
- **Fix:** Detect Safari specifically: `const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)`
- Also ensure hls.js config: `autoStartLoad: false`, set level in `MANIFEST_PARSED`, call `attachMedia()` AFTER setting level

#### New uploads not getting MP4/4K
- Config changes require cache clear and server restart
- Run `rm -rf .next && npm run dev`

#### Mux says "ready" but frontend still 404s
- Sanity CDN caching issue - the `mux.videoAsset` document hasn't propagated
- Use `freshClient` (useCdn: false) to bypass cache
- See "Sanity Client Configuration" section above

---

## Project Grid System

### Overview
The homepage displays projects in a responsive grid layout. Projects are ordered via drag-and-drop in Sanity Studio, and each project has a configurable tile size.

### Files
- `lib/gridLayout.js` - Row-building algorithm
- `components/ProjectGrid.js` - Grid container component
- `components/GridTile.js` - Individual tile component
- `sanity/schemas/project.js` - Project schema with `tileSize` and `orderRank` fields

### Sanity Schema Fields

#### orderRank (drag-and-drop ordering)
- Uses `@sanity/orderable-document-list` plugin
- Projects ordered by `orderRank asc` in queries
- Sanity Studio shows "Projects" as a drag-and-drop list

#### tileSize
- Options: `large`, `medium`, `small`
- Default: `medium`
- Affects tile height via size multipliers:
  - `large`: 1.0 (100% of max height)
  - `medium`: 0.85 (85%)
  - `small`: 0.7 (70%)

#### role (new field)
- String field for role in project (e.g., "Director", "Photographer")
- Displayed under project tile in grid

### Grid Layout Algorithm (`lib/gridLayout.js`)

#### Constants
```js
const MIN_ROW_HEIGHT = 200;
const MAX_ROW_HEIGHT = 250;
const SIZE_MULTIPLIERS = { large: 1.0, medium: 0.85, small: 0.7 };
```

#### How it works
1. Projects come pre-ordered from Sanity (by `orderRank`)
2. For each project, calculate target height: `MAX_ROW_HEIGHT × sizeMultiplier`
3. Calculate raw width: `targetHeight × coverAspectRatio`
4. Add tiles to row until row height would drop below `MIN_ROW_HEIGHT`
5. When row is full, start a new row
6. **Last row is NOT forced to fill** - uses natural width

#### Row height calculation
```js
rowHeight = viewportWidth / sum(aspectRatio × sizeMultiplier)
```
This means tiles with same size and aspect ratio take equal space.

#### Width percentages
Each tile's `widthPercent = (tileWidth / viewportWidth) × 100`
where `tileWidth = rowHeight × aspectRatio × sizeMultiplier`

### GridTile Component

#### Props
- `project` - Project data from Sanity
- `widthPercent` - Calculated width percentage
- `aspectRatio` - Cover image aspect ratio (from Sanity metadata)
- `onClick` - Handler for tile clicks

#### CSS Aspect Ratio
Uses `style={{ aspectRatio: aspectRatio }}` on the link container to preserve cover image proportions. This is critical - do NOT use fixed height.

#### Hover Behavior
- Title appears above tile on hover
- Title + year appear below tile on hover
- Video preview plays on hover (if available)
- Integrates with `HoverContext` for sidebar synchronization

#### Opacity States (via inline styles, NOT Tailwind classes)
```js
style={{
  opacity: someOtherHovered ? 0.3 : 1,
  transition: "opacity 300ms"
}}
```
**Important**: Tailwind opacity classes don't work reliably - always use inline styles.

### Sanity Queries

#### allProjectsQuery
```groq
*[_type == "project"] | order(orderRank asc) {
  _id,
  title,
  slug,
  year,
  tileSize,
  coverImage,
  "coverAspectRatio": coverImage.asset->metadata.dimensions.aspectRatio,
  "muxPlaybackId": media[_type == "mux.video"][0].asset->playbackId
}
```

### Key Implementation Notes

1. **Aspect ratio preservation**: The grid uses CSS `aspect-ratio` property, NOT fixed heights. This ensures landscape images are wide and short, portrait images are narrow and tall.

2. **Row breaking logic**: Rows break when adding another tile would push the row height below 200px. The last row doesn't need to fill the width.

3. **Size multipliers affect width allocation**: A "large" tile gets more width than a "medium" tile with the same aspect ratio, which results in it being taller.

4. **No fixed number of tiles per row**: Row composition depends on tile sizes and aspect ratios. Could be 2-5+ tiles per row.

5. **Viewport width parameter**: `buildGridRows(projects, viewportWidth = 1400)` - the algorithm uses a reference viewport width for calculations. The actual display uses percentages so it's responsive.

### Troubleshooting

#### Tiles rendering as squares
- Ensure `aspectRatio` prop is passed to GridTile
- Use `style={{ aspectRatio }}` NOT fixed height
- Check that `coverAspectRatio` is being fetched in the query

#### All tiles same height
- Check that `tileSize` field is set in Sanity
- Verify size multipliers in `gridLayout.js`

#### Last row stretching to fill
- Ensure `finalizeRow` is called with `scaleToFill = false` for last row

---

## Single-Page Project Navigation

### Overview
Projects open seamlessly without page transitions using `/?project=slug` URL structure. Data is prefetched on hover for instant transitions, and SSR works for direct links.

### Architecture

#### URL Structure
| Action | URL |
|--------|-----|
| Home (grid only) | `/` |
| Project selected | `/?project=project-slug` |
| Direct link | `/?project=project-slug` (SSR works) |

#### Key Files
- `context/ProjectContext.js` - Project selection state, data cache, URL sync
- `app/(site)/page.js` - Handles `?project=slug` searchParam, SSR fetches initial project
- `components/SiteLayoutClient.js` - Wraps app with `ProjectProvider` inside `Suspense`
- `components/PortfolioShell.js` - Uses `useProject()` hook, seeds cache with SSR data
- `components/GridTile.js` - Calls `onHover` for prefetch, uses `/?project=slug` links
- `components/SidebarClient.js` - Uses context's `selectProject` and `prefetchProject`

#### Deleted Files (no longer needed)
- `app/(site)/[slug]/page.js` - Old dynamic route
- `components/ProjectPageClient.js` - Old wrapper component

### ProjectContext API

```js
const {
  activeSlug,        // Currently selected project slug
  activeProject,     // Full project data from cache
  showGallery,       // Whether gallery is visible
  projects,          // All projects list
  projectCache,      // Map of slug → project data
  selectProject,     // (slug) → updates URL, fetches if needed, scrolls to top
  prefetchProject,   // (slug) → fetches in background (fire-and-forget)
  closeProject,      // () → hides gallery, navigates to /
  seedProject,       // (project) → seeds cache with SSR data
} = useProject();
```

### Data Flow

1. **SSR (direct link to `/?project=slug`)**:
   - `page.js` fetches project server-side
   - Passes `initialProject` to `PortfolioShell`
   - `PortfolioShell` calls `seedProject()` to populate cache

2. **Client navigation (clicking tile/sidebar)**:
   - Hover triggers `prefetchProject(slug)` - fetches in background
   - Click triggers `selectProject(slug)` - data already cached, instant display
   - URL updates via `router.push()` with `scroll: false`
   - `window.scrollTo({ top: 0, behavior: "smooth" })` for smooth scroll

3. **Browser back/forward**:
   - `useEffect` watches `searchParams`
   - Syncs `activeSlug` and `showGallery` with URL
   - Fetches project data if not cached

### URL Redirects (next.config.mjs)

Old `/slug` URLs redirect to `/?project=slug`:

```js
async redirects() {
  return [
    {
      source: "/:slug((?!studio|api|_next|favicon|robots|sitemap)[a-zA-Z0-9_-]+)",
      destination: "/?project=:slug",
      permanent: false,
    },
  ];
}
```

**Important**: The regex must require at least one character (`[a-zA-Z0-9_-]+`) to prevent matching the root path `/` which causes infinite redirect loops.

### Suspense Requirement

`useSearchParams()` requires Suspense boundary. `SiteLayoutClient` wraps content:

```js
export default function SiteLayoutClient({ artistName, projects, children }) {
  return (
    <Suspense fallback={...}>
      <SiteLayoutInner artistName={artistName} projects={projects}>
        {children}
      </SiteLayoutInner>
    </Suspense>
  );
}
```

### Cache Management

- Uses `useRef` to avoid stale closure issues with `projectCache`
- `cacheRef.current` is updated via `useEffect` when `projectCache` changes
- All functions use `cacheRef.current` to check cache state

### Troubleshooting

#### Infinite redirect loop on `/`
- Check `next.config.mjs` redirect regex
- Must exclude empty strings: use `[a-zA-Z0-9_-]+` not `.*`

#### Project not displaying after click
- Check browser console for fetch errors
- Verify `projectDetailQuery` returns expected data
- Check that `seedProject` is called with SSR data

#### Browser back not working
- Ensure `searchParams` effect dependencies are correct
- Check that `activeSlug` comparison works

#### Prefetch not working
- Verify `onHover` prop is passed through `ProjectGrid` to `GridTile`
- Check that `prefetchProject` is called in `handleMouseEnter`

---

## Custom Scroll Animation

### Overview
Project selection triggers a custom smooth scroll to top with configurable easing. Located in `context/ProjectContext.js`.

### Current Settings
- **Duration**: 1400ms
- **Easing**: Asymmetric - exponential ease-in, quartic ease-out

### Easing Function
```js
const customEase = (t) => {
  if (t < 0.5) {
    // Ease-in expo for first half (slow start, fast acceleration)
    return Math.pow(2, 16 * t - 8) / 2;
  }
  // Ease-out quart for second half (firm landing)
  return 1 - Math.pow(-2 * t + 2, 4) / 2;
};
```

### Animation Implementation
```js
function smoothScrollToTop(duration = 1400) {
  const start = window.scrollY;
  if (start === 0) return;

  const startTime = performance.now();

  function scroll(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = customEase(progress);

    window.scrollTo(0, start * (1 - eased));

    if (progress < 1) {
      requestAnimationFrame(scroll);
    }
  }

  requestAnimationFrame(scroll);
}
```

### Easing Options Reference
| Easing | Formula | Character |
|--------|---------|-----------|
| Cubic | `t * t * t` | Subtle |
| Quart | `t * t * t * t` | Medium |
| Quint | `t * t * t * t * t` | Pronounced |
| Expo | `Math.pow(2, 10 * t - 10)` | Dramatic |

### Ease-in-out Formulas
- **Cubic**: `t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2`
- **Quart**: `t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2`
- **Quint**: `t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2`
- **Expo**: `t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2`

### Tuning Notes
- Longer duration = more dramatic feel
- Higher power (quint vs cubic) = more pronounced ease
- Asymmetric curves avoid stutter (don't mix incompatible curves at the midpoint)
- Expo ease-in + quart/quint ease-out = slow start, fast middle, controlled landing

---

## VideoPlayer Component

### Overview
Custom video player component using HLS streaming with controls overlay. Located in `components/VideoPlayer.js`.

### Props
- `playbackId` - Mux playback ID
- `aspectRatio` - Video aspect ratio from Mux (e.g., "16:9" string or number)
- `autoPlay` - Whether to autoplay when ready (default: false)
- `onPrevItem` / `onNextItem` - Callbacks for media gallery navigation

### Key Architecture Decisions

#### Container Sizing Problem
**Problem**: Video player controls need to match the video's actual rendered dimensions, but:
- `inline-block` + `height: 100%` on wrapper → wrapper takes full container height
- When viewport is tall, video (constrained by aspect ratio) doesn't fill container
- Controls at `bottom: 0` end up below the video with a gap

**Three options considered**:
1. **JavaScript ResizeObserver** - Measure video, set wrapper size via state (precise, more code)
2. **Let video dictate height** - Remove height constraints, video sizes naturally (simpler, controls always correct)
3. **Absolute positioning + object-fit** - Complex measurement approach

**Chosen: Option 2** - Video uses `maxHeight: 73vh` and `maxWidth: 100%`, wrapper sizes to content naturally.

#### Structure
```jsx
<div style={{ display: "flex", alignItems: "flex-start" }}>  {/* Outer container */}
  <div style={{ position: "relative", display: "inline-block", ...wrapperStyle }}>  {/* Wrapper */}
    <video style={{ maxHeight: "73vh", maxWidth: "100%", display: "block" }} />
    {isReady && <div style={{ position: "absolute", bottom: 0 }}>controls</div>}
  </div>
</div>
```

#### Sizing with Aspect Ratio (Preventing Layout Shift & Overflow)
To prevent layout shift when video loads AND prevent overflow:
- Pass `aspectRatio` from Sanity/Mux data
- Parse Mux format ("16:9" string → number): `aspectRatio.split(":").reduce((a, b) => a / b)`
- **Key insight**: Must apply sizing ALWAYS (not just before `isReady`) to prevent resize jump when video loads
- Use `min()` to constrain width to either viewport or calculated size:
  ```js
  if (parsedAspectRatio) {
    wrapperStyle.aspectRatio = parsedAspectRatio;
    wrapperStyle.width = `min(100%, calc(73vh * ${parsedAspectRatio}))`;
    wrapperStyle.height = "auto";
  }
  ```
- Video element uses `width: 100%`, `height: 100%` to fill wrapper
- This ensures:
  - No overflow (width capped at 100% of container)
  - No resize jump (sizing consistent before/after load)
  - Correct aspect ratio maintained via wrapper

#### Buffering Before Autoplay
**Problem**: Video would start playing low-quality segments before highest quality loaded.

**Solution**: Wait for `canplaythrough` event before marking video as ready:
```js
video.addEventListener("canplaythrough", () => setIsReady(true));
```

Autoplay effect depends on `isReady`, not just manifest parsing:
```js
useEffect(() => {
  if (!isReady || !autoPlay || hasAutoPlayed) return;
  video.play();
  setHasAutoPlayed(true);
}, [isReady, autoPlay, hasAutoPlayed]);
```

#### Controls Visibility
- Controls only render when `isReady` is true: `{isReady && <controls />}`
- Video fades in with `opacity: isReady ? 1 : 0` and `transition: "opacity 200ms ease-in"`

#### Smooth Progress Bar
HTML5 video `timeupdate` fires roughly every 250ms, causing jerky progress bar updates.

**Solution**: Add CSS transition to interpolate between updates:
```js
style={{
  width: `${progress}%`,
  transition: "width 250ms linear",
}}
```

### HLS Quality Forcing
See the "HLS Quality Forcing" section under "Mux Video Integration" above for the correct implementation.

**Key insight discovered**: The old code checked `video.canPlayType("application/vnd.apple.mpegurl")` to decide whether to use native HLS or hls.js. Chrome returns `"maybe"` for this (which is truthy), causing it to use native HLS which doesn't support quality forcing. The fix is to detect Safari specifically via user agent.

**Note**: Safari uses native HLS and only accepts URL hints (`?max_resolution=2160p`), which are not strictly enforced.

### Controls Layout
- No gradient background (removed for cleaner look)
- Fixed-width buttons for consistent layout
- Flexible progress bar fills remaining space
- Tabular nums for time display alignment
