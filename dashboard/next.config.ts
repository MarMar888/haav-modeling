import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Multiple lockfiles exist above this directory; pin the workspace root so
  // Turbopack does not infer the wrong one.
  turbopack: { root: path.resolve(".") },
  // The sponsor form now lives at the bottom of the home page.
  redirects: async () => [
    { source: "/sponsors", destination: "/#contact", permanent: false },
    // The simulation page was removed.
    { source: "/simulation", destination: "/", permanent: false },
  ],
};

export default nextConfig;
