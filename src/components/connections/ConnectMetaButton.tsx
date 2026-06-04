import { getDashboardUrl } from '@/lib/env'

export default function ConnectMetaButton({ clientId }: { clientId: string }) {
  const META_SCOPES = 'ads_read,ads_management,business_management'
  const clientAppId = process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID

  if (!clientAppId) {
    return (
      <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-100 text-gray-400 rounded-lg">
        Connect Meta
      </span>
    )
  }

  const redirectUri = `${getDashboardUrl()}/api/auth/meta/callback`
  const url = new URL('https://www.facebook.com/v20.0/dialog/oauth')
  url.searchParams.set('client_id', clientAppId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', META_SCOPES)
  url.searchParams.set('state', clientId)
  url.searchParams.set('response_type', 'code')

  return (
    <a
      href={url.toString()}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
    >
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
      Connect Meta
    </a>
  )
}
