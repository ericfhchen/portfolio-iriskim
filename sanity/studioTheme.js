import { buildLegacyTheme } from "sanity";

// Brand colors
const brand = "#464861";
const brandLight = "#61677A";
const brandDark = "#1E222E";

const props = {
  // Background
  "--my-white": "#ffffff",
  "--my-black": "#000000",
  "--my-gray-100": "#000000",
  "--my-gray-200": "#000000",
  "--my-gray-300": "#000000",
  "--my-gray-500": "#000000",
  "--my-gray-700": "#000000",
  "--my-brand": brand,
  "--my-brand-light": brandLight,
  "--my-brand-dark": brandDark,

  // Focus ring
  "--my-focus-ring": brand,
};

export const studioTheme = buildLegacyTheme({
  /* Base theme colors */
  "--black": props["--my-black"],
  "--white": props["--my-white"],

  /* Brand */
  "--brand-primary": props["--my-brand"],

  /* Component colors */
  "--component-bg": props["--my-black"],
  "--component-text-color": props["--my-white"],

  /* Default button */
  "--default-button-color": props["--my-gray-700"],
  "--default-button-primary-color": props["--my-brand"],
  "--default-button-success-color": props["--my-brand"],
  "--default-button-warning-color": "#f5a623",
  "--default-button-danger-color": "#d0021b",

  /* State */
  "--state-info-color": props["--my-brand"],
  "--state-success-color": props["--my-brand"],
  "--state-warning-color": "#f5a623",
  "--state-danger-color": "#d0021b",

  /* Navbar */
  "--main-navigation-color": props["--my-black"],
  "--main-navigation-color--inverted": props["--my-white"],

  /* Focus */
  "--focus-color": props["--my-brand"],
});
