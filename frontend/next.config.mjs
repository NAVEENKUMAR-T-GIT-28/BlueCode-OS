/** The browser always calls same-origin /api/v1/*. Caddy routes it in production;
 *  in development (and inside the web container) Next proxies it to the API. */
const apiOrigin = process.env.API_ORIGIN || "http://localhost:8000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
};
export default nextConfig;
