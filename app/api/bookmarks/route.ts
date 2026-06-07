import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { createClient } = await import('@/lib/supabaseClient')
  const cookieHeader = req.headers.get('cookie') || ''
  if (!cookieHeader.includes('sb-session=1')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { supabase } = await import('@/lib/supabaseClient')

  const { searchParams } = new URL(req.url)
  const tag = searchParams.get('tag')
  const folder = searchParams.get('folder')
  const q = searchParams.get('q')

  let query = supabase
    .from('bookmarks')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  if (tag) query = query.contains('tags', [tag])
  if (folder) query = query.eq('folder', folder)
  if (q) query = query.or(`title.ilike.%${q}%,url.ilike.%${q}%,description.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const { createClient } = await import('@/lib/supabaseClient')
  const cookieHeader = req.headers.get('cookie') || ''
  if (!cookieHeader.includes('sb-session=1')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { supabase } = await import('@/lib/supabaseClient')

  const body = await req.json()
  const { title, url, description, tags, folder } = body

  if (!title || !url) return NextResponse.json({ error: 'Title and URL required' }, { status: 400 })

  const favicon_url = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`

  const { data, error } = await supabase.from('bookmarks').insert({
    user_id: session.user.id,
    title,
    url,
    description: description || null,
    tags: tags || [],
    folder: folder || null,
    favicon_url,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const { createClient } = await import('@/lib/supabaseClient')
  const cookieHeader = req.headers.get('cookie') || ''
  if (!cookieHeader.includes('sb-session=1')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { supabase } = await import('@/lib/supabaseClient')

  const { id } = await req.json()
  const { error } = await supabase.from('bookmarks').delete().eq('id', id).eq('user_id', session.user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
