import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/signup',
  '/auth/callback',
  '/auth/confirm',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublicPath = PUBLIC_PATHS.some(p => pathname.startsWith(p))
  if (isPublicPath) return NextResponse.next()

  // Log ALL cookies so we can see what's actually there
  const allCookies = request.cookies.getAll()
  console.log('[middleware] path:', pathname)
  console.log('[middleware] cookies:', JSON.stringify(allCookies.map(c => c.name)))

  const hasSession = allCookies.some(
    cookie => cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')
  )
  console.log('[middleware] hasSession:', hasSession)

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
