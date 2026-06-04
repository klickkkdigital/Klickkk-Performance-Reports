import 'server-only'
import { db } from './db'
import { decrypt, encrypt } from './crypto'
import { fetchShopifyOrdersForRange, fetchTopProducts } from './shopify'
import { getShopifyApiKey, getShopifyApiSecret } from './shopify-auth'
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns'
import { Platform } from '@prisma/client'

export async function syncClientData(clientId: string, month: string) {
  const connections = await db.dataConnection.findMany({
    where: { clientId, isActive: true },
  })

  const [year, mon] = month.split('-').map(Number)
  const monthStart = startOfMonth(new Date(year, mon - 1))
  const monthEnd = endOfMonth(monthStart)
  const dateStart = format(monthStart, 'yyyy-MM-dd')
  const dateEnd = format(monthEnd, 'yyyy-MM-dd')

  await Promise.allSettled(
    connections.map((conn) => syncConnection(conn, dateStart, dateEnd)),
  )
}

async function syncConnection(
  conn: {
    id: string
    clientId: string
    platform: Platform
    accountId: string
    accessToken: string
    refreshToken: string | null
    tokenExpiresAt: Date | null
    scopes: string[]
  },
  dateStart: string,
  dateEnd: string,
) {
  await db.dataConnection.update({ where: { id: conn.id }, data: { lastSyncStatus: 'SYNCING' } })

  try {
    const token = await decrypt(conn.accessToken)

    if (conn.platform === 'META' || conn.platform === 'GOOGLE_ANALYTICS') {
      await db.dataConnection.update({
        where: { id: conn.id },
        data: { lastSyncStatus: 'SUCCESS', lastSyncedAt: new Date(), lastSyncError: null },
      })
      return
    }

    if (conn.platform === 'SHOPIFY') {
      const shopifyToken = await ensureShopifyToken(conn, token)
      await syncShopify(conn.clientId, conn.accountId, shopifyToken, dateStart, dateEnd)
    }

    await db.dataConnection.update({
      where: { id: conn.id },
      data: { lastSyncStatus: 'SUCCESS', lastSyncedAt: new Date(), lastSyncError: null },
    })
  } catch (err) {
    await db.dataConnection.update({
      where: { id: conn.id },
      data: { lastSyncStatus: 'FAILED', lastSyncError: String(err) },
    })
    throw err
  }
}

type ShopifyTokenResponse = {
  access_token: string
  scope?: string
  expires_in?: number
  refresh_token?: string
  refresh_token_expires_in?: number
}

function tokenExpiresAt(expiresIn?: number) {
  return expiresIn ? new Date(Date.now() + expiresIn * 1000) : null
}

function shouldRefresh(expiresAt: Date | null) {
  if (!expiresAt) return false
  return expiresAt.getTime() <= Date.now() + 5 * 60 * 1000
}

async function postShopifyTokenRequest(shop: string, body: Record<string, string | number>) {
  const form = new URLSearchParams()
  for (const [key, value] of Object.entries(body)) form.set(key, String(value))

  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: form,
  })

  if (!res.ok) {
    throw new Error(`Shopify token refresh failed (${res.status}): ${(await res.text()).slice(0, 300)}`)
  }

  return res.json() as Promise<ShopifyTokenResponse>
}

async function persistShopifyToken(
  connectionId: string,
  token: ShopifyTokenResponse,
  fallbackScopes: string[],
) {
  const scopes = token.scope?.split(',').map((scope) => scope.trim()).filter(Boolean) || fallbackScopes
  const encryptedRefreshToken = token.refresh_token ? await encrypt(token.refresh_token) : undefined

  await db.dataConnection.update({
    where: { id: connectionId },
    data: {
      accessToken: await encrypt(token.access_token),
      ...(encryptedRefreshToken ? { refreshToken: encryptedRefreshToken } : {}),
      scopes,
      tokenExpiresAt: tokenExpiresAt(token.expires_in),
      lastSyncError: null,
    },
  })

  return token.access_token
}

async function ensureShopifyToken(
  conn: {
    id: string
    accountId: string
    accessToken: string
    refreshToken: string | null
    tokenExpiresAt: Date | null
    scopes: string[]
  },
  decryptedAccessToken: string,
) {
  if (conn.refreshToken && shouldRefresh(conn.tokenExpiresAt)) {
    const token = await postShopifyTokenRequest(conn.accountId, {
      client_id: getShopifyApiKey(),
      client_secret: getShopifyApiSecret(),
      grant_type: 'refresh_token',
      refresh_token: await decrypt(conn.refreshToken),
    })
    return persistShopifyToken(conn.id, token, conn.scopes)
  }

  if (!conn.refreshToken || !conn.tokenExpiresAt) {
    const token = await postShopifyTokenRequest(conn.accountId, {
      client_id: getShopifyApiKey(),
      client_secret: getShopifyApiSecret(),
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      subject_token: decryptedAccessToken,
      subject_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
      requested_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
      expiring: 1,
    })
    return persistShopifyToken(conn.id, token, conn.scopes)
  }

  return decryptedAccessToken
}

async function syncShopify(clientId: string, storeDomain: string, token: string, dateStart: string, dateEnd: string) {
  const orders = await fetchShopifyOrdersForRange(storeDomain, token, dateStart, dateEnd)

  // Group by day
  const byDay = new Map<string, { revenue: number; orders: number; new: number; returning: number; refunds: number }>()
  for (const order of orders) {
    const day = format(parseISO(order.created_at), 'yyyy-MM-dd')
    const current = byDay.get(day) ?? { revenue: 0, orders: 0, new: 0, returning: 0, refunds: 0 }
    current.revenue += parseFloat(order.total_price)
    current.orders += 1
    if (order.customer?.orders_count === 1) current.new += 1
    else current.returning += 1
    if (order.refunds?.length) current.refunds += parseFloat(order.total_price)
    byDay.set(day, current)
  }

  for (const [day, data] of byDay.entries()) {
    const date = parseISO(day)
    const aov = data.orders > 0 ? data.revenue / data.orders : 0
    await db.shopifyMetric.upsert({
      where: { clientId_date: { clientId, date } },
      create: { clientId, date, totalRevenue: data.revenue, totalOrders: data.orders, avgOrderValue: aov, newCustomers: data.new, returningCustomers: data.returning, refunds: data.refunds },
      update: { totalRevenue: data.revenue, totalOrders: data.orders, avgOrderValue: aov, newCustomers: data.new, returningCustomers: data.returning, refunds: data.refunds },
    })
  }

  // Top products
  const products = await fetchTopProducts(storeDomain, token, dateStart, dateEnd)
  const month = dateStart.slice(0, 7)
  for (const p of products) {
    await db.topProduct.upsert({
      where: { clientId_month_productId: { clientId, month, productId: p.productId } },
      create: { clientId, month, ...p },
      update: { revenue: p.revenue, unitsSold: p.unitsSold, rank: p.rank },
    })
  }
}
