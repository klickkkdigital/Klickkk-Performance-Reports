import { db } from './db'
import { encrypt } from './crypto'

export async function saveShopifyConnectionRecord(
  clientId: string,
  shop: string,
  accessToken: string,
  scopes: string[],
  shopName?: string,
) {
  const encryptedToken = await encrypt(accessToken)
  await db.dataConnection.upsert({
    where: { clientId_platform_accountId: { clientId, platform: 'SHOPIFY', accountId: shop } },
    create: {
      clientId,
      platform: 'SHOPIFY',
      accountId: shop,
      accountName: shopName || shop,
      accessToken: encryptedToken,
      scopes,
      isActive: true,
    },
    update: {
      accountName: shopName || shop,
      accessToken: encryptedToken,
      refreshToken: null,
      scopes,
      isActive: true,
    },
  })
}
