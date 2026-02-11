/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
      },
      {
        protocol: "https",
        hostname: "image.mux.com",
      },
    ],
  },
  async redirects() {
    return [
      {
        // Redirect /:slug to /?project=:slug
        // Requires at least one character, excludes reserved paths
        source: "/:slug((?!studio|api|_next|favicon|robots|sitemap)[a-zA-Z0-9_-]+)",
        destination: "/?project=:slug",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
