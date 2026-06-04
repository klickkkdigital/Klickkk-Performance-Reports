import 'server-only'
import { db } from './db'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import { getLiveGA4Summary } from './live-google-analytics'
import { getLiveMetaSummary } from './live-meta'

export async function generateReportSummary(clientId: string, month: string) {
  const [year, mon] = month.split('-').map(Number)
  const monthStart = startOfMonth(new Date(year, mon - 1))
  const monthEnd = endOfMonth(monthStart)

  const [metaData, shopifyData, analyticsData] = await Promise.all([
    getMetaSummary(clientId, monthStart, monthEnd),
    getShopifySummary(clientId, monthStart, monthEnd),
    getAnalyticsSummary(clientId, monthStart, monthEnd),
  ])

  return { meta: metaData, shopify: shopifyData, analytics: analyticsData, generatedAt: new Date().toISOString() }
}

async function getMetaSummary(clientId: string, start: Date, end: Date) {
  const meta = await getLiveMetaSummary(clientId, start, end)
  const byType = Object.fromEntries(meta.byType.map((bucket) => [bucket.type, bucket]))
  return { byType, totalSpend: meta.totalSpend, totalRevenue: meta.totalRevenue, totalRoas: meta.totalRoas }
}

async function getShopifySummary(clientId: string, start: Date, end: Date) {
  const metrics = await db.shopifyMetric.findMany({ where: { clientId, date: { gte: start, lte: end } } })

  const totals = metrics.reduce(
    (acc, m) => ({
      revenue: acc.revenue + m.totalRevenue,
      orders: acc.orders + m.totalOrders,
      newCustomers: acc.newCustomers + m.newCustomers,
      returningCustomers: acc.returningCustomers + m.returningCustomers,
      refunds: acc.refunds + m.refunds,
    }),
    { revenue: 0, orders: 0, newCustomers: 0, returningCustomers: 0, refunds: 0 },
  )

  const topProducts = await db.topProduct.findMany({
    where: { clientId, month: format(start, 'yyyy-MM') },
    orderBy: { rank: 'asc' },
    take: 5,
  })

  return {
    ...totals,
    avgOrderValue: totals.orders > 0 ? totals.revenue / totals.orders : 0,
    topProducts,
  }
}

async function getAnalyticsSummary(clientId: string, start: Date, end: Date) {
  const analytics = await getLiveGA4Summary(clientId, start, end)
  return {
    sessions: analytics.sessions,
    users: analytics.users,
    newUsers: analytics.newUsers,
    pageviews: analytics.pageviews,
    bounceRate: analytics.bounceRate,
    organicSearch: analytics.organicSearch,
    paidSearch: analytics.paidSearch,
    social: analytics.social,
    direct: analytics.direct,
    referral: analytics.referral,
    email: analytics.email,
  }
}
