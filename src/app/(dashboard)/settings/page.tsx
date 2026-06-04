import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import SectionHeader from '@/components/ui/SectionHeader'
import ConnectMetaButton from '@/components/connections/ConnectMetaButton'
import ConnectGoogleButton from '@/components/connections/ConnectGoogleButton'
import { CheckCircle, Clock } from 'lucide-react'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const session = await requireSession()
  const params = await searchParams
  const connections = session.clientId
    ? await db.dataConnection.findMany({
        where: { clientId: session.clientId, isActive: true },
        orderBy: { platform: 'asc' },
      })
    : []
  const connectedPlatforms = new Set(connections.map((connection) => connection.platform))

  return (
    <div>
      <SectionHeader title="Settings" description="Account and preferences" />

      {params.success && (
        <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          Connection saved.
        </div>
      )}

      {params.error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Connection failed: {params.error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Role</p>
            <p className="text-sm text-gray-900 capitalize">{session.role.replace('_', ' ').toLowerCase()}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Account</p>
            <p className="text-sm text-gray-900">{session.clientSlug ?? 'Admin'}</p>
          </div>
        </div>
      </div>

      {session.clientId && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-3xl mt-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Platform Connections</h2>
              <p className="text-xs text-gray-400 mt-1">Connect reporting sources for this dashboard.</p>
            </div>
            <div className="flex items-center gap-2">
              {!connectedPlatforms.has('META') && <ConnectMetaButton clientId={session.clientId} />}
              {!connectedPlatforms.has('GOOGLE_ANALYTICS') && <ConnectGoogleButton clientId={session.clientId} />}
            </div>
          </div>

          <div className="divide-y divide-gray-50 border border-gray-100 rounded-lg overflow-hidden">
            {[
              { platform: 'META', label: 'Meta Ads' },
              { platform: 'GOOGLE_ANALYTICS', label: 'Google Analytics' },
              { platform: 'SHOPIFY', label: 'Shopify' },
            ].map((item) => {
              const connection = connections.find((conn) => conn.platform === item.platform)
              return (
                <div key={item.platform} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-400">{connection?.accountName ?? 'Not connected'}</p>
                  </div>
                  {connection ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
                      <CheckCircle size={14} />
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                      <Clock size={14} />
                      Pending
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
