import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const fallbackBackend = process.env.VERCEL
  ? "https://aseel-backend.vercel.app"
  : "http://localhost:3100";
const backendOrigin = process.env.NEXT_PUBLIC_API_PROXY_TARGET
  || process.env.BACKEND_URL
  || fallbackBackend;
const normalizedBackend = backendOrigin.replace(/\/$/, "");
const apiDestination = normalizedBackend.endsWith("/api")
  ? `${normalizedBackend}/:path*`
  : `${normalizedBackend}/api/:path*`;

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: apiDestination },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "no-21n",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  }
});
