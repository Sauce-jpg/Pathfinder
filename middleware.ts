import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/signup',
  '/auth/callback',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublicPath = PUBLIC_PATHS.some(p => pathname.startsWith(p))
  if (isPublicPath) return NextResponse.next()

  const hasSession = request.cookies.getAll().some(
    cookie => cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')
  )

  if (!hasSession) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/auth/login'
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}
