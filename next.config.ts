import type { NextConfig } from "next";

// Static export for GitHub Pages (served from /eval-tagger/).
const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.NODE_ENV === "production" ? "/eval-tagger" : "",
};

export default nextConfig;
