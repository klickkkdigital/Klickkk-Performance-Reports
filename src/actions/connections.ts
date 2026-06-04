'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { encrypt } from '@/lib/crypto'
import { requireAdmin, requireConnectionAccess } from '@/lib/auth'
import { getShopifyApiKey, normalizeShopDomain } from '@/lib/shopify-auth'
import { saveShopifyConnectionRecord } from '@/lib/shopify-connection'
import { clearOAuthSelection, getOAuthSelection } from '@/lib/oauth-selection'
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
  await requireConnectionAccess(clientId)
  const encryptedToken = await encrypt(accessToken)
  await db.dataConnection.upsert({
    where: { clientId_platform_accountId: { clientId, platform: 'META', accountId: adAccountId } },
    create: { clientId, platform: 'META', accountId: adAccountId, accountName: adAccountName, accessToken: encryptedToken, tokenExpiresAt: expiresAt, isActive: true },
    update: { accessToken: encryptedToken, accountName: adAccountName, tokenExpiresAt: expiresAt, isActive: true },
  })
  revalidatePath('/admin/connections')
  revalidatePath(`/admin/clients/${clientId}`)
}

export async function selectMetaConnection(formData: FormData) {
  const clientId = String(formData.get('clientId') || '')
  const accountId = String(formData.get('accountId') || '')
  const accountName = String(formData.get('accountName') || accountId)
  const selectionId = String(formData.get('selectionId') || '')
  const session = await requireConnectionAccess(clientId)

  const selection = selectionId ? await getOAuthSelection(selectionId, 'META') : null

  if (!clientId || !accountId || !selection || selection.platform !== 'META' || selection.clientId !== clientId) {
    redirect('/admin/connections?error=meta_selection_invalid')
  }

  await saveMetaConnection(clientId, accountId, accountName, selection.accessToken, new Date(Date.now() + selection.expiresIn * 1000))
  await clearOAuthSelection()
  redirect(session.role === 'SUPER_ADMIN' ? `/admin/clients/${clientId}?success=meta` : '/settings?success=meta')
}

// Google Analytics — token comes from OAuth callback
export async function saveGoogleConnection(
  clientId: string,
  propertyId: string,
  propertyName: string,
  accessToken: string,
  refreshToken: string,
) {
  await requireConnectionAccess(clientId)
  const [encAccess, encRefresh] = await Promise.all([encrypt(accessToken), encrypt(refreshToken)])
  await db.dataConnection.upsert({
    where: { clientId_platform_accountId: { clientId, platform: 'GOOGLE_ANALYTICS', accountId: propertyId } },
    create: { clientId, platform: 'GOOGLE_ANALYTICS', accountId: propertyId, accountName: propertyName, accessToken: encAccess, refreshToken: encRefresh, isActive: true, scopes: ['analytics.readonly'] },
    update: { accessToken: encAccess, refreshToken: encRefresh, accountName: propertyName, isActive: true },
  })
  revalidatePath('/admin/connections')
  revalidatePath(`/admin/clients/${clientId}`)
  revalidatePath('/analytics')
  revalidatePath('/settings')
}

export async function selectGoogleConnection(formData: FormData) {
  const clientId = String(formData.get('clientId') || '')
  const propertyId = String(formData.get('propertyId') || '')
  const propertyName = String(formData.get('propertyName') || propertyId)
  const selectionId = String(formData.get('selectionId') || '')
  const session = await requireConnectionAccess(clientId)

  const selection = selectionId ? await getOAuthSelection(selectionId, 'GOOGLE_ANALYTICS') : null

  if (!clientId || !propertyId || !selection || selection.platform !== 'GOOGLE_ANALYTICS' || selection.clientId !== clientId) {
    redirect('/admin/connections?error=google_selection_invalid')
  }

  await saveGoogleConnection(clientId, propertyId, propertyName, selection.accessToken, selection.refreshToken)
  await clearOAuthSelection()
  redirect(session.role === 'SUPER_ADMIN' ? `/admin/clients/${clientId}?success=google` : '/settings?success=google')
}

export async function removeConnection(connectionId: string) {
  await requireAdmin()
  const conn = await db.dataConnection.update({ where: { id: connectionId }, data: { isActive: false } })
  revalidatePath('/admin/connections')
  revalidatePath(`/admin/clients/${conn.clientId}`)
}
