'use client'

// app/lists/components/ProjectModal.tsx
// Create/edit a project. Includes a LinkPicker section for cross-branch references.

import { useState, useEffect } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import { Project, ProjectLink, LinkBranch } from '../types'
import styles from './Modal.module.css'
import linkStyles from './ProjectModal.module.css'

type Props = {
  project: Project | null
  onClose: () => void
  onSave: () => void
  supabase: SupabaseClient
}

type LinkCandidate = {
  branch: LinkBranch
  source_id: string
  label: string
}

const BRANCH_CONFIG: { id: LinkBranch; label: string; icon: string; table: string; labelCol: string }[] = [
  { id: 'bookmarks',  label: 'Bookmarks',  icon: 'ti-bookmark',  table: 'bookmarks',  labelCol: 'title' },
  { id: 'inventory',  label: 'Inventory',  icon: 'ti-package',   table: 'items',      labelCol: 'name'  },
  { id: 'pathfinder', label: 'Pathfinder', icon: 'ti-sword',     table: 'characters', labelCol: 'name'  },
  { id: 'game_night', label: 'Game Night', icon: 'ti-dice-5',    table: 'games',      labelCol: 'title' },
]

export default function ProjectModal({ project, onClose, onSave, supabase }: Props) {
  const [title, setTitle]             = useState(project?.title ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [status, setStatus]           = useState(project?.status ?? 'active')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  // Links
  const [existingLinks, setExistingLinks] = useState<ProjectLink[]>([])
  const [linkSearch, setLinkSearch]       = useState('')
  const [linkBranch, setLinkBranch]       = useState<LinkBranch>('bookmarks')
  const [candidates, setCandidates]       = useState<LinkCandidate[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  useEffect(() => {
    document.getElementById('project-title')?.focus()
    if (project) fetchExistingLinks()
  }, [])

  const fetchExistingLinks = async () => {
    if (!project) return
    const { data } = await supabase
      .from('project_links')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at')
    if (data) setExistingLinks(data)
  }

  // Search the relevant branch table for matching items
  const searchCandidates = async () => {
    if (!linkSearch.trim()) return
    setSearchLoading(true)
    const cfg = BRANCH_CONFIG.find(b => b.id === linkBranch)!
    const { data } = await supabase
      .from(cfg.table)
      .select(`id, ${cfg.labelCol}`)
      .ilike(cfg.labelCol, `%${linkSearch}%`)
      .limit(8)
    const rows = (data ?? []) as unknown as Record<string, string>[]
    setCandidates(
      rows.map(row => ({
        branch: linkBranch,
        source_id: row.id,
        label: row[cfg.labelCol],
      }))
    )
    setSearchLoading(false)
  }

  const addLink = async (candidate: LinkCandidate) => {
    if (!project) return
    await supabase.from('project_links').upsert({
      project_id: project.id,
      branch: candidate.branch,
      source_id: candidate.source_id,
      label: candidate.label,
    }, { onConflict: 'project_id,branch,source_id' })
    setCandidates([])
    setLinkSearch('')
    fetchExistingLinks()
  }

  const removeLink = async (linkId: string) => {
    await supabase.from('project_links').delete().eq('id', linkId)
    setExistingLinks(prev => prev.filter(l => l.id !== linkId))
  }

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Not logged in — please refresh the page'); setSaving(false); return }

    const user = session.user

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      status,
    }

    const { error: dbError } = project
      ? await supabase.from('projects').update(payload).eq('id', project.id)
      : await supabase.from('projects').insert({ ...payload, user_id: user.id })

    setSaving(false)
    if (dbError) { setError(dbError.message); return }
    onSave()
  }

  const branchIcon = (branch: LinkBranch) =>
    BRANCH_CONFIG.find(b => b.id === branch)?.icon ?? 'ti-link'

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title">

        <div className={styles.modalHeader}>
          <h2 id="modal-title" className={styles.modalTitle}>
            {project ? 'Edit project' : 'New project'}
          </h2>
          <button onClick={onClose} aria-label="Close" className={styles.closeBtn}>
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div className={styles.modalBody}>

          {/* ── Core fields ── */}
          <label className={styles.label} htmlFor="project-title">Title</label>
          <input
            id="project-title"
            className={styles.input}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Build gaming PC"
          />

          <label className={styles.label} htmlFor="project-desc">Description</label>
          <textarea
            id="project-desc"
            className={styles.textarea}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What is this project about?"
            rows={3}
          />

          {project && (
            <>
              <label className={styles.label} htmlFor="project-status">Status</label>
              <select
                id="project-status"
                className={styles.select}
                value={status}
                onChange={e => setStatus(e.target.value as Project['status'])}
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </>
          )}

          {error && <p className={styles.error}>{error}</p>}

          {/* ── Linked resources (only when editing an existing project) ── */}
          {project && (
            <div className={linkStyles.linksSection}>
              <p className={linkStyles.linksSectionTitle}>
                <i className="ti ti-link" aria-hidden="true" />
                Linked resources
              </p>

              {/* Existing links */}
              {existingLinks.length > 0 && (
                <ul className={linkStyles.linkList}>
                  {existingLinks.map(link => (
                    <li key={link.id} className={linkStyles.linkItem}>
                      <i className={`ti ${branchIcon(link.branch)}`} aria-hidden="true" />
                      <span className={linkStyles.linkLabel}>{link.label}</span>
                      <span className={linkStyles.linkBranch}>{link.branch}</span>
                      <button
                        onClick={() => removeLink(link.id)}
                        aria-label={`Remove link to ${link.label}`}
                        className={linkStyles.removeLinkBtn}
                      >
                        <i className="ti ti-x" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Search to add new link */}
              <div className={linkStyles.linkSearch}>
                <select
                  className={linkStyles.branchSelect}
                  value={linkBranch}
                  onChange={e => { setLinkBranch(e.target.value as LinkBranch); setCandidates([]) }}
                  aria-label="Select branch to search"
                >
                  {BRANCH_CONFIG.map(b => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))}
                </select>
                <input
                  className={linkStyles.linkSearchInput}
                  value={linkSearch}
                  onChange={e => setLinkSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchCandidates()}
                  placeholder="Search to link…"
                  aria-label="Search for item to link"
                />
                <button
                  onClick={searchCandidates}
                  className={linkStyles.searchBtn}
                  disabled={searchLoading}
                  aria-label="Search"
                >
                  <i className={`ti ${searchLoading ? 'ti-loader-2' : 'ti-search'}`} aria-hidden="true" />
                </button>
              </div>

              {candidates.length > 0 && (
                <ul className={linkStyles.candidateList}>
                  {candidates.map(c => (
                    <li key={c.source_id}>
                      <button
                        className={linkStyles.candidateBtn}
                        onClick={() => addLink(c)}
                      >
                        <i className={`ti ${branchIcon(c.branch)}`} aria-hidden="true" />
                        {c.label}
                        <i className="ti ti-plus" aria-hidden="true" style={{ marginLeft: 'auto' }} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {!project && (
            <p className={linkStyles.linkHint}>
              <i className="ti ti-info-circle" aria-hidden="true" />
              You can link bookmarks, inventory items and more after saving.
            </p>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save project'}
          </button>
        </div>
      </div>
    </div>
  )
}
