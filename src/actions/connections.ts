'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { encrypt } from '@/lib/crypto'
import { requireAdmin } from '@/lib/auth'
import { getShopifyApiKey, normalizeShopDomain } from '@/lib/shopify-auth'
import { saveShopifyConnectionRecord } from '@/lib/shopify-connection'
import { redirect } from 'next/navigation'

// Shopify — OAuth install for admin-managed connections
const shopifySchema = z.object({
  clientId: z.string(),
  shop: z.string().min(1, 'Store domain is required'),
})

export async function startShopifyInstall(_prev: unknown, formData: FormData) {
  await requireAdmin()

  const parsed = shopifySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  let shop: string
  try {
    shop = normalizeShopDomain(parsed.data.shop)
    getShopifyApiKey()
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to start Shopify install.' }
  }

  const params = new URLSearchParams({ clientId: parsed.data.clientId, shop })
  redirect(`/api/auth/shopify/start?${params.toString()}`)
}

export async function saveShopifyConnection(
  clientId: string,
  shop: string,
  accessToken: string,
  scopes: string[],
  shopName?: string,
) {
  await requireAdmin()
  await saveShopifyConnectionRecord(clientId, shop, accessToken, scopes, shopName)
  revalidatePath(`/admin/connections`)
  revalidatePath(`/admin/clients/${clientId}`)
}

// Meta — token comes from OAuth callback, stored here after exchange
export async function saveMetaConnection(
  clientId: string,
  adAccountId: string,
  adAccountName: string,
  accessToken: string,
  expiresAt: Date,
) {
  await requireAdmin()
  const encryptedToken = await encrypt(accessToken)
  await db.dataConnection.upsert({
    where: { clientId_platform_accountId: { clientId, platform: 'META', accountId: adAccountId } },
    create: { clientId, platform: 'META', accountId: adAccountId, accountName: adAccountName, accessToken: encryptedToken, tokenExpiresAt: expiresAt, isActive: true },
    update: { accessToken: encryptedToken, accountName: adAccountName, tokenExpiresAt: expiresAt, isActive: true },
  })
  revalidatePath('/admin/connections')
  revalidatePath(`/admin/clients/${clientId}`)
}

// Google Analytics — token comes from OAuth callback
export async function saveGoogleConnection(
  clientId: string,
  propertyId: string,
  propertyName: string,
  accessToken: string,
  refreshToken: string,
) {
  await requireAdmin()
  const [encAccess, encRefresh] = await Promise.all([encrypt(accessToken), encrypt(refreshToken)])
  await db.dataConnection.upsert({
    where: { clientId_platform_accountId: { clientId, platform: 'GOOGLE_ANALYTICS', accountId: propertyId } },
    create: { clientId, platform: 'GOOGLE_ANALYTICS', accountId: propertyId, accountName: propertyName, accessToken: encAccess, refreshToken: encRefresh, isActive: true, scopes: ['analytics.readonly'] },
    update: { accessToken: encAccess, refreshToken: encRefresh, accountName: propertyName, isActive: true },
  })
  revalidatePath('/admin/connections')
  revalidatePath(`/admin/clients/${clientId}`)
}

export async function removeConnection(connectionId: string) {
  await requireAdmin()
  const conn = await db.dataConnection.update({ where: { id: connectionId }, data: { isActive: false } })
  revalidatePath('/admin/connections')
  revalidatePath(`/admin/clients/${conn.clientId}`)
}
