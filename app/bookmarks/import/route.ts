import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

function parseBookmarkHTML(html: string): { title: string; url: string; folder: string | null }[] {
  const bookmarks: { title: string; url: string; folder: string | null }[] = []
  
  // Match folder headers and links
  const folderRegex = /<h3[^>]*>([^<]+)<\/h3>/gi
  const linkRegex = /<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi

  // Split into folder sections
  const sections = html.split(/<h3[^>]*>/i)
  
  // First section has no folder
  const firstSection = sections[0]
  let match
  const firstLinkRegex = /<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi
  while ((match = firstLinkRegex.exec(firstSection)) !== null) {
    const url = match[1]
    if (url.startsWith('http')) {
      bookmarks.push({ url, title: match[2].trim(), folder: null })
    }
  }

  // Remaining sections belong to the folder named before them
  for (let i = 1; i < sections.length; i++) {
    const folderMatch = sections[i - 1].match(/<h3[^>]*>([^<]+)$/i) || sections[i].match(/^([^<]+)<\/h3>/i)
    const folderName = folderMatch ? folderMatch[1].trim() : null
    
    const sectionLinkRegex = /<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi
    while ((match = sectionLinkRegex.exec(sections[i])) !== null) {
      const url = match[1]
      if (url.startsWith('http')) {
        bookmarks.push({ url, title: match[2].trim(), folder: folderName })
      }
    }
  }

  return bookmarks
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const html = await file.text()
  const parsed = parseBookmarkHTML(html)

  if (parsed.length === 0) return NextResponse.json({ error: 'No bookmarks found in file' }, { status: 400 })

  const rows = parsed.map(b => ({
    user_id: session.user.id,
    title: b.title,
    url: b.url,
    folder: b.folder,
    tags: [],
    favicon_url: `https://www.google.com/s2/favicons?domain=${new URL(b.url).hostname}&sz=32`,
  }))

  // Upsert — skip duplicates by URL per user
  const { data, error } = await supabase
    .from('bookmarks')
    .upsert(rows, { onConflict: 'user_id,url', ignoreDuplicates: true })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ imported: data?.length ?? 0, total: parsed.length })
}
