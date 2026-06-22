'use client'

// app/lists/components/BacklogView.tsx
// Shows all items across notes, todo lists, purchase lists and projects
// that have in_backlog = true. Grouped by type.

import { SupabaseClient } from '@supabase/supabase-js'
import { Project, Note, TodoList, PurchaseList, TripList } from '../types'
import styles from './BacklogView.module.css'

type Props = {
  projects: Project[]
  notes: Note[]
  todoLists: TodoList[]
  purchaseLists: PurchaseList[]
  tripLists: TripList[]
  allProjects: Project[]
  onRefresh: () => void
  supabase: SupabaseClient
  onEditNote: (note: Note) => void
  onEditProject: (project: Project) => void
}

type SourceType = 'project' | 'note' | 'todo' | 'purchase' | 'trip'

const TYPE_CONFIG: Record<SourceType, { label: string; icon: string; color: string }> = {
  project:  { label: 'Project',       icon: 'ti-layout-grid',   color: '#7c6fcd' },
  note:     { label: 'Note',          icon: 'ti-notes',         color: '#6b9fd4' },
  todo:     { label: 'To-do list',    icon: 'ti-checkbox',      color: '#5aac8a' },
  purchase: { label: 'Purchase list', icon: 'ti-shopping-cart', color: '#c8900a' },
  trip:     { label: 'Trip list',      icon: 'ti-map-pin',       color: '#5aac8a' },
}

export default function BacklogView({
  projects, notes, todoLists, purchaseLists, tripLists,
  allProjects, onRefresh, supabase, onEditNote, onEditProject
}: Props) {

  const removeFromBacklog = async (table: string, id: string) => {
    await supabase.from(table).update({ in_backlog: false }).eq('id', id)
    onRefresh()
  }

  const total = projects.length + notes.length + todoLists.length + purchaseLists.length + tripLists.length

  if (total === 0) {
    return (
      <div className={styles.empty}>
        <i className="ti ti-stack-2" aria-hidden="true" />
        <p>Nothing in your backlog yet.</p>
        <p className={styles.emptyHint}>
          Use the <i className="ti ti-stack-2" aria-hidden="true" /> button on any note, project, to-do list or purchase list to add it here.
        </p>
      </div>
    )
  }

  const sections: { type: SourceType; table: string; items: (Project | Note | TodoList | PurchaseList | TripList)[] }[] = [
    { type: 'project',  table: 'projects',       items: projects },
    { type: 'note',     table: 'notes',          items: notes },
    { type: 'todo',     table: 'todo_lists',     items: todoLists },
    { type: 'purchase', table: 'purchase_lists', items: purchaseLists },
    { type: 'trip',     table: 'trip_lists',     items: tripLists },
  ]

  return (
    <div className={styles.board}>
      {sections.filter(s => s.items.length > 0).map(section => {
        const cfg = TYPE_CONFIG[section.type]
        return (
          <div key={section.type} className={styles.section}>
            <div className={styles.sectionHeader}>
              <i className={`ti ${cfg.icon}`} style={{ color: cfg.color }} aria-hidden="true" />
              <span className={styles.sectionLabel}>{cfg.label}s</span>
              <span className={styles.sectionCount}>{section.items.length}</span>
            </div>

            <ul className={styles.itemList} role="list">
              {section.items.map(item => {
                const project = 'project_id' in item && item.project_id
                  ? allProjects.find(p => p.id === item.project_id)
                  : null

                return (
                  <li key={item.id} className={styles.card}>
                    <div className={styles.cardLeft}>
                      <i className={`ti ${cfg.icon}`} style={{ color: cfg.color }} aria-hidden="true" />
                    </div>
                    <div className={styles.cardBody}>
                      <span className={styles.cardTitle}>{item.title}</span>
                      {'description' in item && item.description && (
                        <span className={styles.cardDesc}>{(item.description as string).slice(0, 80)}</span>
                      )}
                      {'body' in item && item.body && (
                        <span className={styles.cardDesc}>{(item.body as string).slice(0, 80)}</span>
                      )}
                      <div className={styles.cardMeta}>
                        {'status' in item && section.type === 'project' && (
                          <span className={styles.metaBadge}>{(item as Project).status}</span>
                        )}
                        {project && (
                          <span className={styles.metaBadge}>
                            <i className="ti ti-layout-grid" aria-hidden="true" />
                            {project.title}
                          </span>
                        )}
                        {'items' in item && section.type === 'todo' && (
                          <span className={styles.metaBadge}>
                            {((item as TodoList).items ?? []).filter(i => i.done).length}/
                            {((item as TodoList).items ?? []).length} done
                          </span>
                        )}
                        {'items' in item && section.type === 'purchase' && (
                          <span className={styles.metaBadge}>
                            {((item as PurchaseList).items ?? []).filter(i => i.status === 'bought').length}/
                            {((item as PurchaseList).items ?? []).length} bought
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={styles.cardActions}>
                      {section.type === 'note' && (
                        <button
                          className={styles.actionBtn}
                          onClick={() => onEditNote(item as Note)}
                          title="Edit note"
                          aria-label="Edit note"
                        >
                          <i className="ti ti-edit" aria-hidden="true" />
                        </button>
                      )}
                      {section.type === 'project' && (
                        <button
                          className={styles.actionBtn}
                          onClick={() => onEditProject(item as Project)}
                          title="Edit project"
                          aria-label="Edit project"
                        >
                          <i className="ti ti-edit" aria-hidden="true" />
                        </button>
                      )}
                      <button
                        className={`${styles.actionBtn} ${styles.removeBtn}`}
                        onClick={() => removeFromBacklog(section.table, item.id)}
                        title="Remove from backlog"
                        aria-label="Remove from backlog"
                      >
                        <i className="ti ti-x" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
