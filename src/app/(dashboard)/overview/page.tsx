import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { eachDayOfInterval, format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import KpiCard from '@/components/ui/KpiCard'
import SectionHeader from '@/components/ui/SectionHeader'
import SpendRevenueChart from '@/components/charts/SpendRevenueChart'
import CampaignTypeBreakdown from '@/components/charts/CampaignTypeBreakdown'
import { getLiveMetaSummary } from '@/lib/live-meta'
import { DollarSign, ShoppingCart, TrendingUp } from 'lucide-react'

export default async function OverviewPage() {
  const session = await requireSession()
  const clientId = session.clientId!

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const prevMonthStart = startOfMonth(subMonths(now, 1))
  const prevMonthEnd = endOfMonth(subMonths(now, 1))

  const [shopifyThis, shopifyPrev, shopifyDaily, metaThis, metaPrev] = await Promise.all([
    db.shopifyMetric.aggregate({
      where: { clientId, date: { gte: monthStart, lte: monthEnd } },
      _sum: { totalRevenue: true, totalOrders: true },
    }),
    db.shopifyMetric.aggregate({
      where: { clientId, date: { gte: prevMonthStart, lte: prevMonthEnd } },
      _sum: { totalRevenue: true, totalOrders: true },
    }),
    db.shopifyMetric.findMany({
      where: { clientId, date: { gte: monthStart, lte: monthEnd } },
      select: { date: true, totalRevenue: true },
      orderBy: { date: 'asc' },
    }),
    getLiveMetaSummary(clientId, monthStart, monthEnd),
    getLiveMetaSummary(clientId, prevMonthStart, prevMonthEnd),
  ])

  const revenue = shopifyThis._sum.totalRevenue ?? 0
  const prevRevenue = shopifyPrev._sum.totalRevenue ?? 0
  const orders = shopifyThis._sum.totalOrders ?? 0
  const spend = metaThis.totalSpend
  const prevSpend = metaPrev.totalSpend
  const roas = spend > 0 ? revenue / spend : 0
  const prevRoas = prevSpend > 0 ? (prevRevenue) / prevSpend : 0

  const pct = (curr: number, prev: number) => (prev > 0 ? ((curr - prev) / prev) * 100 : 0)

  const revenueByDay = new Map(shopifyDaily.map((day) => [format(day.date, 'yyyy-MM-dd'), day.totalRevenue]))
  const spendByDay = new Map(metaThis.dailySpend.map((day) => [day.date, day.spend]))
  const chartData = eachDayOfInterval({ start: monthStart, end: monthEnd }).map((day) => {
    const date = format(day, 'yyyy-MM-dd')
    return {
      date,
      spend: spendByDay.get(date) ?? 0,
      revenue: revenueByDay.get(date) ?? 0,
    }
  })
  const byType = metaThis.byType.map((bucket) => ({
    type: bucket.type,
    spend: bucket.spend,
    impressions: bucket.impressions,
    clicks: bucket.clicks,
    roas: bucket.roas,
  }))

  return (
    <div>
      <SectionHeader
        title={`Overview — ${format(now, 'MMMM yyyy')}`}
        description="All platforms combined"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total Revenue"
          value={`$${revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={DollarSign}
          iconBg="bg-emerald-50"
          trend={pct(revenue, prevRevenue)}
        />
        <KpiCard
          label="Ad Spend"
          value={`$${spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={TrendingUp}
          iconBg="bg-rose-50"
          trend={pct(spend, prevSpend)}
        />
        <KpiCard
          label="ROAS"
          value={`${roas.toFixed(2)}x`}
          subValue="Return on ad spend"
          icon={TrendingUp}
          iconBg="bg-blue-50"
          trend={pct(roas, prevRoas)}
        />
        <KpiCard
          label="Orders"
          value={orders.toLocaleString()}
          icon={ShoppingCart}
          iconBg="bg-violet-50"
          trend={pct(orders, shopifyPrev._sum.totalOrders ?? 0)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SpendRevenueChart data={chartData} />
        </div>
        <CampaignTypeBreakdown data={byType} />
      </div>
    </div>
  )
}
