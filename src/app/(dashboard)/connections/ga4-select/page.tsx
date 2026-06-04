import { requireConnectionAccess, requireSession } from '@/lib/auth'
import { selectGoogleConnection } from '@/actions/connections'
import SectionHeader from '@/components/ui/SectionHeader'

type GA4Property = {
  id: string
  name: string
}

type GA4SelectPayload = {
  clientId: string
  selectionId: string
  properties: GA4Property[]
}

function parsePayload(value?: string): GA4SelectPayload | null {
  if (!value) return null
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as GA4SelectPayload
  } catch {
    return null
  }
}

export default async function ClientGA4SelectPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>
}) {
  await requireSession()
  const payload = parsePayload((await searchParams).data)

  if (!payload || payload.properties.length === 0) {
    return (
      <div>
        <SectionHeader title="Select GA4 Property" description="No Google Analytics properties were available to connect." />
      </div>
    )
  }

  await requireConnectionAccess(payload.clientId)

  return (
    <div>
      <SectionHeader title="Select GA4 Property" description="Choose the property to connect." />

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {payload.properties.map((property) => (
          <form key={property.id} action={selectGoogleConnection} className="px-5 py-4 border-b border-gray-50 flex items-center justify-between last:border-b-0">
            <div>
              <p className="text-sm font-medium text-gray-900">{property.name}</p>
              <p className="text-xs text-gray-400 font-mono">properties/{property.id}</p>
            </div>
            <input type="hidden" name="clientId" value={payload.clientId} />
            <input type="hidden" name="selectionId" value={payload.selectionId} />
            <input type="hidden" name="propertyId" value={property.id} />
            <input type="hidden" name="propertyName" value={property.name} />
            <button className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
              Connect
            </button>
          </form>
        ))}
      </div>
    </div>
  )
}
