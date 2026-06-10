'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import styles from './lists.module.css'
import { Project, Note, TodoList, PurchaseList, HubEvent } from './types'
import EventSuggestionBanner from './components/EventSuggestionBanner'
import ProjectCard from './components/ProjectCard'
import ProjectModal from './components/ProjectModal'
import NoteCard from './components/NoteCard'
import NoteModal from './components/NoteModal'
import TodoListView from './components/TodoList'
import PurchaseListView from './components/PurchaseList'
import BacklogView from './components/BacklogView'
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

  const [projects, setProjects]           = useState<Project[]>([])
  const [notes, setNotes]                 = useState<Note[]>([])
  const [todoLists, setTodoLists]         = useState<TodoList[]>([])
  const [purchaseLists, setPurchaseLists] = useState<PurchaseList[]>([])
  const [events, setEvents]               = useState<HubEvent[]>([])

  const [showProjectModal, setShowProjectModal]   = useState(false)
  const [showNoteModal, setShowNoteModal]         = useState(false)
  const [showTodoModal, setShowTodoModal]         = useState(false)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [editingProject, setEditingProject]       = useState<Project | null>(null)
  const [editingNote, setEditingNote]             = useState<Note | null>(null)

  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) window.location.href = '/auth/login'
    })
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [
      { data: proj },
      { data: notesData },
      { data: todoData },
      { data: purchaseData },
      { data: eventsData },
    ] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('notes').select('*').order('pinned', { ascending: false }).order('updated_at', { ascending: false }),
      supabase.from('todo_lists').select('*, items:todo_items(*)').order('created_at', { ascending: false }),
      supabase.from('purchase_lists').select('*, items:purchase_items(*)').order('created_at', { ascending: false }),
      supabase.from('hub_events').select('*').eq('dismissed', false).eq('suggest_timeline', true).order('created_at', { ascending: false }),
    ])

    if (proj)         setProjects(proj)
    if (notesData)    setNotes(notesData)
    if (todoData)     setTodoLists(todoData)
    if (purchaseData) setPurchaseLists(purchaseData)
    if (eventsData)   setEvents(eventsData)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleDismissEvents = async (ids: string[]) => {
    await supabase.from('hub_events').update({ dismissed: true }).in('id', ids)
    setEvents(prev => prev.filter(e => !ids.includes(e.id)))
  }

  // Backlog items derived from all sources
  const backlogProjects  = projects.filter(p => p.in_backlog)
  const backlogNotes     = notes.filter(n => n.in_backlog)
  const backlogTodos     = todoLists.filter(t => t.in_backlog)
  const backlogPurchases = purchaseLists.filter(p => p.in_backlog)
  const backlogCount     = backlogProjects.length + backlogNotes.length + backlogTodos.length + backlogPurchases.length

  return (
    <div className={styles.page}>

      {events.length > 0 && (
        <EventSuggestionBanner events={events} onDismiss={handleDismissEvents} />
      )}

      <div className={styles.backBar}>
        <a href="/" className={styles.backLink}>
          <i className="ti ti-arrow-left" aria-hidden="true" />
          Daniel's Hub
        </a>
      </div>

      <div className={styles.header}>
        <h1 className={styles.title}>Lists</h1>
        {tab !== 'backlog' && (
          <button
            className={styles.newButton}
            onClick={() => {
              if (tab === 'projects')  { setEditingProject(null); setShowProjectModal(true) }
              if (tab === 'notes')     { setEditingNote(null);    setShowNoteModal(true) }
              if (tab === 'todos')     setShowTodoModal(true)
              if (tab === 'purchases') setShowPurchaseModal(true)
            }}
            aria-label="Create new item"
          >
            <i className="ti ti-plus" aria-hidden="true" />
            New {TABS.find(t => t.id === tab)?.label.replace(/s$/, '')}
          </button>
        )}
      </div>

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
            {t.id === 'backlog' && backlogCount > 0 && (
              <span className={styles.tabBadge}>{backlogCount}</span>
            )}
          </button>
        ))}
      </nav>

      <main className={styles.content}>
        {loading ? (
          <div className={styles.loading}>
            <i className="ti ti-loader-2" aria-hidden="true" />
          </div>
        ) : (
          <>
            {tab === 'projects' && (
              <>
                <div className={styles.tabToolbar}>
                  <button
                    className={`${styles.filterBtn} ${showArchived ? styles.filterBtnActive : ''}`}
                    onClick={() => setShowArchived(a => !a)}
                  >
                    <i className="ti ti-archive" aria-hidden="true" />
                    {showArchived ? 'Hide archived' : 'Show archived'}
                  </button>
                </div>
                <div className={styles.grid}>
                  {projects.filter(p => showArchived ? p.status === 'archived' : p.status !== 'archived').length === 0 && (
                    <p className={styles.empty}>
                      {showArchived ? 'No archived projects.' : 'No projects yet.'}
                    </p>
                  )}
                  {projects
                    .filter(p => showArchived ? p.status === 'archived' : p.status !== 'archived')
                    .map(p => (
                      <ProjectCard
                        key={p.id}
                        project={p}
                        onEdit={() => { setEditingProject(p); setShowProjectModal(true) }}
                        onRefresh={fetchAll}
                        supabase={supabase}
                      />
                    ))}
                </div>
              </>
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
                    projects={projects}
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
                    projects={projects}
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
                    projects={projects}
                    onRefresh={fetchAll}
                    supabase={supabase}
                  />
                ))}
              </div>
            )}

            {tab === 'backlog' && (
              <BacklogView
                projects={backlogProjects}
                notes={backlogNotes}
                todoLists={backlogTodos}
                purchaseLists={backlogPurchases}
                allProjects={projects}
                onRefresh={fetchAll}
                supabase={supabase}
                onEditNote={(n) => { setEditingNote(n); setShowNoteModal(true) }}
                onEditProject={(p) => { setEditingProject(p); setShowProjectModal(true) }}
              />
            )}
          </>
        )}
      </main>

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
    </div>
  )
}
