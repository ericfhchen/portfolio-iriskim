import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { orderableDocumentListDeskItem } from "@sanity/orderable-document-list";
import { muxInput } from "sanity-plugin-mux-input";
import { schemaTypes } from "./sanity/schemas";
import { studioTheme } from "./sanity/studioTheme";
import "./sanity/studioStyles.css";

// Singleton document types
const singletonTypes = new Set(["siteSettings"]);

// Singleton document actions (disable create/duplicate/delete)
const singletonActions = new Set(["publish", "discardChanges", "restore"]);

export default defineConfig({
  name: "iris-portfolio",
  title: "Iris Portfolio",
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  basePath: "/studio",

  // Apply custom theme
  theme: studioTheme,

  // Hide the navbar logo
  studio: {
    components: {
      logo: () => null,
    },
  },

  plugins: [
    structureTool({
      structure: (S, context) => {
        return S.list()
          .title("Content")
          .items([
            // Projects with drag ordering
            orderableDocumentListDeskItem({
              type: "project",
              title: "Projects",
              S,
              context,
            }),

            S.divider(),

            // Site Settings as singleton
            S.listItem()
              .title("Site Settings")
              .id("siteSettings")
              .child(
                S.document()
                  .schemaType("siteSettings")
                  .documentId("siteSettings")
                  .title("Site Settings")
              ),

            // Filter out: siteSettings (shown as singleton), project (shown with ordering), and mux.videoAsset
          ]);
      },
    }),
    muxInput({
      mp4_support: "capped-1080p",
      max_resolution_tier: "2160p",
    }),
  ],

  schema: {
    types: schemaTypes,
    // Prevent new singletons from being created
    templates: (templates) =>
      templates.filter(({ schemaType }) => !singletonTypes.has(schemaType)),
  },

  document: {
    // Disable actions for singletons
    actions: (input, context) =>
      singletonTypes.has(context.schemaType)
        ? input.filter(({ action }) => action && singletonActions.has(action))
        : input,
  },
});
