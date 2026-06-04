import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { format } from 'date-fns'
import SectionHeader from '@/components/ui/SectionHeader'
import ConnectMetaButton from '@/components/connections/ConnectMetaButton'
import ConnectGoogleButton from '@/components/connections/ConnectGoogleButton'
import { CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react'

const syncStatusIcon = {
  SUCCESS: CheckCircle,
  FAILED: XCircle,
  NEVER: Clock,
  SYNCING: RefreshCw,
}

const syncStatusStyle = {
  SUCCESS: 'text-emerald-600',
  FAILED: 'text-red-500',
  NEVER: 'text-gray-400',
  SYNCING: 'text-blue-500',
}

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; clientId?: string }>
}) {
  await requireAdmin()
  const params = await searchParams

  const clients = await db.client.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    include: {
      connections: { where: { isActive: true }, orderBy: { platform: 'asc' } },
    },
  })

  return (
    <div>
      <SectionHeader title="Data Connections" description="Connect Meta and Google Analytics for each client. Shopify stores connect from the Shopify app install flow." />

      {params.error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Connection failed: {params.error.replace(/_/g, ' ')}
        </div>
      )}
      {params.success && (
        <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          {params.success === 'meta' ? 'Meta' : params.success === 'shopify' ? 'Shopify' : 'Google Analytics'} connected successfully!
        </div>
      )}

      <div className="space-y-6">
        {clients.map((client) => (
          <div key={client.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: client.primaryColor }}
                >
                  {client.name[0]}
                </div>
                <span className="font-medium text-gray-900">{client.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <ConnectMetaButton clientId={client.id} />
                <ConnectGoogleButton clientId={client.id} />
              </div>
            </div>

            {client.connections.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">No connections yet. Shopify stores appear here after the Shopify app is installed.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Platform</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Account</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Last Sync</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {client.connections.map((conn) => {
                    const Icon = syncStatusIcon[conn.lastSyncStatus]
                    const style = syncStatusStyle[conn.lastSyncStatus]
                    return (
                      <tr key={conn.id} className="border-b border-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900">{conn.platform}</td>
                        <td className="px-5 py-3 text-gray-600">{conn.accountName}</td>
                        <td className="px-5 py-3 text-gray-400 text-xs">
                          {conn.lastSyncedAt ? format(conn.lastSyncedAt, 'MMM d, h:mm a') : 'Never'}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`flex items-center gap-1 text-xs ${style}`}>
                            <Icon size={12} />
                            {conn.lastSyncStatus}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
