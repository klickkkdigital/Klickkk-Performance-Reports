import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { UserRole } from '@prisma/client'
import { requireEnv } from './env'

const SESSION_COOKIE = 'klickkk_session'
const EXPIRY = '7d'
const LOGIN_TRANSFER_EXPIRY = '60s'

function getSecret() {
  const secret = requireEnv('SESSION_SECRET')
  if (process.env.NODE_ENV === 'production' && secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters in production.')
  }
  return new TextEncoder().encode(secret)
}

export type SessionPayload = {
  userId: string
  role: UserRole
  clientId: string | null
  clientSlug: string | null
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret())

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function createLoginTransferToken(payload: SessionPayload) {
  return new SignJWT({ ...payload, kind: 'login_transfer' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(LOGIN_TRANSFER_EXPIRY)
    .sign(getSecret())
}

export async function verifyLoginTransferToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.kind !== 'login_transfer') return null
    return {
      userId: String(payload.userId),
      role: payload.role as UserRole,
      clientId: typeof payload.clientId === 'string' ? payload.clientId : null,
      clientSlug: typeof payload.clientSlug === 'string' ? payload.clientSlug : null,
    }
  } catch {
    return null
  }
}
