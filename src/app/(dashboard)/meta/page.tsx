import { requireSession } from '@/lib/auth'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import KpiCard from '@/components/ui/KpiCard'
import SectionHeader from '@/components/ui/SectionHeader'
import { getLiveMetaSummary } from '@/lib/live-meta'
import { Eye, MousePointer2, ShoppingCart, DollarSign } from 'lucide-react'

export default async function MetaPage() {
  const session = await requireSession()
  const clientId = session.clientId!

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const meta = await getLiveMetaSummary(clientId, monthStart, monthEnd)
  const campaigns = meta.campaigns.sort((a, b) => a.name.localeCompare(b.name))

  const typeColors: Record<string, string> = {
    AWARENESS: 'bg-violet-100 text-violet-700',
    TRAFFIC: 'bg-blue-100 text-blue-700',
    SALES: 'bg-emerald-100 text-emerald-700',
  }

  return (
    <div>
      <SectionHeader title={`Meta Ads — ${format(now, 'MMMM yyyy')}`} description="Awareness, Traffic & Sales campaigns" />

      {!meta.connected && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          Meta Ads is not connected yet.
        </div>
      )}

      {/* Sections per campaign type */}
      {['AWARENESS', 'TRAFFIC', 'SALES'].map((type) => {
        const d = meta.byType.find((b) => b.type === type)
        if (!d) return null

        return (
          <div key={type} className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${typeColors[type]}`}>
                {type}
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <KpiCard label="Spend" value={`$${Number(d.spend).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={DollarSign} iconBg="bg-rose-50" />
              {type === 'AWARENESS' && (
                <>
                  <KpiCard label="Impressions" value={Number(d.impressions).toLocaleString()} icon={Eye} iconBg="bg-violet-50" />
                  <KpiCard label="Reach" value={Number(d.reach).toLocaleString()} icon={Eye} iconBg="bg-indigo-50" />
                  <KpiCard label="CPM" value={`$${Number(d.cpm).toFixed(2)}`} icon={DollarSign} iconBg="bg-gray-50" />
                </>
              )}
              {type === 'TRAFFIC' && (
                <>
                  <KpiCard label="Clicks" value={Number(d.clicks).toLocaleString()} icon={MousePointer2} iconBg="bg-blue-50" />
                  <KpiCard label="CTR" value={`${Number(d.ctr).toFixed(2)}%`} icon={MousePointer2} iconBg="bg-sky-50" />
                  <KpiCard label="CPC" value={`$${Number(d.cpc).toFixed(2)}`} icon={DollarSign} iconBg="bg-gray-50" />
                </>
              )}
              {type === 'SALES' && (
                <>
                  <KpiCard label="Purchases" value={Number(d.purchases).toLocaleString()} icon={ShoppingCart} iconBg="bg-emerald-50" />
                  <KpiCard label="ROAS" value={`${Number(d.roas).toFixed(2)}x`} icon={DollarSign} iconBg="bg-green-50" />
                  <KpiCard label="CPA" value={`$${Number(d.cpa).toFixed(2)}`} icon={DollarSign} iconBg="bg-gray-50" />
                </>
              )}
            </div>
          </div>
        )
      })}

      {/* Campaign table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-medium text-gray-700">All Campaigns</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Campaign</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Type</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">Spend</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">Impressions</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">Clicks</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => {
              return (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900 truncate max-w-[240px]">{c.name}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[c.type]}`}>
                      {c.type}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-700">${c.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td className="px-5 py-3 text-right text-gray-700">{c.impressions.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right text-gray-700">{c.clicks.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
