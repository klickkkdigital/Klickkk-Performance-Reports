import { requireSession } from '@/lib/auth'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import KpiCard from '@/components/ui/KpiCard'
import SectionHeader from '@/components/ui/SectionHeader'
import { getLiveGA4Summary } from '@/lib/live-google-analytics'
import { Users, Monitor, MousePointer2, BarChart3 } from 'lucide-react'

export default async function AnalyticsPage() {
  const session = await requireSession()
  const clientId = session.clientId!

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const analytics = await getLiveGA4Summary(clientId, monthStart, monthEnd)
  const sessions = analytics.sessions
  const users = analytics.users
  const newUsers = analytics.newUsers
  const pageviews = analytics.pageviews
  const bounceRate = analytics.bounceRate
  const avgDuration = analytics.avgSessionDuration

  const channels = [
    { label: 'Organic Search', value: analytics.organicSearch, color: 'bg-emerald-400' },
    { label: 'Paid Search', value: analytics.paidSearch, color: 'bg-blue-400' },
    { label: 'Social', value: analytics.social, color: 'bg-violet-400' },
    { label: 'Direct', value: analytics.direct, color: 'bg-orange-400' },
    { label: 'Referral', value: analytics.referral, color: 'bg-pink-400' },
    { label: 'Email', value: analytics.email, color: 'bg-sky-400' },
  ].sort((a, b) => b.value - a.value)

  const totalChannelSessions = channels.reduce((s, c) => s + c.value, 0)

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.round(seconds % 60)
    return `${m}m ${s}s`
  }

  return (
    <div>
      <SectionHeader title={`Analytics — ${format(now, 'MMMM yyyy')}`} description="Google Analytics 4" />

      {!analytics.connected && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          Google Analytics is not connected yet.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Sessions" value={sessions.toLocaleString()} icon={Monitor} iconBg="bg-blue-50" />
        <KpiCard label="Users" value={users.toLocaleString()} subValue={`${newUsers.toLocaleString()} new`} icon={Users} iconBg="bg-violet-50" />
        <KpiCard label="Bounce Rate" value={`${(bounceRate * 100).toFixed(1)}%`} icon={MousePointer2} iconBg="bg-rose-50" />
        <KpiCard label="Avg Session" value={formatDuration(avgDuration)} icon={BarChart3} iconBg="bg-emerald-50" />
      </div>

      {/* Traffic channels */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-medium text-gray-700 mb-5">Traffic by Channel</h3>
        <div className="space-y-3">
          {channels.map((c) => {
            const pct = totalChannelSessions > 0 ? (c.value / totalChannelSessions) * 100 : 0
            return (
              <div key={c.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">{c.label}</span>
                  <span className="text-sm font-medium text-gray-900">{c.value.toLocaleString()} <span className="text-gray-400 font-normal text-xs">({pct.toFixed(1)}%)</span></span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${c.color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
          {totalChannelSessions === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No analytics data for this month yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
