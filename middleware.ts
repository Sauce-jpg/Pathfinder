import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/signup',
  '/auth/callback',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  console.log('[middleware] path:', pathname)

  const isPublicPath = PUBLIC_PATHS.some(p => pathname.startsWith(p))
  console.log('[middleware] isPublicPath:', isPublicPath)
  
  if (isPublicPath) {
    console.log('[middleware] allowing through:', pathname)
    return NextResponse.next()
  }

  const response = NextResponse.next()
  const supabase = createMiddlewareClient({ req: request, res: response })
  const { data: { session } } = await supabase.auth.getSession()
  
  console.log('[middleware] session:', session ? 'EXISTS' : 'NULL')

  if (!session) {
    console.log('[middleware] redirecting to login')
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/auth/login'
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}
