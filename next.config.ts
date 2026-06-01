import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    const appHost = 'reporting.klickkk.app'
    const dashboardUrl = 'https://reporting.klickkk.com'
    const appHostCondition = [{ type: 'host' as const, value: appHost }]
    const noShopQuery = [{ type: 'query' as const, key: 'shop' }]

    return [
      {
        source: '/',
        has: appHostCondition,
        missing: noShopQuery,
        destination: dashboardUrl,
        permanent: false,
      },
      {
        source: '/:path((?!api(?:/|$)|_next(?:/|$)|favicon.ico$|robots.txt$|sitemap.xml$).*)',
        has: appHostCondition,
        missing: noShopQuery,
        destination: `${dashboardUrl}/:path`,
        permanent: false,
      },
    ]
  },
};

export default nextConfig;
