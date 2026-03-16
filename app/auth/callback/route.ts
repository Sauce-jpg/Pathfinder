import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  
  // If we have a code, exchange it (PKCE flow)
  const code = requestUrl.searchParams.get('code')
  if (code) {
    // This handles PKCE if it ever works
    return NextResponse.redirect(new URL('/', request.url))
  }

  // For implicit flow, we need to handle #access_token client-side
  // Redirect to a page that can read the hash fragment
  return NextResponse.redirect(new URL('/auth/confirm', request.url))
}
