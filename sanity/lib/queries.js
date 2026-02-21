export const allProjectsQuery = `*[_type == "project"] | order(orderRank asc) {
  _id,
  title,
  slug,
  year,
  role,
  caption,
  tileSize,
  projectCode,
  coverImage,
  "coverAspectRatio": coverImage.asset->metadata.dimensions.aspectRatio,
  "muxPlaybackId": media[_type == "mux.video"][0].asset->playbackId,
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

export const projectDetailQuery = `*[_type == "project" && slug.current == $slug][0] {
  _id,
  title,
  slug,
  year,
  caption,
  tileSize,
  projectCode,
  coverImage,
  "coverImageUrl": coverImage.asset->url,
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
  name,
  bio,
  contactLinks,
  informationImage {
    asset-> {
      url,
      metadata {
        dimensions
      }
    },
    hotspot
  },
  siteUrl,
  metaTitle,
  metaDescription,
  "ogImageUrl": ogImage.asset->url,
  "faviconUrl": favicon.asset->url
}`;
