import 'server-only'
import { format } from 'date-fns'
import { db } from './db'
import { decrypt } from './crypto'
import {
  fetchAdAccountCampaigns,
  fetchCampaignInsights,
  mapObjectiveToCampaignType,
  parseActionValue,
} from './meta'

export type LiveMetaBucket = {
  type: 'AWARENESS' | 'TRAFFIC' | 'SALES'
  spend: number
  impressions: number
  reach: number
  clicks: number
  purchases: number
  purchaseValue: number
  addToCart: number
  cpm: number
  cpc: number
  ctr: number
  roas: number
  cpa: number
}

export type LiveMetaCampaign = {
  id: string
  name: string
  type: LiveMetaBucket['type']
  status: string
  spend: number
  impressions: number
  clicks: number
}

export type LiveMetaSummary = {
  connected: boolean
  byType: LiveMetaBucket[]
  campaigns: LiveMetaCampaign[]
  dailySpend: Array<{ date: string; spend: number }>
  totalSpend: number
  totalRevenue: number
  totalRoas: number
}

function initBucket(type: LiveMetaBucket['type']): LiveMetaBucket {
  return {
    type,
    spend: 0,
    impressions: 0,
    reach: 0,
    clicks: 0,
    purchases: 0,
    purchaseValue: 0,
    addToCart: 0,
    cpm: 0,
    cpc: 0,
    ctr: 0,
    roas: 0,
    cpa: 0,
  }
}

export function emptyMetaSummary(connected = false): LiveMetaSummary {
  return {
    connected,
    byType: [initBucket('AWARENESS'), initBucket('TRAFFIC'), initBucket('SALES')],
    campaigns: [],
    dailySpend: [],
    totalSpend: 0,
    totalRevenue: 0,
    totalRoas: 0,
  }
}

function finalizeBucket(bucket: LiveMetaBucket) {
  bucket.cpm = bucket.impressions > 0 ? (bucket.spend / bucket.impressions) * 1000 : 0
  bucket.cpc = bucket.clicks > 0 ? bucket.spend / bucket.clicks : 0
  bucket.ctr = bucket.impressions > 0 ? (bucket.clicks / bucket.impressions) * 100 : 0
  bucket.roas = bucket.spend > 0 ? bucket.purchaseValue / bucket.spend : 0
  bucket.cpa = bucket.purchases > 0 ? bucket.spend / bucket.purchases : 0
}

export async function getLiveMetaSummary(clientId: string, start: Date, end: Date): Promise<LiveMetaSummary> {
  const connection = await db.dataConnection.findFirst({
    where: { clientId, platform: 'META', isActive: true },
    orderBy: { updatedAt: 'desc' },
  })

  if (!connection) return emptyMetaSummary(false)

  const token = await decrypt(connection.accessToken)
  const summary = emptyMetaSummary(true)
  const byType = new Map(summary.byType.map((bucket) => [bucket.type, bucket]))
  const dailySpend = new Map<string, number>()
  const campaigns = await fetchAdAccountCampaigns(token, connection.accountId)

  for (const campaign of campaigns) {
    const type = mapObjectiveToCampaignType(campaign.objective)
    const bucket = byType.get(type)!
    const insights = await fetchCampaignInsights(token, campaign.id, type, format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'))
    const campaignTotals = { spend: 0, impressions: 0, clicks: 0 }

    for (const day of insights) {
      const spend = parseFloat(day.spend ?? '0')
      const impressions = parseInt(day.impressions ?? '0')
      const clicks = parseInt(day.clicks ?? '0')
      const purchases = parseActionValue(day.actions, 'purchase')
      const purchaseValue = parseActionValue(day.action_values, 'purchase')
      const addToCart = parseActionValue(day.actions, 'add_to_cart')

      bucket.spend += spend
      bucket.impressions += impressions
      bucket.reach += parseInt(day.reach ?? '0')
      bucket.clicks += clicks
      bucket.purchases += purchases
      bucket.purchaseValue += purchaseValue
      bucket.addToCart += addToCart

      campaignTotals.spend += spend
      campaignTotals.impressions += impressions
      campaignTotals.clicks += clicks
      dailySpend.set(day.date_start, (dailySpend.get(day.date_start) ?? 0) + spend)
    }

    summary.campaigns.push({
      id: campaign.id,
      name: campaign.name,
      type,
      status: campaign.status,
      ...campaignTotals,
    })
  }

  for (const bucket of summary.byType) finalizeBucket(bucket)

  summary.dailySpend = Array.from(dailySpend.entries())
    .map(([date, spend]) => ({ date, spend }))
    .sort((a, b) => a.date.localeCompare(b.date))
  summary.totalSpend = summary.byType.reduce((total, bucket) => total + bucket.spend, 0)
  summary.totalRevenue = byType.get('SALES')?.purchaseValue ?? 0
  summary.totalRoas = summary.totalSpend > 0 ? summary.totalRevenue / summary.totalSpend : 0

  return summary
}
