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
- MP4 renditions capped at 1080p (`capped-1080p`)

### sanity.config.js Mux Settings
```js
muxInput({
  mp4_support: "capped-1080p",    // Enables MP4 for hover previews
  max_resolution_tier: "2160p",   // Allows up to 4K HLS streaming
}),
```

### Important: These settings only apply to NEW uploads
- Existing assets keep their original settings
- To enable MP4 on existing assets, use the Mux API (see below)
- After changing config, must clear cache (`rm -rf .next`) and restart dev server

### MP4 Support Options
- `"capped-1080p"` - Current option, generates single MP4 up to 1080p (filename: `capped-1080p.mp4`)
- `"standard"` - **DEPRECATED** - was for multiple quality levels (`low.mp4`, `medium.mp4`, `high.mp4`) but no longer works on Basic tier
- `"none"` - No MP4 renditions

### Enable MP4 on Existing Assets via API
```js
// Requires MUX_TOKEN_ID and MUX_TOKEN_SECRET in .env.local
const auth = Buffer.from(MUX_TOKEN_ID + ':' + MUX_TOKEN_SECRET).toString('base64');

fetch(`https://api.mux.com/video/v1/assets/${assetId}/mp4-support`, {
  method: 'PUT',
  headers: {
    'Authorization': 'Basic ' + auth,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ mp4_support: 'capped-1080p' }),
});
```

### Video Components

#### GridTile.js (Hover Preview)
- Uses MP4 for fast hover playback: `https://stream.mux.com/${playbackId}/capped-1080p.mp4`
- Muted, loops, plays on hover
- Lazy loads when tile is near viewport (200px margin)

#### VideoPlayer.js (Main Player)
- Uses HLS streaming: `https://stream.mux.com/${playbackId}.m3u8`
- Uses hls.js for non-Safari browsers (Safari has native HLS)
- Configured to force highest quality immediately (no adaptive bitrate ramp-up)
- Desktop: Forces highest available quality
- Mobile (≤768px): Caps at 1440p

##### HLS Quality Forcing
```js
hls = new Hls({
  abrController: undefined,      // Disable ABR completely
  autoStartLoad: false,          // Don't load until we set quality
  capLevelToPlayerSize: false,   // Don't cap based on player size
});

hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
  // Set to highest level before starting load
  hls.currentLevel = levels.length - 1;
  hls.nextLevel = levels.length - 1;
  hls.loadLevel = levels.length - 1;
  hls.startLoad();  // Now start loading at correct quality
});
```

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

#### 404 on MP4 hover preview
- Asset doesn't have MP4 support enabled
- Enable via Mux API (see above)
- Or re-upload after config is set

#### Video starts at low quality
- hls.js ABR is ramping up
- Ensure `autoStartLoad: false` and manual level setting before `startLoad()`

#### New uploads not getting MP4/4K
- Config changes require cache clear and server restart
- Run `rm -rf .next && npm run dev`

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
