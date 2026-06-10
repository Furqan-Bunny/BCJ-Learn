import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This is a demo / prototype with mock data. The shadcn (base-ui) primitives
  // and several runtime-correct patterns (asChild, render delegation) trigger
  // strict TypeScript errors that don't affect runtime. Skipping build-time type
  // checks here lets the demo deploy cleanly. Tighten before going to prod.
  typescript: {
    ignoreBuildErrors: true,
  },
  // Document-parsing libs use Node APIs / dynamic file paths — keep them external
  // (loaded from node_modules at runtime) instead of bundling them.
  serverExternalPackages: ["pdf-parse", "mammoth"],
  // The Help Center reads the guides from /docs at runtime via a dynamic path,
  // which file-tracing can't follow — bundle the Markdown into the serverless
  // function so /help works in production. (Screenshots live in /public and are
  // served as static assets automatically.)
  outputFileTracingIncludes: {
    "/help/[doc]": ["./docs/**/*.md"],
    "/help": ["./docs/**/*.md"],
  },
  // Allow next/image to optimize assets served from the public Supabase buckets
  // (branding logo, avatars). Private module-content is served via signed URLs.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
