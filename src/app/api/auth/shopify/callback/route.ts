import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { getBaseUrl } from '@/lib/env'
import { createLoginTransferToken } from '@/lib/session'
import { saveShopifyConnectionRecord } from '@/lib/shopify-connection'
import {
  getShopifyApiKey,
  getShopifyApiSecret,
  getShopifyApiVersion,
  normalizeShopDomain,
  verifyShopifyHmac,
  verifyShopifyState,
  SHOPIFY_PENDING_CLIENT_COOKIE,
} from '@/lib/shopify-auth'

type TokenResponse = {
  access_token: string
  scope?: string
}

type ShopResponse = {
  shop?: {
    domain?: string
    email?: string
    customer_email?: string
    name?: string
    myshopify_domain?: string
    shop_owner?: string
  }
}

type InstalledShop = {
  domain?: string
  email?: string
  customerEmail?: string
  name: string
  myshopifyDomain: string
  owner?: string
}

async function registerUninstallWebhook(shop: string, accessToken: string, requestUrl: string) {
  const address = `${getBaseUrl(requestUrl)}/api/webhooks/shopify/app-uninstalled`
  const res = await fetch(`https://${shop}/admin/api/${getShopifyApiVersion()}/webhooks.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({
      webhook: {
        topic: 'app/uninstalled',
        address,
        format: 'json',
      },
    }),
  })

  if (!res.ok && res.status !== 422) {
    console.warn(`Shopify uninstall webhook registration failed for ${shop}: ${res.status}`)
  }
}

async function fetchShopDetails(shop: string, accessToken: string): Promise<InstalledShop> {
  const res = await fetch(`https://${shop}/admin/api/${getShopifyApiVersion()}/shop.json`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
  })

  if (!res.ok) {
    return { name: shop.replace('.myshopify.com', ''), myshopifyDomain: shop }
  }

  const data = (await res.json()) as ShopResponse
  return {
    domain: data.shop?.domain,
    email: data.shop?.email,
    customerEmail: data.shop?.customer_email,
    name: data.shop?.name || data.shop?.myshopify_domain || shop,
    myshopifyDomain: data.shop?.myshopify_domain || shop,
    owner: data.shop?.shop_owner,
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/\.myshopify\.com$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'shopify-store'
}

async function getAvailableSlug(base: string) {
  let slug = base
  let suffix = 1

  while (await db.client.findUnique({ where: { slug }, select: { id: true } })) {
    suffix += 1
    slug = `${base.slice(0, 42)}-${suffix}`
  }

  return slug
}

async function getOrCreateClientForShop(shop: string, details: InstalledShop) {
  const existingConnection = await db.dataConnection.findFirst({
    where: { platform: 'SHOPIFY', accountId: shop },
    include: { client: true },
  })

  if (existingConnection?.client) return existingConnection.client

  const websiteUrl = details.domain ? `https://${details.domain}` : `https://${shop}`
  const existingClient = await db.client.findFirst({
    where: { OR: [{ websiteUrl }, { slug: slugify(shop) }] },
  })

  if (existingClient) return existingClient

  return db.client.create({
    data: {
      name: details.name,
      slug: await getAvailableSlug(slugify(details.myshopifyDomain)),
      websiteUrl,
      industry: 'E-commerce',
      primaryColor: '#16a34a',
      isActive: true,
    },
  })
}

async function getOrCreateClientUser(clientId: string, shop: string, details: InstalledShop) {
  const existingClientUser = await db.user.findFirst({
    where: { clientId, role: 'CLIENT_VIEWER', isActive: true },
    orderBy: { createdAt: 'asc' },
  })

  if (existingClientUser) return existingClientUser

  const email = details.email || details.customerEmail || `shopify-${shop.replace(/[^a-z0-9]/gi, '-')}@klickkk.local`
  const existingEmailUser = await db.user.findUnique({ where: { email } })
  if (existingEmailUser) return existingEmailUser.clientId === clientId ? existingEmailUser : db.user.create({
    data: {
      clientId,
      email: `shopify-${randomUUID()}@klickkk.local`,
      name: details.owner || details.name,
      passwordHash: await bcrypt.hash(randomUUID(), 12),
      role: 'CLIENT_VIEWER',
    },
  })

  return db.user.create({
    data: {
      clientId,
      email,
      name: details.owner || details.name,
      passwordHash: await bcrypt.hash(randomUUID(), 12),
      role: 'CLIENT_VIEWER',
    },
  })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const shopParam = searchParams.get('shop')
  const stateParam = searchParams.get('state')

  if (!code || !shopParam || !verifyShopifyHmac(searchParams)) {
    return NextResponse.redirect(new URL('/admin/connections?error=shopify_denied', req.url))
  }

  try {
    const shop = normalizeShopDomain(shopParam)
    const cookieStore = await cookies()
    const pendingClient = cookieStore.get(SHOPIFY_PENDING_CLIENT_COOKIE)?.value
    const rawState = stateParam || pendingClient
    const state = rawState ? verifyShopifyState(rawState) : null
    if (state?.shop && state.shop !== shop) throw new Error('Shopify state shop mismatch.')

    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: getShopifyApiKey(),
        client_secret: getShopifyApiSecret(),
        code,
      }),
    })

    if (!tokenRes.ok) throw new Error(`Shopify token exchange failed: ${tokenRes.status}`)
    const token = (await tokenRes.json()) as TokenResponse
    const scopes = token.scope?.split(',').map((scope) => scope.trim()).filter(Boolean) ?? []
    const shopDetails = await fetchShopDetails(shop, token.access_token)

    const client = state?.clientId
      ? await db.client.findUniqueOrThrow({ where: { id: state.clientId } })
      : await getOrCreateClientForShop(shop, shopDetails)
    const user = await getOrCreateClientUser(client.id, shop, shopDetails)

    await registerUninstallWebhook(shop, token.access_token, req.url)
    await saveShopifyConnectionRecord(client.id, shop, token.access_token, scopes, shopDetails.name)
    cookieStore.delete(SHOPIFY_PENDING_CLIENT_COOKIE)

    const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || getBaseUrl(req.url)
    const transferToken = await createLoginTransferToken({
      userId: user.id,
      role: 'CLIENT_VIEWER',
      clientId: client.id,
      clientSlug: client.slug,
    })
    const redirectUrl = new URL('/api/auth/session/consume', dashboardUrl)
    redirectUrl.searchParams.set('token', transferToken)
    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error('Shopify OAuth callback error:', error)
    return NextResponse.redirect(new URL('/admin/connections?error=shopify_failed', req.url))
  }
}
