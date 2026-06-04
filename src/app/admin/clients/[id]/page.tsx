import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import Link from 'next/link'
import SectionHeader from '@/components/ui/SectionHeader'
import ConnectMetaButton from '@/components/connections/ConnectMetaButton'
import ConnectGoogleButton from '@/components/connections/ConnectGoogleButton'
import GenerateReportButton from './GenerateReportButton'
import DisconnectButton from './DisconnectButton'
import { CheckCircle, XCircle, Clock, RefreshCw, ArrowLeft, Users, Plug } from 'lucide-react'

const syncStatusIcon = { SUCCESS: CheckCircle, FAILED: XCircle, NEVER: Clock, SYNCING: RefreshCw }
const syncStatusStyle = { SUCCESS: 'text-emerald-600', FAILED: 'text-red-500', NEVER: 'text-gray-400', SYNCING: 'text-blue-500' }
const platformColor = { META: 'bg-blue-100 text-blue-700', SHOPIFY: 'bg-emerald-100 text-emerald-700', GOOGLE_ANALYTICS: 'bg-orange-100 text-orange-700' }
const platformLabel = { META: 'Meta Ads', SHOPIFY: 'Shopify', GOOGLE_ANALYTICS: 'Google Analytics' }

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const client = await db.client.findUnique({
    where: { id },
    include: {
      connections: { where: { isActive: true }, orderBy: { platform: 'asc' } },
      users: { orderBy: { createdAt: 'asc' } },
      reports: { orderBy: { month: 'desc' }, take: 6 },
    },
  })

  if (!client) notFound()

  const connectedPlatforms = new Set(client.connections.map((c) => c.platform))

  return (
    <div className="max-w-4xl">
      {/* Back */}
      <Link href="/admin/clients" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft size={14} /> Back to clients
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
            style={{ backgroundColor: client.primaryColor }}
          >
            {client.name[0]}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{client.name}</h1>
            <p className="text-xs text-gray-400 font-mono">{client.slug}</p>
          </div>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${client.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
          {client.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* ── Platform Connections ─────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-5">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plug size={15} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Platform Connections</h2>
          </div>
          <div className="flex items-center gap-2">
            {!connectedPlatforms.has('META') && <ConnectMetaButton clientId={client.id} />}
            {!connectedPlatforms.has('GOOGLE_ANALYTICS') && <ConnectGoogleButton clientId={client.id} />}
          </div>
        </div>

        {client.connections.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Plug size={28} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400 mb-1">No platforms connected yet</p>
            <p className="text-xs text-gray-300">Use the buttons above to connect Meta or Google Analytics. Shopify connects from the app install flow.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {client.connections.map((conn) => {
              const Icon = syncStatusIcon[conn.lastSyncStatus]
              const style = syncStatusStyle[conn.lastSyncStatus]
              return (
                <div key={conn.id} className="px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${platformColor[conn.platform]}`}>
                      {platformLabel[conn.platform]}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{conn.accountName}</p>
                      <p className="text-xs text-gray-400 font-mono">{conn.accountId}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className={`flex items-center gap-1 text-xs ${style}`}>
                        <Icon size={11} />
                        {conn.lastSyncStatus}
                      </span>
                      {conn.lastSyncedAt && (
                        <p className="text-xs text-gray-300 mt-0.5">{format(conn.lastSyncedAt, 'MMM d, h:mm a')}</p>
                      )}
                    </div>
                    <DisconnectButton connectionId={conn.id} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Reports ─────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-5">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Reports</h2>
          <GenerateReportButton clientId={client.id} />
        </div>

        {client.reports.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">No reports generated yet. Use the button above to generate one.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Month</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Generated</th>
              </tr>
            </thead>
            <tbody>
              {client.reports.map((r) => {
                const [year, mon] = r.month.split('-')
                const label = format(new Date(parseInt(year), parseInt(mon) - 1), 'MMMM yyyy')
                return (
                  <tr key={r.id} className="border-b border-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{label}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.status === 'READY' ? 'bg-emerald-100 text-emerald-700' :
                        r.status === 'PROCESSING' ? 'bg-blue-100 text-blue-700' :
                        r.status === 'FAILED' ? 'bg-red-100 text-red-600' :
                        'bg-gray-100 text-gray-500'
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {r.generatedAt ? format(r.generatedAt, 'MMM d, yyyy h:mm a') : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Users ───────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Users size={15} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">Users</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Name</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Email</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Last Login</th>
            </tr>
          </thead>
          <tbody>
            {client.users.map((u) => (
              <tr key={u.id} className="border-b border-gray-50">
                <td className="px-5 py-3 font-medium text-gray-900">{u.name}</td>
                <td className="px-5 py-3 text-gray-500">{u.email}</td>
                <td className="px-5 py-3 text-gray-400 text-xs">
                  {u.lastLoginAt ? format(u.lastLoginAt, 'MMM d, yyyy h:mm a') : 'Never'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
