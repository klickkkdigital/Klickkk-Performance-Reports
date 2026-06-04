import { CampaignType } from '@prisma/client'

const GRAPH_API = 'https://graph.facebook.com/v20.0'

function getMetaAppId() {
  return process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID || ''
}

// Map Meta objective strings → our CampaignType
const OBJECTIVE_MAP: Record<string, CampaignType> = {
  BRAND_AWARENESS: 'AWARENESS',
  REACH: 'AWARENESS',
  LINK_CLICKS: 'TRAFFIC',
  PAGE_LIKES: 'TRAFFIC',
  POST_ENGAGEMENT: 'TRAFFIC',
  VIDEO_VIEWS: 'TRAFFIC',
  CONVERSIONS: 'SALES',
  PRODUCT_CATALOG_SALES: 'SALES',
  STORE_VISITS: 'SALES',
  LEAD_GENERATION: 'SALES',
}

export function mapObjectiveToCampaignType(objective: string): CampaignType {
  return OBJECTIVE_MAP[objective] ?? 'TRAFFIC'
}

// Awareness insight fields
const AWARENESS_FIELDS = 'spend,impressions,reach,frequency,cpm'
// Traffic insight fields
const TRAFFIC_FIELDS = 'spend,impressions,clicks,ctr,cpc,landing_page_views'
// Sales insight fields
const SALES_FIELDS = 'spend,impressions,clicks,ctr,cpc,actions,action_values,cost_per_action_type,purchase_roas'

export async function fetchAdAccountCampaigns(accessToken: string, adAccountId: string) {
  const accountPath = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
  const url = new URL(`${GRAPH_API}/${accountPath}/campaigns`)
  url.searchParams.set('fields', 'id,name,status,objective')
  url.searchParams.set('access_token', accessToken)
  url.searchParams.set('limit', '100')

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Meta campaigns fetch failed: ${res.status}`)
  const data = await res.json()
  return data.data as Array<{ id: string; name: string; status: string; objective: string }>
}

export async function fetchCampaignInsights(
  accessToken: string,
  campaignId: string,
  type: CampaignType,
  dateStart: string,
  dateEnd: string,
) {
  const fields =
    type === 'AWARENESS' ? AWARENESS_FIELDS : type === 'TRAFFIC' ? TRAFFIC_FIELDS : SALES_FIELDS

  const url = new URL(`${GRAPH_API}/${campaignId}/insights`)
  url.searchParams.set('fields', fields)
  url.searchParams.set('time_range', JSON.stringify({ since: dateStart, until: dateEnd }))
  url.searchParams.set('time_increment', '1')
  url.searchParams.set('access_token', accessToken)

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Meta insights fetch failed: ${res.status}`)
  const data = await res.json()
  return data.data as MetaInsightDay[]
}

export type MetaInsightDay = {
  date_start: string
  spend: string
  impressions?: string
  reach?: string
  frequency?: string
  cpm?: string
  clicks?: string
  ctr?: string
  cpc?: string
  landing_page_views?: string
  actions?: Array<{ action_type: string; value: string }>
  action_values?: Array<{ action_type: string; value: string }>
  purchase_roas?: Array<{ action_type: string; value: string }>
  cost_per_action_type?: Array<{ action_type: string; value: string }>
}

export function parseActionValue(
  actions: MetaInsightDay['actions'],
  type: string,
): number {
  return parseFloat(actions?.find((a) => a.action_type === type)?.value ?? '0')
}

export async function exchangeCodeForToken(code: string, redirectUri: string) {
  const url = new URL(`${GRAPH_API}/oauth/access_token`)
  url.searchParams.set('client_id', getMetaAppId())
  url.searchParams.set('client_secret', process.env.META_APP_SECRET!)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('code', code)

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('Meta token exchange failed')
  return res.json() as Promise<{ access_token: string; token_type: string; expires_in: number }>
}

export async function getLongLivedToken(shortToken: string) {
  const url = new URL(`${GRAPH_API}/oauth/access_token`)
  url.searchParams.set('grant_type', 'fb_exchange_token')
  url.searchParams.set('client_id', getMetaAppId())
  url.searchParams.set('client_secret', process.env.META_APP_SECRET!)
  url.searchParams.set('fb_exchange_token', shortToken)

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('Meta long-lived token exchange failed')
  return res.json() as Promise<{ access_token: string; expires_in: number }>
}

export async function fetchAdAccounts(accessToken: string) {
  const url = new URL(`${GRAPH_API}/me/adaccounts`)
  url.searchParams.set('fields', 'id,name,currency,account_status')
  url.searchParams.set('access_token', accessToken)

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('Meta ad accounts fetch failed')
  const data = await res.json()
  return data.data as Array<{ id: string; name: string; currency: string; account_status: number }>
}
