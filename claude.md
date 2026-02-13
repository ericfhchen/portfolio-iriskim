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
- Uses hls.js for ALL browsers (including Safari) to force highest quality
- Safari's native HLS uses ABR and doesn't allow forcing quality - must use hls.js
- Desktop: Forces highest available quality
- Mobile (≤768px): Caps at 1440p

##### HLS Quality Forcing

**Critical**: Use hls.js for ALL browsers, not just non-Safari.
Safari's native HLS player uses adaptive bitrate and doesn't respect quality hints.
The `?max_resolution=2160p` URL param is just a hint that Safari often ignores.

hls.js configuration:
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
- **Most likely:** Browser is using native HLS instead of hls.js
- Native HLS (Safari, Chrome) uses adaptive bitrate and doesn't allow forcing quality
- **Fix:** Always use hls.js for all browsers, never fall back to native HLS
- Ensure hls.js config: `autoStartLoad: false`, set level in `MANIFEST_PARSED`, call `attachMedia()` AFTER setting level

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
  activeSlug,              // Currently selected project slug
  activeProject,           // Full project data from cache
  showGallery,             // Whether gallery is visible
  isSwitching,             // Whether switching between projects (for fade transitions)
  animationPhase,          // 'idle' | 'scrolling-to-peek' | 'grid-animating' | 'gallery-fading-in' | 'ready'
  galleryScrollOpacity,    // Gallery opacity based on grid overlap (0-1)
  setGalleryScrollOpacity, // Setter for gallery opacity (used by PortfolioShell)
  projects,                // All projects list
  projectCache,            // Map of slug → project data
  selectProject,           // (slug) → updates URL, orchestrates animation sequence
  prefetchProject,         // (slug) → fetches in background (fire-and-forget)
  closeProject,            // () → animated sequence: fade out gallery → animate grid to landing → navigate to /
  seedProject,             // (project) → seeds cache with SSR data, sets phase to 'ready'
} = useProject();
```

### Data Flow

1. **SSR (direct link to `/?project=slug`)**:
   - `page.js` fetches project server-side
   - Passes `initialProject` to `PortfolioShell`
   - `PortfolioShell` calls `seedProject()` to populate cache
   - `animationPhase` set to `'ready'` immediately (no animation)

2. **Client navigation (clicking tile/sidebar)**:
   - Hover triggers `prefetchProject(slug)` - fetches in background
   - Click triggers `selectProject(slug)` - orchestrates animation sequence:
     - From landing or scrolled: `scrolling-to-peek` (1000ms custom ease) → `grid-animating` (800ms) → `gallery-fading-in` (300ms) → `ready`
     - Already at top with project: `gallery-fading-in` (crossfade) → `ready`
   - Video autoplay gates on `animationPhase === 'ready'`

3. **Return to home (clicking title link)**:
   - Click triggers `closeProject()` - orchestrates reverse animation:
     - If scrolled: `scrolling-to-peek` (800ms) → `gallery-fading-out` (300ms) → `grid-returning` (800ms) → `idle`
     - If at top: `gallery-fading-out` (300ms) → `grid-returning` (800ms) → `idle`
   - URL updates to `/` after animation completes

4. **Browser back/forward**:
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

## Project Selection Animation

### Overview
When selecting a project, the grid animates to a "peek" position first, then the gallery fades in, and finally video autoplay is allowed. This creates a smooth, sequenced transition.

### Animation Phases
The `animationPhase` state in `ProjectContext` controls the sequence:

**Forward (opening project):**
| Phase | Duration | Description |
|-------|----------|-------------|
| `idle` | - | No project selected |
| `scrolling-to-peek` | 1000ms | Smooth scroll to top with custom easing |
| `grid-animating` | 800ms | Grid slides down to peek position |
| `gallery-fading-in` | 300ms | Gallery fades in from opacity 0 |
| `ready` | - | Animation complete, video can autoplay |

**Reverse (returning home):**
| Phase | Duration | Description |
|-------|----------|-------------|
| `gallery-fading-out` | 300ms | Gallery fades out |
| `grid-returning` | 800ms | Grid slides up to landing position |
| `idle` | - | Back to initial state |

### Grid Peek Position
When a project is selected, the grid is pushed down so only ~15% of the first row peeks at the bottom of the viewport. This is calculated in `PortfolioShell.js`:

```js
const peek = firstRow.offsetHeight * 0.15;
setPeekAmount(peek);
setGridPeekTop(window.innerHeight - peek);
```

The grid uses `padding-top` with CSS transition for the animation:
```js
style={{
  paddingTop: showGallery && gridPeekTop ? gridPeekTop : landingPadding,
  transition: animationPhase === 'grid-animating'
    ? 'padding-top 800ms cubic-bezier(0.4, 0, 0.2, 1)'
    : 'none',
}}
```

### Landing Page Peek
The landing page shows 2 full rows with an 8% peek of the 3rd row at the bottom of the viewport.

### Video Autoplay Gating
Videos only autoplay after the animation sequence completes:
- `MediaGallery` receives `allowAutoPlay={animationPhase === 'ready'}`
- `VideoPlayer` checks `allowAutoPlay` before triggering autoplay
- Video can buffer during animation, but won't start playing until `ready`

### Animation Scenarios

1. **From landing page**: Grid animates → Gallery fades in → Video plays
2. **Switching projects at scroll=0**: Gallery crossfades (no grid animation)
3. **Switching projects while scrolled**: Grid animates → Gallery crossfades → Video plays
4. **SSR/direct link**: No animation, `animationPhase` set to `ready` immediately

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

---

## Fixed Gallery with Grid Overlap Fade

### Overview
The gallery is fixed in place while the grid scrolls over it. As the grid overlaps the gallery, the gallery fades out linearly. This creates a natural transition between viewing a project and browsing the grid.

### Architecture

#### Gallery Positioning
Gallery is fixed, positioned from top to the peek line:
```js
style={{
  position: 'fixed',
  top: 0,
  left: 'calc(100% / 6)',  // Sidebar width
  right: 0,
  height: `calc(100vh - ${peekAmount}px)`,
  zIndex: 10,  // Above grid so gallery can receive pointer events
  opacity: computedGalleryOpacity,
  pointerEvents: computedGalleryOpacity < 0.1 ? 'none' : 'auto',
}}
```

#### Grid Positioning
Grid is below gallery in z-order:
```js
style={{
  position: 'relative',
  zIndex: 2,
  paddingTop: showGallery && gridPeekTop ? gridPeekTop : landingPadding,
}}
```

**Important**: Do NOT add `backgroundColor` to the grid - it will block everything behind it.

### Overlap-Based Fade Calculation

**Critical**: Measure the first row's position, not the grid container. The grid container has large `paddingTop` which would give wrong measurements.

```js
const handleScroll = () => {
  // Don't update opacity during animation phases - keep it at 1
  if (animationPhase !== 'ready') {
    return;
  }

  // Get the first row of tiles, not the grid container (which has padding)
  const rowContainer = gridRef.current.querySelector('.w-full.flex.flex-col');
  const firstRow = rowContainer?.children[0];
  if (!firstRow) return;

  const firstRowTop = firstRow.getBoundingClientRect().top;
  const effectivePeek = peekAmount || window.innerHeight * 0.15;
  const galleryBottom = window.innerHeight - effectivePeek;
  const fadeEndY = window.innerHeight * 0.5;

  if (firstRowTop >= galleryBottom) {
    setGalleryScrollOpacity(1);
  } else if (firstRowTop <= fadeEndY) {
    setGalleryScrollOpacity(0);
  } else {
    const progress = (galleryBottom - firstRowTop) / (galleryBottom - fadeEndY);
    setGalleryScrollOpacity(1 - progress);
  }
};
```

### Key Points

1. **Gallery stays fixed** - doesn't scroll with the page
2. **Gallery has higher z-index (10)** - so it can receive pointer events when visible
3. **Pointer events toggle** - `pointerEvents: 'none'` when opacity < 0.1 allows clicks through to grid
4. **Measure first row, not container** - grid container has padding that throws off measurements
5. **Only calculate during 'ready' phase** - prevents opacity from being set to 0 during animation
6. **Linear fade** - opacity fades linearly as first row overlaps gallery
7. **Fade ends at 50% viewport** - gallery fully transparent when first row reaches 50% vh
8. **URL stays with project** - don't clear `?project=slug` when faded (would break scroll-back)

### Computed Gallery Opacity

```js
const computedGalleryOpacity = (() => {
  if (isFadingOut) return 0;
  if (animationPhase === 'grid-animating' || animationPhase === 'scrolling-to-peek' || animationPhase === 'idle') return 0;
  // In 'gallery-fading-in' or 'ready' phase, show based on scroll opacity
  return galleryScrollOpacity;
})();
```

### Sidebar Integration
Sidebar muting uses `galleryScrollOpacity` instead of snap state:
```js
// In SidebarClient
const hasActiveProject = !!activeSlug && galleryScrollOpacity > 0.5;
const shouldMuteOthers = hasActiveHover || hasActiveProject;
```

### Custom Scroll Easing

Uses `lib/easing.js` for smooth scroll animations:
```js
import { smoothScrollTo, customEase } from '@/lib/easing';

// In selectProject
await smoothScrollTo(0, 1000, customEase);
```

The `customEase` function provides expo ease-in and quart ease-out for a refined feel.

### Troubleshooting

#### Gallery not appearing (opacity 0)
- Check `animationPhase` - should be `'gallery-fading-in'` or `'ready'`
- Check `galleryScrollOpacity` - should be 1 when at scroll position 0
- Scroll handler may be firing during animation and setting opacity to 0

#### Can't click on gallery elements
- Gallery needs higher `zIndex` than grid (currently 10 vs 2)
- Check `pointerEvents` - should be `'auto'` when opacity >= 0.1

#### Fade not working on scroll
- Ensure measuring first row, not grid container
- Scroll handler should only run when `animationPhase === 'ready'`
- Check that `peekAmount` is calculated

---

## Landing Page Grid Positioning

### Overview
On the homepage landing (no project selected), the grid is positioned so that only the first 2 rows are visible with the 3rd row peeking at the bottom of the viewport. This creates a dramatic "reveal" effect where users scroll down to discover more projects.

### Files
- `components/PortfolioShell.js` - Handles padding calculation and visibility

### How It Works

#### Dynamic Top Padding
The grid container receives calculated top padding that pushes the content down:
```js
const [gridTopPadding, setGridTopPadding] = useState(0);
const [isPaddingReady, setIsPaddingReady] = useState(false);
```

#### Padding Calculation
```js
useEffect(() => {
  // Only apply when no project is selected
  if (initialProject || showGallery) {
    setGridTopPadding(0);
    setIsPaddingReady(true);
    return;
  }

  const calculatePadding = () => {
    const vh = window.innerHeight;
    const gap = 24; // gap-6

    // Get first 2 rows and 3rd row for peek (from TOP of grid)
    const firstRow = rowElements[0];
    const secondRow = rowElements[1];
    const thirdRow = rowElements[2];

    // Height of content we want visible: 2 full rows + 15% peek of 3rd
    const top2Height = firstRow.offsetHeight + gap + secondRow.offsetHeight;
    const peekAmount = thirdRow.offsetHeight * 0.15;
    const visibleOnLoad = top2Height + gap + peekAmount;

    // Padding = viewport height - visible content - base padding
    const padding = Math.max(0, vh - visibleOnLoad - 16);
    setGridTopPadding(padding);
    setIsPaddingReady(true);
  };

  requestAnimationFrame(calculatePadding);
  window.addEventListener('resize', calculatePadding);
  return () => window.removeEventListener('resize', calculatePadding);
}, [initialProject, showGallery]);
```

#### Preventing Flash on Load
**Problem**: Grid would flash at the top of the page before padding was applied, then jump down.

**Solution**: Hide grid until padding is calculated:
```js
<div
  ref={gridRef}
  className="p-4"
  style={{
    paddingTop: gridTopPadding > 0 ? gridTopPadding + 16 : 16,
    opacity: isPaddingReady ? 1 : 0,
  }}
>
```

Key points:
- `isPaddingReady` starts as `false`
- Grid has `opacity: 0` until padding is calculated
- `requestAnimationFrame` ensures DOM measurements are accurate
- Once padding is set, `isPaddingReady` becomes `true` and grid appears

#### When Padding Is Removed
- When a project is selected (`showGallery` becomes true)
- When navigating directly to a project URL (`initialProject` is set)
- Padding resets to 0 and grid shows normally

### Visual Result
```
┌─────────────────────────────┐
│                             │  ← Empty space (padding)
│                             │
│                             │
├─────────────────────────────┤
│  Row 1 (full)               │
├─────────────────────────────┤
│  Row 2 (full)               │
├─────────────────────────────┤
│  Row 3 (15% peek)           │  ← Just a sliver visible
└─────────────────────────────┘  ← Bottom of viewport
```

User scrolls down to reveal more rows.

---

## Grid Animation System (Return to Home)

### Overview
When closing a project (clicking the title link to return home), the grid animates smoothly from the peek position back to the landing position. This requires careful coordination between scroll position, padding values, and animation phases.

### Key Challenge: Scroll + Padding Animation Conflict
When the user is scrolled down while viewing a project and clicks to return home:
- Grid is at peek padding (viewport height - 15% of first row)
- User has scrolled, so `window.scrollY > 0`
- Animating padding while scroll is non-zero causes visual jumping

### Solution: Capture Visual Position, Snap Scroll, Then Animate

The key insight is that the grid's **visual position** on screen equals `paddingTop - scrollY`. To animate smoothly:

1. **Capture current visual position** when `gallery-fading-out` starts:
   ```js
   const currentVisualPadding = gridPeekTop - window.scrollY;
   setGridReturnStart(currentVisualPadding);
   ```

2. **Snap scroll to 0 immediately** (no visual change because padding compensates):
   ```js
   if (window.scrollY > 0) {
     window.scrollTo(0, 0);
   }
   ```

3. **Animate padding** from `gridReturnStart` to landing position

### Animation Phases for Closing

| Phase | Duration | What Happens |
|-------|----------|--------------|
| `gallery-fading-out` | 300ms | Gallery opacity → 0, capture grid position, snap scroll |
| `grid-returning` | 800ms | Padding animates from captured position to landing |
| `idle` | - | Animation complete, URL updated to `/` |

### State Management

#### In ProjectContext.js
```js
// navigationTargetRef uses undefined vs null to distinguish states
const navigationTargetRef = useRef(undefined);
// undefined = no navigation in progress
// null = navigating to home (searchParams.get("project") returns null)
// "slug" = navigating to a project

const closeProject = useCallback(async () => {
  navigationTargetRef.current = null;

  setAnimationPhase('gallery-fading-out');
  await new Promise(r => setTimeout(r, 300));

  setAnimationPhase('grid-returning');
  await new Promise(r => setTimeout(r, 800));

  setActiveSlug(null);
  setShowGallery(false);
  setAnimationPhase('idle');
  router.push("/", { scroll: false });
}, [router, activeSlug]);
```

#### In PortfolioShell.js
```js
// Persist landing padding even when gallery is open
const landingPaddingRef = useRef(0);

// Capture starting position for return animation
const [gridReturnStart, setGridReturnStart] = useState(null);

// Track if transition should be enabled (persists through phases)
const [transitionEnabled, setTransitionEnabled] = useState(false);

// Capture position and snap scroll when fading out
useEffect(() => {
  if (animationPhase === 'gallery-fading-out' && gridPeekTop) {
    const currentVisualPadding = gridPeekTop - window.scrollY;
    setGridReturnStart(currentVisualPadding);
    if (window.scrollY > 0) {
      window.scrollTo(0, 0);
    }
  } else if (animationPhase === 'idle') {
    setGridReturnStart(null);
  }
}, [animationPhase, gridPeekTop]);
```

### Padding Logic (All Scenarios)

```js
paddingTop: (() => {
  // Returning home: use captured position during fade-out
  if (animationPhase === 'gallery-fading-out' && gridReturnStart !== null) {
    return gridReturnStart;
  }
  // Animate to landing during grid-returning
  if (animationPhase === 'grid-returning') {
    return landingPaddingRef.current > 0 ? landingPaddingRef.current + 16 : 16;
  }

  // Going to project from landing: keep at landing during scroll
  if (animationPhase === 'scrolling-to-peek' && !activeSlug) {
    return gridTopPadding > 0 ? gridTopPadding + 16 : 16;
  }
  if (animationPhase === 'scrolling-to-peek' && activeSlug && !displayedProject) {
    return gridTopPadding > 0 ? gridTopPadding + 16 : 16;
  }

  // Normal peek position when gallery is open
  if (showGallery && gridPeekTop) {
    return gridPeekTop;
  }
  // Landing position
  return gridTopPadding > 0 ? gridTopPadding + 16 : 16;
})()
```

### Transition State Management

CSS transitions must persist through the entire animation sequence. If transition is disabled mid-animation, the padding will snap instead of animate.

```js
useEffect(() => {
  if (
    animationPhase === 'scrolling-to-peek' ||
    animationPhase === 'grid-animating' ||
    animationPhase === 'gallery-fading-in' ||
    animationPhase === 'gallery-fading-out' ||
    animationPhase === 'grid-returning'
  ) {
    setTransitionEnabled(true);
  } else if (animationPhase === 'ready' || animationPhase === 'idle') {
    // Delay disabling to prevent snap when phase changes
    const timer = setTimeout(() => setTransitionEnabled(false), 100);
    return () => clearTimeout(timer);
  }
}, [animationPhase]);
```

### Gallery Container Visibility

Prevent gallery flash when coming from landing (no existing project):
```js
const shouldShowGalleryContainer =
  displayedProject ||
  (showGallery && (animationPhase !== 'scrolling-to-peek' || isSwitching));
```

- `displayedProject` - show if we have a project to display
- `showGallery && !scrolling-to-peek` - show during most phases
- `isSwitching` - show during project-to-project switches even while scrolling

### Gallery Opacity (All Phases)

```js
const computedGalleryOpacity = (() => {
  if (isFadingOut) return 0;
  if (animationPhase === 'gallery-fading-out') return 0;
  if (animationPhase === 'grid-animating') return 0;
  if (animationPhase === 'scrolling-to-peek') return 0;
  if (animationPhase === 'idle') return 0;
  if (animationPhase === 'grid-returning') return 0;
  // 'gallery-fading-in' or 'ready' - show based on scroll
  return galleryScrollOpacity;
})();
```

### selectProject Scenarios

Two distinct paths based on where the user is coming from:

**From Landing (wasFromLanding = true):**
1. Set `activeSlug`, push URL
2. Scroll to top if needed (padding stays at landing)
3. Set `showGallery`, start `grid-animating` (padding → peek)
4. `gallery-fading-in` → `ready`

**From Project (wasFromLanding = false):**
1. Set `activeSlug`, push URL, set `showGallery`
2. Scroll to top if needed (padding stays at peek)
3. `gallery-fading-in` (crossfade) → `ready`

### Troubleshooting

#### Grid jumps to top before animating
- `gridReturnStart` not being captured correctly
- Check that `gallery-fading-out` effect runs before scroll snaps

#### Grid stutters/animates twice
- `transitionEnabled` being toggled mid-animation
- Ensure transition persists through all phases

#### Gallery flashes during scroll from landing
- `shouldShowGalleryContainer` returning true when it shouldn't
- Check `displayedProject` is null when coming from landing

#### Project-to-project causes grid jump
- Padding logic needs to distinguish scrolling-from-landing vs scrolling-from-project
- Check `!displayedProject` condition in padding logic

---

## Synchronized Scroll + Padding Animation (Close Animation Fix)

### Problem
When returning home from a project while scrolled, the grid animation had stuttering/jitter issues:
1. CSS transition on padding and JS animation on scroll had mismatched easing curves
2. React re-renders during animation caused frame drops
3. End-of-animation jitter when React took over from JS animation

### Solution: Pure JavaScript Animation

Instead of mixing CSS transitions with JS scroll animation, use **pure JavaScript** to animate both scroll and padding in the same `requestAnimationFrame` callback.

#### Key Files
- `lib/easing.js` - Contains `materialEase` function matching CSS `cubic-bezier(0.4, 0, 0.2, 1)`
- `context/ProjectContext.js` - Orchestrates animation phases, exposes `jsAnimationTarget` state
- `components/PortfolioShell.js` - Runs JS animation via `useEffect`, directly manipulates DOM

#### Animation Phases for Closing (Updated)
| Phase | Duration | Description |
|-------|----------|-------------|
| `gallery-preparing-fade-out` | ~2 frames | Enables CSS transition before opacity changes (prevents flicker) |
| `gallery-fading-out` | 300ms | Gallery fades out via CSS transition |
| `grid-returning-js` | 800ms | JS animates both scroll and padding simultaneously |
| `idle` | - | Animation complete |

#### The JS Animation Effect
```js
// In PortfolioShell.js
useEffect(() => {
  if (animationPhase !== 'grid-returning-js' || !jsAnimationTarget || !gridRef.current) {
    return;
  }

  const gridElement = gridRef.current;
  const startScrollY = window.scrollY;
  const startPadding = gridPeekTop || 0;
  const targetPadding = landingPaddingRef.current > 0 ? landingPaddingRef.current + 16 : 16;
  const duration = 800;
  const startTime = performance.now();

  // Disable CSS transition - we're driving this with JS
  gridElement.style.transition = 'none';
  gridElement.style.paddingTop = `${startPadding}px`;

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = materialEase(progress);

    // Update BOTH in the same frame - direct DOM manipulation
    const newScrollY = startScrollY * (1 - eased);
    const newPadding = startPadding + (targetPadding - startPadding) * eased;

    window.scrollTo(0, newScrollY);
    gridElement.style.paddingTop = `${newPadding}px`;

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Ensure exact final values
      window.scrollTo(0, 0);
      gridElement.style.paddingTop = `${targetPadding}px`;

      // Wait one frame before notifying React - prevents jitter
      requestAnimationFrame(() => {
        jsAnimationTarget.onComplete?.();
      });
    }
  }

  requestAnimationFrame(animate);
}, [animationPhase, jsAnimationTarget, gridPeekTop]);
```

### Key Learnings

#### 1. Direct DOM Manipulation for Smooth Animation
- **Don't use React state** (`setState`) during animation - each call triggers a re-render
- **Directly set `element.style.paddingTop`** for 60fps animation
- Only use React state for the final position after animation completes

#### 2. Synchronized Easing
- Both scroll and padding must use the **exact same easing function**
- `materialEase` in JS matches `cubic-bezier(0.4, 0, 0.2, 1)` in CSS
- Even small differences cause visible desynchronization

#### 3. Prevent End-of-Animation Jitter
- When JS animation ends and React re-renders, there can be a brief jump
- **Fix 1**: Use `requestAnimationFrame` before calling `onComplete()` - lets browser paint final frame
- **Fix 2**: Ensure React's computed padding matches JS's target padding exactly
- **Fix 3**: Use `landingPaddingRef.current` (ref) instead of `gridTopPadding` (state) - state may be stale

#### 4. Prevent Gallery Flicker on Fade-Out
- CSS transition must be enabled BEFORE opacity changes, not in the same render
- Add a preparation phase (`gallery-preparing-fade-out`) that only enables transition
- Use double `requestAnimationFrame` to ensure browser applies transition before opacity change:
  ```js
  setAnimationPhase('gallery-preparing-fade-out');
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  setAnimationPhase('gallery-fading-out');  // Now opacity changes with transition active
  ```

#### 5. Disable CSS Transition During JS Animation
```js
// In the style object
transition: (transitionEnabled && animationPhase !== 'grid-returning-js')
  ? 'padding-top 800ms cubic-bezier(0.4, 0, 0.2, 1)'
  : 'none',
```

### Easing Function (lib/easing.js)
```js
/**
 * CSS cubic-bezier(0.4, 0, 0.2, 1) equivalent - Material Design standard easing
 * Must match the CSS transition timing function exactly for synchronized animations
 */
export const materialEase = (t) => {
  const p1x = 0.4, p1y = 0, p2x = 0.2, p2y = 1;

  // Newton-Raphson iteration to solve bezier
  let x = t;
  for (let i = 0; i < 8; i++) {
    const bx = 3 * p1x * x * (1 - x) * (1 - x) + 3 * p2x * x * x * (1 - x) + x * x * x;
    const dx = 3 * p1x * (1 - x) * (1 - x) - 6 * p1x * x * (1 - x) + 3 * p2x * 2 * x * (1 - x) - 3 * p2x * x * x + 3 * x * x;
    if (Math.abs(bx - t) < 0.0001) break;
    x -= (bx - t) / dx;
  }
  return 3 * p1y * x * (1 - x) * (1 - x) + 3 * p2y * x * x * (1 - x) + x * x * x;
};
```

### Troubleshooting

#### Animation stutters throughout
- Check if React state is being updated during animation
- Ensure using direct DOM manipulation, not `setState`
- Verify scroll handler returns early during animation phases

#### Jitter at end of animation
- React's computed padding doesn't match JS's target
- Use ref (`landingPaddingRef.current`) not state (`gridTopPadding`) for landing value
- Add `requestAnimationFrame` before `onComplete()`

#### Gallery flickers before fading out
- CSS transition and opacity change happening in same render
- Add `gallery-preparing-fade-out` phase with double rAF delay

#### Visual position equation
`visualTop = paddingTop - scrollY`

To keep visual position constant while changing both:
- Decrease padding by X → visual moves up by X
- Decrease scroll by X → visual moves down by X
- Net effect: both decrease together = smooth animation to new position
