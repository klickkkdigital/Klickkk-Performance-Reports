import 'server-only'
import bcrypt from 'bcryptjs'
import { db } from './db'
import { getSession } from './session'
import { redirect } from 'next/navigation'

export async function verifyCredentials(email: string, password: string) {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { client: { select: { id: true, slug: true, name: true, logoUrl: true, primaryColor: true } } },
  })
  if (!user || !user.isActive) return null

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return null

  return user
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12)
}

// Call in server components/actions to get the current user or redirect
export async function requireSession() {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

export async function requireAdmin() {
  const session = await requireSession()
  if (session.role !== 'SUPER_ADMIN') redirect('/overview')
  return session
}

export async function requireConnectionAccess(clientId: string) {
  const session = await requireSession()
  if (session.role === 'SUPER_ADMIN') return session
  if (session.clientId === clientId) return session
  redirect('/overview')
}
