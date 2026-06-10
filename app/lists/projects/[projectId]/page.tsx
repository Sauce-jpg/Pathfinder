'use client'

// app/lists/projects/[projectId]/page.tsx
// Shows everything belonging to a project in one place.

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Project, Note, TodoList, PurchaseList, ProjectLink } from '../../types'
import NoteCard from '../../components/NoteCard'
import NoteModal from '../../components/NoteModal'
import TodoListView from '../../components/TodoList'
import PurchaseListView from '../../components/PurchaseList'
import SimpleCreateModal from '../../components/SimpleCreateModal'
import styles from './project-detail.module.css'

const BRANCH_ICON: Record<string, string> = {
  bookmarks:  'ti-bookmark',
  inventory:  'ti-package',
  pathfinder: 'ti-sword',
  game_night: 'ti-dice-5',
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const router = useRouter()

  const [project, setProject]       = useState<Project | null>(null)
  const [notes, setNotes]           = useState<Note[]>([])
  const [todoLists, setTodoLists]   = useState<TodoList[]>([])
  const [purchaseLists, setPurchaseLists] = useState<PurchaseList[]>([])
  const [links, setLinks]           = useState<ProjectLink[]>([])
  const [allProjects, setAllProjects] = useState<Project[]>([])

  const [showNoteModal, setShowNoteModal]       = useState(false)
  const [showTodoModal, setShowTodoModal]       = useState(false)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [editingNote, setEditingNote]           = useState<Note | null>(null)
  const [loading, setLoading]                   = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [
      { data: proj },
      { data: notesData },
      { data: todoData },
      { data: purchaseData },
      { data: linksData },
      { data: allProj },
    ] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('notes').select('*').eq('project_id', projectId).order('pinned', { ascending: false }).order('updated_at', { ascending: false }),
      supabase.from('todo_lists').select('*, items:todo_items(*)').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('purchase_lists').select('*, items:purchase_items(*)').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('project_links').select('*').eq('project_id', projectId).order('created_at'),
      supabase.from('projects').select('*').eq('status', 'active'),
    ])

    if (proj) setProject(proj)
    if (notesData) setNotes(notesData)
    if (todoData) setTodoLists(todoData)
    if (purchaseData) setPurchaseLists(purchaseData)
    if (linksData) setLinks(linksData)
    if (allProj) setAllProjects(allProj)
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchAll() }, [fetchAll])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem', color: '#b0a89c', fontSize: '1.5rem' }}>
      <i className="ti ti-loader-2" style={{ animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  if (!project) return (
    <div style={{ padding: '2rem', color: '#b0a89c' }}>Project not found.</div>
  )

  const totalItems = notes.length + todoLists.length + purchaseLists.length

  return (
    <div className={styles.page}>
      <div className={styles.backBar}>
        <a href="/lists" className={styles.backLink}>
          <i className="ti ti-arrow-left" aria-hidden="true" />
          Back to Lists
        </a>
      </div>

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>{project.title}</h1>
          {project.description && (
            <p className={styles.description}>{project.description}</p>
          )}
          <div className={styles.headerMeta}>
            <span className={`${styles.statusBadge} ${styles[project.status]}`}>
              {project.status}
            </span>
            <span className={styles.metaText}>
              {totalItems} item{totalItems !== 1 ? 's' : ''}
            </span>
            <span className={styles.metaText}>
              Created {new Date(project.created_at).toLocaleDateString('sv-SE')}
            </span>
          </div>
        </div>
      </div>

      {/* ── Notes ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <i className="ti ti-notes" aria-hidden="true" />
          <h2 className={styles.sectionTitle}>Notes</h2>
          <span className={styles.sectionCount}>{notes.length}</span>
          <button
            className={styles.addBtn}
            onClick={() => { setEditingNote(null); setShowNoteModal(true) }}
          >
            <i className="ti ti-plus" aria-hidden="true" /> Add note
          </button>
        </div>
        {notes.length === 0 ? (
          <p className={styles.empty}>No notes in this project yet.</p>
        ) : (
          <div className={styles.grid}>
            {notes.map(n => (
              <NoteCard
                key={n.id}
                note={n}
                projects={allProjects}
                onEdit={() => { setEditingNote(n); setShowNoteModal(true) }}
                onRefresh={fetchAll}
                supabase={supabase}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── To-do lists ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <i className="ti ti-checkbox" aria-hidden="true" />
          <h2 className={styles.sectionTitle}>To-do lists</h2>
          <span className={styles.sectionCount}>{todoLists.length}</span>
          <button className={styles.addBtn} onClick={() => setShowTodoModal(true)}>
            <i className="ti ti-plus" aria-hidden="true" /> Add list
          </button>
        </div>
        {todoLists.length === 0 ? (
          <p className={styles.empty}>No to-do lists in this project yet.</p>
        ) : (
          <div className={styles.stack}>
            {todoLists.map(list => (
              <TodoListView
                key={list.id}
                list={list}
                projects={allProjects}
                onRefresh={fetchAll}
                supabase={supabase}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Purchase lists ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <i className="ti ti-shopping-cart" aria-hidden="true" />
          <h2 className={styles.sectionTitle}>Purchase lists</h2>
          <span className={styles.sectionCount}>{purchaseLists.length}</span>
          <button className={styles.addBtn} onClick={() => setShowPurchaseModal(true)}>
            <i className="ti ti-plus" aria-hidden="true" /> Add list
          </button>
        </div>
        {purchaseLists.length === 0 ? (
          <p className={styles.empty}>No purchase lists in this project yet.</p>
        ) : (
          <div className={styles.stack}>
            {purchaseLists.map(list => (
              <PurchaseListView
                key={list.id}
                list={list}
                projects={allProjects}
                onRefresh={fetchAll}
                supabase={supabase}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Linked resources ── */}
      {links.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <i className="ti ti-link" aria-hidden="true" />
            <h2 className={styles.sectionTitle}>Linked resources</h2>
            <span className={styles.sectionCount}>{links.length}</span>
          </div>
          <ul className={styles.linkList}>
            {links.map(link => (
              <li key={link.id} className={styles.linkItem}>
                <i className={`ti ${BRANCH_ICON[link.branch] ?? 'ti-link'}`} aria-hidden="true" />
                <span className={styles.linkLabel}>{link.label}</span>
                <span className={styles.linkBranch}>{link.branch.replace('_', ' ')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Modals */}
      {showNoteModal && (
        <NoteModal
          note={editingNote}
          projects={allProjects}
          defaultProjectId={projectId}
          onClose={() => setShowNoteModal(false)}
          onSave={() => { setShowNoteModal(false); fetchAll() }}
          supabase={supabase}
        />
      )}

      {showTodoModal && (
        <SimpleCreateModal
          title="New to-do list"
          placeholder="e.g. Sprint tasks"
          onClose={() => setShowTodoModal(false)}
          onSave={async (title) => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            await supabase.from('todo_lists').insert({ title, user_id: session.user.id, project_id: projectId })
            setShowTodoModal(false)
            fetchAll()
          }}
        />
      )}

      {showPurchaseModal && (
        <SimpleCreateModal
          title="New purchase list"
          placeholder="e.g. Components"
          onClose={() => setShowPurchaseModal(false)}
          onSave={async (title) => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            await supabase.from('purchase_lists').insert({ title, user_id: session.user.id, project_id: projectId })
            setShowPurchaseModal(false)
            fetchAll()
          }}
        />
      )}
    </div>
  )
}
