import { requireConnectionAccess, requireSession } from '@/lib/auth'
import { selectMetaConnection } from '@/actions/connections'
import SectionHeader from '@/components/ui/SectionHeader'

type MetaAccount = {
  id: string
  name: string
  currency?: string
}

type MetaSelectPayload = {
  clientId: string
  selectionId: string
  accounts: MetaAccount[]
}

function parsePayload(value?: string): MetaSelectPayload | null {
  if (!value) return null
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as MetaSelectPayload
  } catch {
    return null
  }
}

export default async function ClientMetaSelectPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>
}) {
  await requireSession()
  const payload = parsePayload((await searchParams).data)

  if (!payload || payload.accounts.length === 0) {
    return (
      <div>
        <SectionHeader title="Select Meta Account" description="No Meta ad accounts were available to connect." />
      </div>
    )
  }

  await requireConnectionAccess(payload.clientId)

  return (
    <div>
      <SectionHeader title="Select Meta Account" description="Choose the ad account to connect." />

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {payload.accounts.map((account) => (
          <form key={account.id} action={selectMetaConnection} className="px-5 py-4 border-b border-gray-50 flex items-center justify-between last:border-b-0">
            <div>
              <p className="text-sm font-medium text-gray-900">{account.name}</p>
              <p className="text-xs text-gray-400 font-mono">{account.id}{account.currency ? ` - ${account.currency}` : ''}</p>
            </div>
            <input type="hidden" name="clientId" value={payload.clientId} />
            <input type="hidden" name="selectionId" value={payload.selectionId} />
            <input type="hidden" name="accountId" value={account.id} />
            <input type="hidden" name="accountName" value={account.name} />
            <button className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Connect
            </button>
          </form>
        ))}
      </div>
    </div>
  )
}
