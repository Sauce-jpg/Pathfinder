'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

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
  const supabase = createClientComponentClient()

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

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/auth/login')
    })
  }, [])

  const fetchBookmarks = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (activeTag) params.set('tag', activeTag)
    if (activeFolder) params.set('folder', activeFolder)
    const res = await fetch(`/api/bookmarks?${params.toString()}`)
    const data = await res.json()
    setBookmarks(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [search, activeTag, activeFolder])

  useEffect(() => {
    fetchBookmarks()
  }, [fetchBookmarks])

  // Derived filter options
  const allTags = Array.from(new Set(bookmarks.flatMap(b => b.tags))).sort()
  const allFolders = Array.from(new Set(bookmarks.map(b => b.folder).filter(Boolean))) as string[]

  async function handleSave() {
    setFormError('')
    if (!form.title.trim() || !form.url.trim()) {
      setFormError('Title and URL are required.')
      return
    }
    try { new URL(form.url) } catch { setFormError('Enter a valid URL (include https://).'); return }

    setSaving(true)
    const payload = {
      title: form.title.trim(),
      url: form.url.trim(),
      description: form.description.trim() || null,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      folder: form.folder.trim() || null,
    }

    if (editingId) {
      const res = await fetch('/api/bookmarks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...payload }),
      })
      if (!res.ok) { setFormError('Failed to update.'); setSaving(false); return }
    } else {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { setFormError('Failed to save. URL may already exist.'); setSaving(false); return }
    }

    setSaving(false)
    setShowAddModal(false)
    setForm(EMPTY_FORM)
    setEditingId(null)
    fetchBookmarks()
  }

  function openEdit(b: Bookmark) {
    setForm({
      title: b.title,
      url: b.url,
      description: b.description || '',
      tags: b.tags.join(', '),
      folder: b.folder || '',
    })
    setEditingId(b.id)
    setFormError('')
    setShowAddModal(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this bookmark?')) return
    await fetch('/api/bookmarks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    fetchBookmarks()
  }

  async function handleImport() {
    if (!importFile) return
    setImporting(true)
    setImportResult(null)
    const fd = new FormData()
    fd.append('file', importFile)
    const res = await fetch('/api/bookmarks/import', { method: 'POST', body: fd })
    const data = await res.json()
    if (res.ok) {
      setImportResult(`✓ Imported ${data.imported} new bookmarks (${data.total} found in file).`)
      fetchBookmarks()
    } else {
      setImportResult(`Error: ${data.error}`)
    }
    setImporting(false)
  }

  const filtered = bookmarks // server already filters, this is just for display

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#e8e8e8', fontFamily: 'DM Sans, sans-serif', padding: '2rem' }}>
      {/* Header */}
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0, fontFamily: 'Playfair Display, serif' }}>Bookmarks</h1>
            <p style={{ color: '#888', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>{bookmarks.length} saved</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => { setShowImportModal(true); setImportResult(null) }} style={btnStyle('secondary')}>Import</button>
            <button onClick={() => { setShowAddModal(true); setForm(EMPTY_FORM); setEditingId(null); setFormError('') }} style={btnStyle('primary')}>+ Add</button>
          </div>
        </div>

        {/* Search */}
        <input
          placeholder="Search bookmarks..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid #333', background: '#1a1a1a', color: '#e8e8e8', fontSize: '1rem', marginBottom: '1.25rem', boxSizing: 'border-box' }}
        />

        {/* Folders */}
        {allFolders.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <button onClick={() => setActiveFolder(null)} style={chipStyle(activeFolder === null)}>All</button>
            {allFolders.map(f => (
              <button key={f} onClick={() => setActiveFolder(activeFolder === f ? null : f)} style={chipStyle(activeFolder === f)}>{f}</button>
            ))}
          </div>
        )}

        {/* Tags */}
        {allTags.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {allTags.map(t => (
              <button key={t} onClick={() => setActiveTag(activeTag === t ? null : t)} style={tagChipStyle(activeTag === t)}>#{t}</button>
            ))}
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <p style={{ color: '#666', textAlign: 'center', marginTop: '4rem' }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: '#666', textAlign: 'center', marginTop: '4rem' }}>No bookmarks yet. Add one or import from your browser.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {filtered.map(b => (
              <div key={b.id} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#444')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#2a2a2a')}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                  {b.favicon_url && <img src={b.favicon_url} width={16} height={16} style={{ marginTop: 3, flexShrink: 0 }} onError={e => (e.currentTarget.style.display = 'none')} />}
                  <a href={b.url} target="_blank" rel="noopener noreferrer" style={{ color: '#e8e8e8', fontWeight: 600, textDecoration: 'none', fontSize: '0.95rem', lineHeight: 1.3 }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#a78bfa')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#e8e8e8')}>
                    {b.title}
                  </a>
                </div>
                {b.description && <p style={{ color: '#888', fontSize: '0.82rem', margin: 0, lineHeight: 1.4 }}>{b.description}</p>}
                <p style={{ color: '#555', fontSize: '0.75rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.url}</p>
                {b.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {b.tags.map(t => <span key={t} style={{ background: '#2a2a2a', color: '#a78bfa', fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: 4 }}>#{t}</span>)}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
                  <button onClick={() => openEdit(b)} style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', background: 'transparent', border: '1px solid #333', borderRadius: 5, color: '#888', cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => handleDelete(b.id)} style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', background: 'transparent', border: '1px solid #333', borderRadius: 5, color: '#888', cursor: 'pointer' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div style={overlayStyle} onClick={() => setShowAddModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 1.25rem', fontFamily: 'Playfair Display, serif' }}>{editingId ? 'Edit Bookmark' : 'Add Bookmark'}</h2>
            {(['title', 'url', 'description', 'tags', 'folder'] as const).map(field => (
              <div key={field} style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '0.3rem', textTransform: 'capitalize' }}>
                  {field === 'tags' ? 'Tags (comma-separated)' : field}
                </label>
                <input
                  value={form[field]}
                  onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  placeholder={field === 'url' ? 'https://...' : field === 'tags' ? 'dev, tools, reference' : ''}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #333', background: '#111', color: '#e8e8e8', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>
            ))}
            {formError && <p style={{ color: '#f87171', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>{formError}</p>}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAddModal(false)} style={btnStyle('secondary')}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={btnStyle('primary')}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div style={overlayStyle} onClick={() => setShowImportModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 0.5rem', fontFamily: 'Playfair Display, serif' }}>Import Bookmarks</h2>
            <p style={{ color: '#888', fontSize: '0.85rem', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
              Export bookmarks from your browser as an HTML file, then upload it here.<br />
              Works with Chrome, Firefox, Safari, and Edge.
            </p>
            <p style={{ color: '#666', fontSize: '0.8rem', margin: '0 0 1rem' }}>
              Chrome: Bookmarks → ⋮ → Export bookmarks<br />
              Firefox: Bookmarks → Manage → Import and Backup → Export HTML
            </p>
            <input type="file" accept=".html" onChange={e => setImportFile(e.target.files?.[0] || null)}
              style={{ marginBottom: '1rem', color: '#e8e8e8', fontSize: '0.9rem' }} />
            {importResult && <p style={{ color: importResult.startsWith('✓') ? '#4ade80' : '#f87171', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>{importResult}</p>}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowImportModal(false)} style={btnStyle('secondary')}>Close</button>
              <button onClick={handleImport} disabled={!importFile || importing} style={btnStyle('primary')}>{importing ? 'Importing...' : 'Import'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Style helpers
function btnStyle(variant: 'primary' | 'secondary') {
  return {
    padding: '0.5rem 1.1rem',
    borderRadius: 7,
    border: variant === 'secondary' ? '1px solid #333' : 'none',
    background: variant === 'primary' ? '#7c3aed' : 'transparent',
    color: '#e8e8e8',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 500,
  } as React.CSSProperties
}

function chipStyle(active: boolean) {
  return {
    padding: '0.3rem 0.85rem',
    borderRadius: 20,
    border: `1px solid ${active ? '#7c3aed' : '#333'}`,
    background: active ? '#7c3aed22' : 'transparent',
    color: active ? '#a78bfa' : '#888',
    cursor: 'pointer',
    fontSize: '0.82rem',
  } as React.CSSProperties
}

function tagChipStyle(active: boolean) {
  return {
    padding: '0.25rem 0.7rem',
    borderRadius: 20,
    border: `1px solid ${active ? '#a78bfa' : '#2a2a2a'}`,
    background: active ? '#a78bfa22' : '#1a1a1a',
    color: active ? '#a78bfa' : '#666',
    cursor: 'pointer',
    fontSize: '0.78rem',
  } as React.CSSProperties
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
}

const modalStyle: React.CSSProperties = {
  background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: '1.75rem', width: '100%', maxWidth: 480,
}
