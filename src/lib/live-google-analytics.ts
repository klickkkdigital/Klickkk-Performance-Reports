import 'server-only'
import { format } from 'date-fns'
import { db } from './db'
import { decrypt, encrypt } from './crypto'
import { fetchGA4Report, normalizeChannel, refreshGoogleToken } from './google-analytics'

export type LiveGA4Summary = {
  connected: boolean
  sessions: number
  users: number
  newUsers: number
  pageviews: number
  bounceRate: number
  avgSessionDuration: number
  organicSearch: number
  paidSearch: number
  social: number
  direct: number
  referral: number
  email: number
}

export function emptyGA4Summary(connected = false): LiveGA4Summary {
  return {
    connected,
    sessions: 0,
    users: 0,
    newUsers: 0,
    pageviews: 0,
    bounceRate: 0,
    avgSessionDuration: 0,
    organicSearch: 0,
    paidSearch: 0,
    social: 0,
    direct: 0,
    referral: 0,
    email: 0,
  }
}

export async function getLiveGA4Summary(clientId: string, start: Date, end: Date): Promise<LiveGA4Summary> {
  const connection = await db.dataConnection.findFirst({
    where: { clientId, platform: 'GOOGLE_ANALYTICS', isActive: true },
    orderBy: { updatedAt: 'desc' },
  })

  if (!connection) return emptyGA4Summary(false)

  let token = await decrypt(connection.accessToken)
  const refreshToken = connection.refreshToken ? await decrypt(connection.refreshToken) : null

  if (refreshToken) {
    const refreshed = await refreshGoogleToken(refreshToken)
    token = refreshed.access_token
    await db.dataConnection.update({
      where: { id: connection.id },
      data: {
        accessToken: await encrypt(refreshed.access_token),
        tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        lastSyncStatus: 'SUCCESS',
        lastSyncError: null,
      },
    })
  }

  const report = await fetchGA4Report(token, connection.accountId, format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'))
  const summary = emptyGA4Summary(true)
  let bounceRateCount = 0

  for (const row of report.rows ?? []) {
    const channel = row.dimensionValues[1].value
    const channelKey = normalizeChannel(channel) as keyof Pick<LiveGA4Summary, 'organicSearch' | 'paidSearch' | 'social' | 'direct' | 'referral' | 'email'>
    const [sessions, users, newUsers, pageviews, bounceRate, avgDuration] =
      row.metricValues.map((metric) => parseFloat(metric.value))

    summary.sessions += sessions
    summary.users += users
    summary.newUsers += newUsers
    summary.pageviews += pageviews
    summary.bounceRate += bounceRate
    summary.avgSessionDuration += avgDuration
    summary[channelKey] += sessions
    bounceRateCount += 1
  }

  summary.bounceRate = bounceRateCount > 0 ? summary.bounceRate / bounceRateCount : 0
  summary.avgSessionDuration = summary.sessions > 0 ? summary.avgSessionDuration / summary.sessions : 0

  return summary
}
