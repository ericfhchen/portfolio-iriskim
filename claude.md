# Claude Notes

## Project Context
Portfolio site for Iris Kim using Next.js 15 and Sanity CMS.

## Session Notes

### Sidebar Implementation
- Added `Sidebar` component to `app/layout.js`
- Sidebar is fixed position, takes `w-1/6` (16.666667%) of screen width
- Main content has `ml-[16.666667%]` to offset the fixed sidebar
- Do NOT run `npm run dev` or attempt to check if rendering works
