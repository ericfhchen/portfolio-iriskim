import { defineField, defineType } from "sanity";

export default defineType({
  name: "siteSettings",
  title: "Site Settings",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      description: "Artist name — used as site title, tab title, and header link",
    }),
    defineField({
      name: "informationImage",
      title: "Information Image",
      type: "image",
      options: { hotspot: true },
      description: "Image shown at top of information page",
    }),
    defineField({
      name: "bio",
      title: "Bio",
      type: "array",
      of: [
        {
          type: "block",
          styles: [{ title: "Normal", value: "normal" }],
          lists: [],
          marks: {
            decorators: [
              { title: "Bold", value: "strong" },
              { title: "Italic", value: "em" },
            ],
            annotations: [
              {
                name: "link",
                type: "object",
                title: "Link",
                fields: [
                  {
                    name: "href",
                    type: "url",
                    title: "URL",
                  },
                ],
              },
            ],
          },
        },
      ],
      description: "Artist bio text for the information page",
    }),
    defineField({
      name: "contactLinks",
      title: "Contact & Links",
      type: "array",
      of: [
        {
          type: "block",
          styles: [{ title: "Normal", value: "normal" }],
          lists: [],
          marks: {
            decorators: [
              { title: "Bold", value: "strong" },
              { title: "Italic", value: "em" },
            ],
            annotations: [
              {
                name: "link",
                type: "object",
                title: "Link",
                fields: [
                  {
                    name: "href",
                    type: "url",
                    title: "URL",
                  },
                ],
              },
            ],
          },
        },
      ],
      description: "Contact info and links for the information page",
    }),
    defineField({
      name: "siteUrl",
      title: "Site URL",
      type: "url",
      fieldset: "seo",
      description: "Production URL (e.g. https://iriskim.co). Used for canonical links, sitemap, and social sharing.",
      initialValue: "https://iriskim.co",
    }),
    defineField({
      name: "metaTitle",
      title: "Meta Title",
      type: "string",
      fieldset: "seo",
      description: "SEO title override. Falls back to the Name field if empty.",
    }),
    defineField({
      name: "metaDescription",
      title: "Meta Description",
      type: "text",
      rows: 3,
      fieldset: "seo",
      description: "Meta description for search engines. Keep under ~155 characters.",
    }),
    defineField({
      name: "ogImage",
      title: "Social Sharing Image",
      type: "image",
      options: { hotspot: true },
      fieldset: "seo",
      description: "Image shown when the site is shared on social media. Recommended: 1200×630px.",
    }),
    defineField({
      name: "favicon",
      title: "Favicon",
      type: "image",
      fieldset: "seo",
      options: { accept: "image/svg+xml,image/png,image/x-icon" },
      description: "Site favicon (SVG, PNG, or ICO).",
    }),
  ],
  fieldsets: [
    {
      name: "seo",
      title: "SEO & Metadata",
      options: { collapsible: true, collapsed: true },
    },
  ],
});
