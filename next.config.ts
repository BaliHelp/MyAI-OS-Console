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

  // TypeScript — fail build on errors
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
