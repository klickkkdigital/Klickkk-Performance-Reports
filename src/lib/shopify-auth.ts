import crypto from 'crypto'
import { requireEnv } from './env'

const STATE_MAX_AGE_MS = 10 * 60 * 1000
export const SHOPIFY_PENDING_CLIENT_COOKIE = 'klickkk_shopify_client'

type ShopifyState = {
  clientId?: string
  shop?: string
  ts: number
  returnUrl?: string
}

function base64Url(input: string) {
  return Buffer.from(input).toString('base64url')
}

function sign(value: string) {
  return crypto.createHmac('sha256', getShopifySecret()).update(value).digest('base64url')
}

function getShopifySecret() {
  return process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_CLIENT_SECRET || requireEnv('SHOPIFY_SECRET_KEY')
}

export function getShopifyApiKey() {
  return process.env.SHOPIFY_API_KEY || process.env.SHOPIFY_CLIENT_ID || requireEnv('SHOPIFY_API_KEY')
}

export function getShopifyApiSecret() {
  return getShopifySecret()
}

export function getShopifyScopes() {
  return process.env.SHOPIFY_SCOPES || 'read_orders,read_products'
}

export function getShopifyApiVersion() {
  return process.env.SHOPIFY_API_VERSION || '2026-04'
}

export function getShopifyInstallUrl() {
  return requireEnv('SHOPIFY_INSTALL_URL')
}

export function normalizeShopDomain(input: string) {
  const value = input.trim().toLowerCase()
  const withProtocol = value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`
  const hostname = new URL(withProtocol).hostname.replace(/^www\./, '')
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(hostname)) {
    throw new Error('Enter a valid myshopify.com store domain.')
  }
  return hostname
}

<<<<<<< Updated upstream
export function createShopifyState(clientId: string, shop: string, returnUrl?: string) {
  const data: ShopifyState = { clientId, shop, ts: Date.now() }
  if (returnUrl) data.returnUrl = returnUrl
  const payload = base64Url(JSON.stringify(data))
=======
export function createShopifyState(shop: string, clientId?: string) {
  const payload = base64Url(JSON.stringify({ clientId, shop, ts: Date.now() } satisfies ShopifyState))
>>>>>>> Stashed changes
  return `${payload}.${sign(payload)}`
}

export function createPendingShopifyClient(clientId: string, returnUrl?: string) {
  const data: ShopifyState = { clientId, ts: Date.now() }
  if (returnUrl) data.returnUrl = returnUrl
  const payload = base64Url(JSON.stringify(data))
  return `${payload}.${sign(payload)}`
}

export function verifyShopifyState(state: string) {
  const [payload, signature] = state.split('.')
  if (!payload || !signature || sign(payload) !== signature) throw new Error('Invalid Shopify state.')

  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as ShopifyState
  if (!parsed.ts) throw new Error('Invalid Shopify state.')
  if (Date.now() - parsed.ts > STATE_MAX_AGE_MS) throw new Error('Expired Shopify state.')
  return parsed
}

export function verifyShopifyHmac(searchParams: URLSearchParams) {
  const hmac = searchParams.get('hmac')
  if (!hmac) return false

  const message = Array.from(searchParams.entries())
    .filter(([key]) => key !== 'hmac' && key !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  const digest = crypto.createHmac('sha256', getShopifyApiSecret()).update(message).digest('hex')
  if (digest.length !== hmac.length) return false
  return crypto.timingSafeEqual(Buffer.from(digest, 'utf8'), Buffer.from(hmac, 'utf8'))
}

export function verifyShopifyWebhookHmac(body: string, hmac: string | null) {
  if (!hmac) return false
  const digest = crypto.createHmac('sha256', getShopifyApiSecret()).update(body, 'utf8').digest('base64')
  if (digest.length !== hmac.length) return false
  return crypto.timingSafeEqual(Buffer.from(digest, 'utf8'), Buffer.from(hmac, 'utf8'))
}
