'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

interface Bookmark {
  id: string
  title: string
  url: string
  description: string | null
  tags: string[]
  folder: string | null
  favicon_url: string | null
  created_at: string
}

const EMPTY_FORM = { title: '', url: '', description: '', tags: '', folder: '' }

export default function BookmarksPage() {
  const router = useRouter()

  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [userId, setUserId] = useState<string | null>(null)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [activeFolder, setActiveFolder] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Sync theme from hub
  useEffect(() => {
    const saved = localStorage.getItem('hub-theme') as 'dark' | 'light' | null
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setTheme(saved ?? (prefersDark ? 'dark' : 'light'))
  }, [])

  // Auth check
  useEffect(() => {
    const hasSession = document.cookie.includes('sb-session=1')
    if (!hasSession) { router.push('/auth/login'); return }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return }
      setUserId(session.user.id)
    })
  }, [])

  const d = theme === 'dark'
  const bg      = d ? '#0f0e0c' : '#f7f4ef'
  const surface  = d ? '#1c1a17' : '#ffffff'
  const surface2 = d ? '#242118' : '#f4f1eb'
  const border   = d ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const text     = d ? '#f0ece4' : '#1a1714'
  const text2    = d ? '#9c9487' : '#6b6358'
  const text3    = d ? '#5c5750' : '#b0a89c'
  const accent   = d ? '#e8c97a' : '#c8900a'
  const shadow   = d
    ? '0 2px 8px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.35)'
    : '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06)'
  const shadowHover = d
    ? '0 4px 16px rgba(0,0,0,0.6), 0 16px 48px rgba(0,0,0,0.4)'
    : '0 4px 12px rgba(0,0,0,0.1), 0 12px 40px rgba(0,0,0,0.08)'

  const fetchBookmarks = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    let query = supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (activeTag) query = query.contains('tags', [activeTag])
    if (activeFolder) query = query.eq('folder', activeFolder)
    if (search) query = query.or(`title.ilike.%${search}%,url.ilike.%${search}%,description.ilike.%${search}%`)
    const { data, error } = await query
    if (!error) setBookmarks(data ?? [])
    setLoading(false)
  }, [userId, search, activeTag, activeFolder])

  useEffect(() => { fetchBookmarks() }, [fetchBookmarks])

  const allTags = Array.from(new Set(bookmarks.flatMap(b => b.tags))).sort()
  const allFolders = Array.from(new Set(bookmarks.map(b => b.folder).filter(Boolean))) as string[]

  function getFavicon(url: string) {
    try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32` }
    catch { return null }
  }

  async function handleSave() {
    setFormError('')
    if (!form.title.trim() || !form.url.trim()) { setFormError('Title and URL are required.'); return }
    try { new URL(form.url) } catch { setFormError('Enter a valid URL (include https://).'); return }
    if (!userId) return
    setSaving(true)
    const payload = {
      user_id: userId,
      title: form.title.trim(),
      url: form.url.trim(),
      description: form.description.trim() || null,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      folder: form.folder.trim() || null,
      favicon_url: getFavicon(form.url.trim()),
    }
    if (editingId) {
      const { error } = await supabase.from('bookmarks').update(payload).eq('id', editingId).eq('user_id', userId)
      if (error) { setFormError('Failed to update.'); setSaving(false); return }
    } else {
      const { error } = await supabase.from('bookmarks').insert(payload)
      if (error) { setFormError('Failed to save. URL may already exist.'); setSaving(false); return }
    }
    setSaving(false)
    setShowAddModal(false)
    setForm(EMPTY_FORM)
    setEditingId(null)
    fetchBookmarks()
  }

  function openEdit(b: Bookmark) {
    setForm({ title: b.title, url: b.url, description: b.description || '', tags: b.tags.join(', '), folder: b.folder || '' })
    setEditingId(b.id)
    setFormError('')
    setShowAddModal(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this bookmark?')) return
    await supabase.from('bookmarks').delete().eq('id', id).eq('user_id', userId!)
    fetchBookmarks()
  }

  function parseBookmarkHTML(html: string): { title: string; url: string; folder: string | null }[] {
    const results: { title: string; url: string; folder: string | null }[] = []
    const sections = html.split(/<h3[^>]*>/i)
    const firstLinks = sections[0].matchAll(/<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi)
    for (const m of firstLinks) {
      if (m[1].startsWith('http')) results.push({ url: m[1], title: m[2].trim(), folder: null })
    }
    for (let i = 1; i < sections.length; i++) {
      const folderMatch = sections[i].match(/^([^<]+)<\/h3>/i)
      const folder = folderMatch ? folderMatch[1].trim() : null
      const links = sections[i].matchAll(/<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi)
      for (const m of links) {
        if (m[1].startsWith('http')) results.push({ url: m[1], title: m[2].trim(), folder })
      }
    }
    return results
  }

  async function handleImport() {
    if (!importFile || !userId) return
    setImporting(true)
    setImportResult(null)
    const html = await importFile.text()
    const parsed = parseBookmarkHTML(html)
    if (parsed.length === 0) { setImportResult('No bookmarks found in file.'); setImporting(false); return }
    const rows = parsed.map(b => ({
      user_id: userId,
      title: b.title,
      url: b.url,
      folder: b.folder,
      tags: [] as string[],
      favicon_url: getFavicon(b.url),
    }))
    let imported = 0
    for (let i = 0; i < rows.length; i += 50) {
      const { data, error } = await supabase
        .from('bookmarks')
        .upsert(rows.slice(i, i + 50), { onConflict: 'user_id,url', ignoreDuplicates: true })
        .select()
      if (!error) imported += data?.length ?? 0
    }
    setImportResult(`✓ Imported ${imported} new bookmarks (${parsed.length} found in file).`)
    setImporting(false)
    fetchBookmarks()
  }

  const inputStyle = {
    width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6,
    border: `1px solid ${border}`, background: surface2,
    color: text, fontSize: '0.9rem', boxSizing: 'border-box' as const,
    outline: 'none', fontFamily: 'Crimson Pro, Georgia, serif',
  }

  return (
    <div style={{ background: bg, minHeight: '100vh', color: text, fontFamily: "'Crimson Pro', Georgia, serif", transition: 'background 0.3s, color 0.3s' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&family=DM+Mono:wght@400;500&display=swap');
        .bm-card { transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.22s, border-color 0.18s; }
        .bm-card:hover { transform: translateY(-3px) scale(1.012); }
        .bm-link:hover { color: ${accent} !important; }
        .bm-btn:hover { opacity: 0.85; }
        .bm-chip:hover { border-color: ${accent} !important; color: ${accent} !important; }
        input::placeholder { color: ${text3}; }
      `}</style>

      {/* Header */}
      <header style={{ borderBottom: `1px solid ${border}`, padding: '56px 40px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <button
          onClick={() => router.push('/')}
          style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: text3, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ← Hub
        </button>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: text3, marginBottom: 14 }}>
          Personal
        </p>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(40px, 7vw, 72px)', fontWeight: 900, lineHeight: 0.92, letterSpacing: '-0.02em', color: text, marginBottom: 16 }}>
          Book<em style={{ fontStyle: 'italic', color: accent }}>marks</em>
        </h1>
        <p style={{ fontSize: 17, color: text2, fontStyle: 'italic', marginBottom: 28 }}>
          {bookmarks.length} saved links
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="bm-btn" onClick={() => { setShowImportModal(true); setImportResult(null) }}
            style={{ padding: '0.5rem 1.1rem', borderRadius: 7, border: `1px solid ${border}`, background: surface2, color: text2, cursor: 'pointer', fontSize: '0.9rem', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' }}>
            Import
          </button>
          <button className="bm-btn" onClick={() => { setShowAddModal(true); setForm(EMPTY_FORM); setEditingId(null); setFormError('') }}
            style={{ padding: '0.5rem 1.1rem', borderRadius: 7, border: 'none', background: accent, color: d ? '#1a1714' : '#fff', cursor: 'pointer', fontSize: '0.9rem', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em', fontWeight: 600 }}>
            + Add
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 40px 64px' }}>

        {/* Search */}
        <input
          placeholder="Search bookmarks..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, marginBottom: '1.5rem', padding: '0.75rem 1rem', fontSize: '1rem', borderRadius: 8 }}
        />

        {/* Folders */}
        {allFolders.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <button className="bm-chip" onClick={() => setActiveFolder(null)}
              style={{ padding: '0.3rem 0.85rem', borderRadius: 20, border: `1px solid ${activeFolder === null ? accent : border}`, background: activeFolder === null ? `${accent}22` : 'transparent', color: activeFolder === null ? accent : text2, cursor: 'pointer', fontSize: '0.82rem', fontFamily: "'DM Mono', monospace" }}>
              All
            </button>
            {allFolders.map(f => (
              <button key={f} className="bm-chip" onClick={() => setActiveFolder(activeFolder === f ? null : f)}
                style={{ padding: '0.3rem 0.85rem', borderRadius: 20, border: `1px solid ${activeFolder === f ? accent : border}`, background: activeFolder === f ? `${accent}22` : 'transparent', color: activeFolder === f ? accent : text2, cursor: 'pointer', fontSize: '0.82rem', fontFamily: "'DM Mono', monospace" }}>
                {f}
              </button>
            ))}
          </div>
        )}

        {/* Tags */}
        {allTags.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
            {allTags.map(t => (
              <button key={t} className="bm-chip" onClick={() => setActiveTag(activeTag === t ? null : t)}
                style={{ padding: '0.25rem 0.7rem', borderRadius: 20, border: `1px solid ${activeTag === t ? accent : border}`, background: activeTag === t ? `${accent}22` : surface2, color: activeTag === t ? accent : text3, cursor: 'pointer', fontSize: '0.78rem', fontFamily: "'DM Mono', monospace" }}>
                #{t}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <p style={{ color: text3, textAlign: 'center', marginTop: '4rem', fontStyle: 'italic' }}>Loading...</p>
        ) : bookmarks.length === 0 ? (
          <p style={{ color: text3, textAlign: 'center', marginTop: '4rem', fontStyle: 'italic' }}>No bookmarks yet — add one or import from your browser.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {bookmarks.map(b => (
              <div key={b.id} className="bm-card"
                style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: '1.1rem 1.2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', boxShadow: shadow }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = shadowHover)}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = shadow)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                  {b.favicon_url && <img src={b.favicon_url} width={16} height={16} style={{ marginTop: 3, flexShrink: 0 }} onError={e => (e.currentTarget.style.display = 'none')} />}
                  <a href={b.url} target="_blank" rel="noopener noreferrer" className="bm-link"
                    style={{ color: text, fontWeight: 600, textDecoration: 'none', fontSize: '1rem', lineHeight: 1.3, fontFamily: "'Playfair Display', serif", transition: 'color 0.15s' }}>
                    {b.title}
                  </a>
                </div>
                {b.description && <p style={{ color: text2, fontSize: '0.85rem', margin: 0, lineHeight: 1.5, fontStyle: 'italic' }}>{b.description}</p>}
                <p style={{ color: text3, fontSize: '0.75rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'DM Mono', monospace" }}>{b.url}</p>
                {b.folder && <p style={{ color: text3, fontSize: '0.75rem', margin: 0, fontFamily: "'DM Mono', monospace" }}>📁 {b.folder}</p>}
                {b.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {b.tags.map(t => <span key={t} style={{ background: surface2, color: accent, fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: 4, fontFamily: "'DM Mono', monospace" }}>#{t}</span>)}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
                  <button onClick={() => openEdit(b)} style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', background: 'transparent', border: `1px solid ${border}`, borderRadius: 5, color: text3, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>Edit</button>
                  <button onClick={() => handleDelete(b.id)} style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', background: 'transparent', border: `1px solid ${border}`, borderRadius: 5, color: text3, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setShowAddModal(false)}>
          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: '1.75rem', width: '100%', maxWidth: 480, boxShadow: shadow }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 1.25rem', fontFamily: "'Playfair Display', serif", color: text }}>{editingId ? 'Edit Bookmark' : 'Add Bookmark'}</h2>
            {(['title', 'url', 'description', 'tags', 'folder'] as const).map(field => (
              <div key={field} style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: text3, marginBottom: '0.3rem', fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {field === 'tags' ? 'Tags (comma-separated)' : field}
                </label>
                <input
                  value={form[field]}
                  onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  placeholder={field === 'url' ? 'https://...' : field === 'tags' ? 'dev, tools, reference' : ''}
                  style={inputStyle}
                />
              </div>
            ))}
            {formError && <p style={{ color: '#e05c5c', fontSize: '0.85rem', margin: '0 0 0.75rem', fontStyle: 'italic' }}>{formError}</p>}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button onClick={() => setShowAddModal(false)} style={{ padding: '0.5rem 1.1rem', borderRadius: 7, border: `1px solid ${border}`, background: 'transparent', color: text2, cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.85rem' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '0.5rem 1.1rem', borderRadius: 7, border: 'none', background: accent, color: d ? '#1a1714' : '#fff', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.85rem', fontWeight: 600 }}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setShowImportModal(false)}>
          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: '1.75rem', width: '100%', maxWidth: 480, boxShadow: shadow }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 0.75rem', fontFamily: "'Playfair Display', serif", color: text }}>Import Bookmarks</h2>
            <p style={{ color: text2, fontSize: '0.9rem', margin: '0 0 0.5rem', lineHeight: 1.6, fontStyle: 'italic' }}>
              Export bookmarks from your browser as an HTML file, then upload it here. Works with Chrome, Firefox, Safari, and Edge.
            </p>
            <p style={{ color: text3, fontSize: '0.8rem', margin: '0 0 1.25rem', lineHeight: 1.7, fontFamily: "'DM Mono', monospace" }}>
              Chrome: Bookmarks → ⋮ → Export bookmarks<br />
              Firefox: Bookmarks → Manage → Import and Backup → Export HTML
            </p>
            <input type="file" accept=".html" onChange={e => setImportFile(e.target.files?.[0] || null)}
              style={{ marginBottom: '1rem', color: text2, fontSize: '0.9rem' }} />
            {importResult && <p style={{ color: importResult.startsWith('✓') ? '#6aaa72' : '#e05c5c', fontSize: '0.85rem', margin: '0 0 0.75rem', fontStyle: 'italic' }}>{importResult}</p>}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowImportModal(false)} style={{ padding: '0.5rem 1.1rem', borderRadius: 7, border: `1px solid ${border}`, background: 'transparent', color: text2, cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.85rem' }}>Close</button>
              <button onClick={handleImport} disabled={!importFile || importing} style={{ padding: '0.5rem 1.1rem', borderRadius: 7, border: 'none', background: accent, color: d ? '#1a1714' : '#fff', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '0.85rem', fontWeight: 600 }}>{importing ? 'Importing...' : 'Import'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
