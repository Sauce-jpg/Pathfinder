'use client'

// app/lists/page.tsx
// The Lists branch hub. Shows a tab bar (Projects / Notes / To-dos / Purchases / Backlog)
// and an event suggestion banner when there are undismissed hub_events.

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import styles from './lists.module.css'
import {
  Project, Note, TodoList, PurchaseList, BacklogItem, HubEvent
} from './types'
import EventSuggestionBanner from './components/EventSuggestionBanner'
import ProjectCard from './components/ProjectCard'
import ProjectModal from './components/ProjectModal'
import NoteCard from './components/NoteCard'
import NoteModal from './components/NoteModal'
import TodoListView from './components/TodoList'
import PurchaseListView from './components/PurchaseList'
import BacklogBoard from './components/BacklogBoard'
import SimpleCreateModal from './components/SimpleCreateModal'

type Tab = 'projects' | 'notes' | 'todos' | 'purchases' | 'backlog'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'projects',  label: 'Projects',  icon: 'ti-layout-grid' },
  { id: 'notes',     label: 'Notes',     icon: 'ti-notes' },
  { id: 'todos',     label: 'To-dos',    icon: 'ti-checkbox' },
  { id: 'purchases', label: 'Purchases', icon: 'ti-shopping-cart' },
  { id: 'backlog',   label: 'Backlog',   icon: 'ti-stack-2' },
]

export default function ListsPage() {
  const [tab, setTab] = useState<Tab>('projects')

  const [projects, setProjects]       = useState<Project[]>([])
  const [notes, setNotes]             = useState<Note[]>([])
  const [todoLists, setTodoLists]     = useState<TodoList[]>([])
  const [purchaseLists, setPurchaseLists] = useState<PurchaseList[]>([])
  const [backlogItems, setBacklogItems]   = useState<BacklogItem[]>([])
  const [events, setEvents]           = useState<HubEvent[]>([])

  const [showProjectModal, setShowProjectModal] = useState(false)
  const [showNoteModal, setShowNoteModal]       = useState(false)
  const [showTodoModal, setShowTodoModal]       = useState(false)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [showBacklogModal, setShowBacklogModal] = useState(false)
  const [editingProject, setEditingProject]     = useState<Project | null>(null)
  const [editingNote, setEditingNote]           = useState<Note | null>(null)

  const [loading, setLoading] = useState(true)

  // Ensure session is loaded into the shared client on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        window.location.href = '/auth/login'
      }
    })
  }, [])

  // ── Data fetching ────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [
      { data: proj },
      { data: notesData },
      { data: todoData },
      { data: purchaseData },
      { data: backlogData },
      { data: eventsData },
    ] = await Promise.all([
      supabase
        .from('projects')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
      supabase
        .from('notes')
        .select('*')
        .order('pinned', { ascending: false })
        .order('updated_at', { ascending: false }),
      supabase
        .from('todo_lists')
        .select('*, items:todo_items(*)')
        .order('created_at', { ascending: false }),
      supabase
        .from('purchase_lists')
        .select('*, items:purchase_items(*)')
        .order('created_at', { ascending: false }),
      supabase
        .from('backlog_items')
        .select('*')
        .order('sort_order', { ascending: true }),
      supabase
        .from('hub_events')
        .select('*')
        .eq('dismissed', false)
        .eq('suggest_timeline', true)
        .order('created_at', { ascending: false }),
    ])

    if (proj)         setProjects(proj)
    if (notesData)    setNotes(notesData)
    if (todoData)     setTodoLists(todoData)
    if (purchaseData) setPurchaseLists(purchaseData)
    if (backlogData)  setBacklogItems(backlogData)
    if (eventsData)   setEvents(eventsData)
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Event banner dismiss ─────────────────────────────────────────────────

  const handleDismissEvents = async (ids: string[]) => {
    await supabase
      .from('hub_events')
      .update({ dismissed: true })
      .in('id', ids)
    setEvents(prev => prev.filter(e => !ids.includes(e.id)))
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>

      {/* Event suggestion banner */}
      {events.length > 0 && (
        <EventSuggestionBanner
          events={events}
          onDismiss={handleDismissEvents}
        />
      )}

      {/* Back to hub */}
      <div className={styles.backBar}>
        <a href="/" className={styles.backLink}>
          <i className="ti ti-arrow-left" aria-hidden="true" />
          Daniel's Hub
        </a>
      </div>

      {/* Page header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Lists</h1>
        <button
          className={styles.newButton}
          onClick={() => {
            if (tab === 'projects')  { setEditingProject(null); setShowProjectModal(true) }
            if (tab === 'notes')     { setEditingNote(null);    setShowNoteModal(true) }
            if (tab === 'todos')     { setShowTodoModal(true) }
            if (tab === 'purchases') { setShowPurchaseModal(true) }
            if (tab === 'backlog')   { setShowBacklogModal(true) }
          }}
          aria-label="Create new item"
        >
          <i className="ti ti-plus" aria-hidden="true" />
          New {TABS.find(t => t.id === tab)?.label.replace(/s$/, '')}
        </button>
      </div>

      {/* Tab bar */}
      <nav className={styles.tabs} role="tablist">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            <i className={`ti ${t.icon}`} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <main className={styles.content}>
        {loading ? (
          <div className={styles.loading}>
            <i className="ti ti-loader-2" aria-hidden="true" />
          </div>
        ) : (
          <>
            {tab === 'projects' && (
              <div className={styles.grid}>
                {projects.length === 0 && (
                  <p className={styles.empty}>No projects yet. Create one to group notes, tasks and purchases together.</p>
                )}
                {projects.map(p => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onEdit={() => { setEditingProject(p); setShowProjectModal(true) }}
                    onRefresh={fetchAll}
                    supabase={supabase}
                  />
                ))}
              </div>
            )}

            {tab === 'notes' && (
              <div className={styles.grid}>
                {notes.length === 0 && (
                  <p className={styles.empty}>No notes yet.</p>
                )}
                {notes.map(n => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    onEdit={() => { setEditingNote(n); setShowNoteModal(true) }}
                    onRefresh={fetchAll}
                    supabase={supabase}
                  />
                ))}
              </div>
            )}

            {tab === 'todos' && (
              <div className={styles.stack}>
                {todoLists.length === 0 && (
                  <p className={styles.empty}>No to-do lists yet.</p>
                )}
                {todoLists.map(list => (
                  <TodoListView
                    key={list.id}
                    list={list}
                    onRefresh={fetchAll}
                    supabase={supabase}
                  />
                ))}
              </div>
            )}

            {tab === 'purchases' && (
              <div className={styles.stack}>
                {purchaseLists.length === 0 && (
                  <p className={styles.empty}>No purchase lists yet.</p>
                )}
                {purchaseLists.map(list => (
                  <PurchaseListView
                    key={list.id}
                    list={list}
                    onRefresh={fetchAll}
                    supabase={supabase}
                  />
                ))}
              </div>
            )}

            {tab === 'backlog' && (
              <BacklogBoard
                items={backlogItems}
                onRefresh={fetchAll}
                supabase={supabase}
              />
            )}
          </>
        )}
      </main>

      {/* Modals */}
      {showProjectModal && (
        <ProjectModal
          project={editingProject}
          onClose={() => setShowProjectModal(false)}
          onSave={() => { setShowProjectModal(false); fetchAll() }}
          supabase={supabase}
        />
      )}

      {showNoteModal && (
        <NoteModal
          note={editingNote}
          projects={projects}
          onClose={() => setShowNoteModal(false)}
          onSave={() => { setShowNoteModal(false); fetchAll() }}
          supabase={supabase}
        />
      )}

      {showTodoModal && (
        <SimpleCreateModal
          title="New to-do list"
          placeholder="e.g. Website tasks"
          onClose={() => setShowTodoModal(false)}
          onSave={async (title) => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            await supabase.from('todo_lists').insert({ title, user_id: session.user.id })
            setShowTodoModal(false)
            fetchAll()
          }}
        />
      )}

      {showPurchaseModal && (
        <SimpleCreateModal
          title="New purchase list"
          placeholder="e.g. Gaming PC build"
          onClose={() => setShowPurchaseModal(false)}
          onSave={async (title) => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            await supabase.from('purchase_lists').insert({ title, user_id: session.user.id })
            setShowPurchaseModal(false)
            fetchAll()
          }}
        />
      )}

      {showBacklogModal && (
        <SimpleCreateModal
          title="New backlog item"
          placeholder="e.g. Add dark mode"
          onClose={() => setShowBacklogModal(false)}
          onSave={async (title) => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            await supabase.from('backlog_items').insert({ title, user_id: session.user.id, status: 'backlog', sort_order: backlogItems.length })
            setShowBacklogModal(false)
            fetchAll()
          }}
        />
      )}
    </div>
  )
}
