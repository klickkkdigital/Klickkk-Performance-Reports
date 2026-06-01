// Must match the fallback in proxy.ts so cookie domains are consistent.
const FALLBACK_DASHBOARD_URL = 'https://reporting.klickkk.com'

export function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export function getBaseUrl(requestUrl?: string) {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  if (requestUrl) return new URL(requestUrl).origin
  return 'http://localhost:3000'
}

export function getDashboardUrl(requestUrl?: string) {
  if (process.env.NEXT_PUBLIC_DASHBOARD_URL) return process.env.NEXT_PUBLIC_DASHBOARD_URL.replace(/\/$/, '')
  // When NEXT_PUBLIC_APP_URL is set we are in a multi-domain deployment where the app
  // host (*.app) and dashboard host (*.com) are different. Without an explicit
  // NEXT_PUBLIC_DASHBOARD_URL we fall back to the same hardcoded value that proxy.ts
  // uses so that session cookies are always set on the dashboard domain.
  if (process.env.NEXT_PUBLIC_APP_URL) return FALLBACK_DASHBOARD_URL
  if (requestUrl) return new URL(requestUrl).origin
  return 'http://localhost:3000'
}

export function getDashboardRedirect(path: string, requestUrl?: string) {
  return new URL(path, getDashboardUrl(requestUrl))
}
