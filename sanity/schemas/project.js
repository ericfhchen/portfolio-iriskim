import { defineField, defineType } from "sanity";
import { orderRankField, orderRankOrdering } from "@sanity/orderable-document-list";

export default defineType({
  name: "project",
  title: "Project",
  type: "document",
  orderings: [orderRankOrdering],
  fields: [
    orderRankField({ type: "project" }),
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "projectCode",
      title: "Project Code",
      type: "string",
      description: "Project code displayed beneath media items (e.g., 'AB' → AB_01, AB_02)",
    }),
    defineField({
      name: "role",
      title: "Role",
      type: "string",
      description: "Role in the project (e.g., 'Director', 'Photographer') to be displayed under the project tile in the grid.",
    }),
    defineField({
      name: "year",
      title: "Year",
      type: "number",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "tileSize",
      title: "Tile Size",
      type: "string",
      options: {
        list: [
          { title: "Large", value: "large" },
          { title: "Medium", value: "medium" },
          { title: "Small", value: "small" },
        ],
        layout: "radio",
      },
      initialValue: "medium",
    }),
    defineField({
      name: "coverImage",
      title: "Cover Image",
      type: "image",
      options: { hotspot: true },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "media",
      title: "Media",
      type: "array",
      of: [
        { type: "image", options: { hotspot: true } },
        { type: "mux.video" },
      ],
    }),
    defineField({
      name: "caption",
      title: "Caption",
      type: "array",
      of: [{ type: "block" }],
      description: "Credits and additional information (Director, Production, Agency, etc.)",
    }),
  ],
  preview: {
    select: { title: "title", year: "year", media: "coverImage" },
    prepare({ title, year, media }) {
      return {
        title: `${title} (${year || "?"})`,
        media,
      };
    },
  },
});
