import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { getDashboardRedirect, getDashboardUrl } from '@/lib/env'
import { exchangeCodeForToken, getLongLivedToken, fetchAdAccounts } from '@/lib/meta'
import { saveMetaConnection } from '@/actions/connections'
import { createOAuthSelection } from '@/lib/oauth-selection'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // clientId passed via state param
  const error = searchParams.get('error')

  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.redirect(getDashboardRedirect('/login', req.url))
  }

  const errorPath = session.role === 'SUPER_ADMIN' ? '/admin/connections' : '/settings'
  const successPath = (clientId: string) => session.role === 'SUPER_ADMIN' ? `/admin/clients/${clientId}` : '/settings'
  const selectPath = session.role === 'SUPER_ADMIN' ? '/admin/connections/meta-select' : '/connections/meta-select'

  if (error || !code || !state) {
    return NextResponse.redirect(getDashboardRedirect(`${errorPath}?error=meta_denied`, req.url))
  }

  if (session.role !== 'SUPER_ADMIN' && session.clientId !== state) {
    return NextResponse.redirect(getDashboardRedirect('/settings?error=connection_forbidden', req.url))
  }

  try {
    const redirectUri = `${getDashboardUrl(req.url)}/api/auth/meta/callback`

    const shortToken = await exchangeCodeForToken(code, redirectUri)
    const longToken = await getLongLivedToken(shortToken.access_token)
    const accounts = await fetchAdAccounts(longToken.access_token)
    const activeAccounts = accounts.filter((a) => a.account_status === 1)

    if (activeAccounts.length === 0) {
      return NextResponse.redirect(getDashboardRedirect(`${errorPath}?error=no_ad_accounts`, req.url))
    }

    if (activeAccounts.length === 1) {
      const acct = activeAccounts[0]
      const expiresAt = new Date(Date.now() + longToken.expires_in * 1000)
      await saveMetaConnection(state, acct.id, acct.name, longToken.access_token, expiresAt)
      return NextResponse.redirect(getDashboardRedirect(`${successPath(state)}?success=meta`, req.url))
    }

    const selectionId = await createOAuthSelection({
      platform: 'META',
      clientId: state,
      accessToken: longToken.access_token,
      expiresIn: longToken.expires_in,
    })

    const encoded = Buffer.from(JSON.stringify({
      clientId: state,
      selectionId,
      accounts: activeAccounts,
    })).toString('base64url')

    return NextResponse.redirect(getDashboardRedirect(`${selectPath}?data=${encoded}`, req.url))
  } catch (err) {
    console.error('Meta OAuth callback error:', err)
    return NextResponse.redirect(getDashboardRedirect(`${successPath(state)}?error=meta_failed`, req.url))
  }
}
