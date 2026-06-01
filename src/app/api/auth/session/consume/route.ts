import { NextRequest, NextResponse } from 'next/server'
import { createSession, verifyLoginTransferToken } from '@/lib/session'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.redirect(new URL('/login', req.url))

  const session = await verifyLoginTransferToken(token)
  if (!session) return NextResponse.redirect(new URL('/login', req.url))

  await createSession(session)
  return NextResponse.redirect(new URL(session.role === 'SUPER_ADMIN' ? '/admin' : '/overview', req.url))
}
