import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The demo API reads redacted email fixtures at runtime; ship exactly those.
  outputFileTracingIncludes: {
    "/api/workout": ["./fixtures/trainingpeaks-*.html"],
  },
};

export default nextConfig;
