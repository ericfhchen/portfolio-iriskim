export const allProjectsQuery = `*[_type == "project"] | order(orderRank asc) {
  _id,
  title,
  slug,
  year,
  tileSize,
  coverImage,
  "coverAspectRatio": coverImage.asset->metadata.dimensions.aspectRatio,
  "muxPlaybackId": media[_type == "mux.video"][0].asset->playbackId
}`;

export const projectDetailQuery = `*[_type == "project" && slug.current == $slug][0] {
  _id,
  title,
  slug,
  year,
  tileSize,
  projectCode,
  coverImage,
  media[] {
    _type,
    _key,
    ...,
    _type == "image" => {
      "aspectRatio": asset->metadata.dimensions.aspectRatio,
      asset
    },
    _type == "mux.video" => {
      "playbackId": asset->playbackId,
      "aspectRatio": asset->data.aspect_ratio
    }
  }
}`;

export const siteSettingsQuery = `*[_type == "siteSettings"][0] {
  artistName,
  siteTitle
}`;
