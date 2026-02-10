import { defineField, defineType } from "sanity";

export default defineType({
  name: "siteSettings",
  title: "Site Settings",
  type: "document",
  fields: [
    defineField({
      name: "artistName",
      title: "Artist Name",
      type: "string",
    }),
    defineField({
      name: "siteTitle",
      title: "Site Title",
      type: "string",
    }),
  ],
});
