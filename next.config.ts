import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Security headers replacing helmet middleware
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob:",
              "connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // Vercel-friendly output
  output: "standalone",

  // sharp ships a native (.so) binary — keep it a true runtime `require` instead of letting
  // Turbopack/webpack trace and bundle it, which has been dropping libvips-cpp.so.* from the
  // standalone output on fresh rebuilds (ERR_DLOPEN_FAILED at cold start, prod incident
  // 2026-08-22). outputFileTracingIncludes force-includes the actual linux-x64 binary files
  // for every route that imports sharp (lib/file-parser.ts, lib/data-center.ts) so they land
  // in the deployed function regardless of how tracing resolves the external require.
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: {
    "/api/v1/chat/completions/route": [
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
    "/api/v1/data-center/**/route": [
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
  },

  // TypeScript — fail build on errors
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
