'use client'

// app/lists/components/TripList.tsx

import { useState } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import { TripList as TripListType, TripItem as TripItemType, Project } from '../types'
import TripItem from './TripItem'
import TripItemModal from './TripItemModal'
import styles from './TripList.module.css'
import { emitEvent } from '@/lib/emitEvent'

type Props = {
  list: TripListType
  projects: Project[]
  onRefresh: () => void
  supabase: SupabaseClient
}

const TRAVEL_ICONS: Record<string, string> = {
  walk:   'ti-walk',
  bike:   'ti-bike',
  bus:    'ti-bus',
  train:  'ti-train',
  car:    'ti-car',
  ferry:  'ti-sailboat',
  flight: 'ti-plane',
}

export default function TripList({ list, projects, onRefresh, supabase }: Props) {
  const [collapsed, setCollapsed]         = useState(false)
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem]     = useState<TripItemType | null>(null)

  const items = list.items ?? []
  const doneCount = items.filter(i => i.status === 'done').length

  const handleDeleteList = async () => {
    if (!confirm(`Delete trip list "${list.title}" and all its destinations?`)) return
    await supabase.from('trip_lists').delete().eq('id', list.id)
    onRefresh()
  }

  const handleBacklog = async () => {
    await supabase.from('trip_lists').update({ in_backlog: !list.in_backlog }).eq('id', list.id)
    onRefresh()
  }

  const handleMarkDone = async (item: TripItemType) => {
    await supabase.from('trip_items').update({ status: 'done' }).eq('id', item.id)
    await emitEvent(supabase, {
      source_branch:    'lists',
      event_type:       'trip_done',
      title:            `Visited "${item.name}"${item.location ? ` in ${item.location}` : ''}`,
      metadata:         { list_id: list.id, item_id: item.id, location: item.location },
      suggest_timeline: true,
    })
    onRefresh()
  }

  // Collect all travel options used across items for a summary row
  const allOptions = [...new Set(items.flatMap(i => i.travel_options))]

  return (
    <section className={styles.list}>
      {/* Header */}
      <div className={styles.listHeader}>
        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          <i className={`ti ${collapsed ? 'ti-chevron-right' : 'ti-chevron-down'}`} aria-hidden="true" />
        </button>

        <div className={styles.headerMain}>
          <h3 className={styles.listTitle}>{list.title}</h3>
          {allOptions.length > 0 && (
            <div className={styles.travelSummary}>
              {allOptions.map(opt => (
                <span key={opt} className={styles.travelPill} title={opt}>
                  <i className={`ti ${TRAVEL_ICONS[opt] ?? 'ti-map-pin'}`} aria-hidden="true" />
                </span>
              ))}
            </div>
          )}
        </div>

        <span className={styles.tally}>{doneCount}/{items.length} visited</span>

        <button
          className={styles.addItemBtn}
          onClick={() => { setEditingItem(null); setShowItemModal(true) }}
          aria-label="Add destination"
        >
          <i className="ti ti-plus" aria-hidden="true" />
          Add destination
        </button>

        <button
          onClick={handleBacklog}
          aria-label={list.in_backlog ? 'Remove from backlog' : 'Add to backlog'}
          title={list.in_backlog ? 'Remove from backlog' : 'Add to backlog'}
          className={`${styles.iconBtn} ${list.in_backlog ? styles.iconBtnActive : ''}`}
        >
          <i className="ti ti-stack-2" aria-hidden="true" />
        </button>

        <button
          onClick={handleDeleteList}
          aria-label="Delete list"
          title="Delete list"
          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
        >
          <i className="ti ti-trash" aria-hidden="true" />
        </button>
      </div>

      {!collapsed && (
        <>
          {items.length === 0 ? (
            <p className={styles.empty}>No destinations yet — add one above.</p>
          ) : (
            <ul className={styles.items} role="list">
              {items
                .sort((a, b) => {
                  const order = { decided: 0, considering: 1, done: 2 }
                  return order[a.status] - order[b.status]
                })
                .map(item => (
                  <TripItem
                    key={item.id}
                    item={item}
                    onEdit={() => { setEditingItem(item); setShowItemModal(true) }}
                    onMarkDone={() => handleMarkDone(item)}
                    onRefresh={onRefresh}
                    supabase={supabase}
                  />
                ))}
            </ul>
          )}
        </>
      )}

      {showItemModal && (
        <TripItemModal
          item={editingItem}
          listId={list.id}
          onClose={() => setShowItemModal(false)}
          onSave={() => { setShowItemModal(false); onRefresh() }}
          supabase={supabase}
        />
      )}
    </section>
  )
}
