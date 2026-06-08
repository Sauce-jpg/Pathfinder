'use client'

// app/lists/components/BacklogBoard.tsx
// Four status columns. Items within each column are reorderable via drag.
// Uses the HTML5 drag-and-drop API — no extra dependencies needed.

import { useState, useRef } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import { BacklogItem, BacklogStatus } from '../types'
import styles from './BacklogBoard.module.css'

type Props = {
  items: BacklogItem[]
  onRefresh: () => void
  supabase: SupabaseClient
}

const COLUMNS: { id: BacklogStatus; label: string; icon: string }[] = [
  { id: 'backlog',     label: 'Backlog',     icon: 'ti-stack-2'     },
  { id: 'up_next',     label: 'Up next',     icon: 'ti-player-skip-forward' },
  { id: 'in_progress', label: 'In progress', icon: 'ti-loader-2'    },
  { id: 'done',        label: 'Done',        icon: 'ti-circle-check' },
]

export default function BacklogBoard({ items, onRefresh, supabase }: Props) {
  const [newItemTitle, setNewItemTitle] = useState('')
  const [addingTo, setAddingTo]         = useState<BacklogStatus | null>(null)
  const [newCategory, setNewCategory]   = useState('')
  const dragItem = useRef<BacklogItem | null>(null)

  const byStatus = (status: BacklogStatus) =>
    items.filter(i => i.status === status).sort((a, b) => a.sort_order - b.sort_order)

  const handleAddItem = async (status: BacklogStatus) => {
    if (!newItemTitle.trim()) return
    const colItems = byStatus(status)
    await supabase.from('backlog_items').insert({
      title:      newItemTitle.trim(),
      status,
      category:   newCategory.trim() || null,
      sort_order: colItems.length,
    })
    setNewItemTitle('')
    setNewCategory('')
    setAddingTo(null)
    onRefresh()
  }

  const handleStatusChange = async (item: BacklogItem, newStatus: BacklogStatus) => {
    const colItems = byStatus(newStatus)
    await supabase
      .from('backlog_items')
      .update({ status: newStatus, sort_order: colItems.length })
      .eq('id', item.id)
    onRefresh()
  }

  const handleDelete = async (item: BacklogItem) => {
    await supabase.from('backlog_items').delete().eq('id', item.id)
    onRefresh()
  }

  // Drag reorder within the same column
  const handleDrop = async (e: React.DragEvent, targetItem: BacklogItem) => {
    e.preventDefault()
    const source = dragItem.current
    if (!source || source.id === targetItem.id) return
    if (source.status !== targetItem.status) return

    const col = byStatus(source.status)
    const sourceIdx = col.findIndex(i => i.id === source.id)
    const targetIdx = col.findIndex(i => i.id === targetItem.id)

    const reordered = [...col]
    reordered.splice(sourceIdx, 1)
    reordered.splice(targetIdx, 0, source)

    // Batch update sort_order
    const updates = reordered.map((item, idx) =>
      supabase.from('backlog_items').update({ sort_order: idx }).eq('id', item.id)
    )
    await Promise.all(updates)
    onRefresh()
  }

  return (
    <div className={styles.board}>
      {COLUMNS.map(col => {
        const colItems = byStatus(col.id)
        return (
          <div key={col.id} className={styles.column}>
            <div className={styles.colHeader}>
              <i className={`ti ${col.icon}`} aria-hidden="true" />
              <span className={styles.colLabel}>{col.label}</span>
              <span className={styles.colCount}>{colItems.length}</span>
              <button
                className={styles.addColBtn}
                onClick={() => setAddingTo(addingTo === col.id ? null : col.id)}
                aria-label={`Add item to ${col.label}`}
              >
                <i className="ti ti-plus" aria-hidden="true" />
              </button>
            </div>

            {addingTo === col.id && (
              <div className={styles.addForm}>
                <input
                  className={styles.addInput}
                  value={newItemTitle}
                  onChange={e => setNewItemTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter')  handleAddItem(col.id)
                    if (e.key === 'Escape') setAddingTo(null)
                  }}
                  placeholder="Item title…"
                  autoFocus
                  aria-label="New backlog item title"
                />
                <input
                  className={styles.addInput}
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  placeholder="Category (optional)"
                  aria-label="Category"
                />
                <div className={styles.addFormActions}>
                  <button
                    className={styles.confirmAddBtn}
                    onClick={() => handleAddItem(col.id)}
                    disabled={!newItemTitle.trim()}
                  >
                    Add
                  </button>
                  <button className={styles.cancelAddBtn} onClick={() => setAddingTo(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <ul className={styles.itemList} role="list">
              {colItems.length === 0 && addingTo !== col.id && (
                <li className={styles.emptyCol}>Empty</li>
              )}
              {colItems.map(item => (
                <li
                  key={item.id}
                  className={styles.card}
                  draggable
                  onDragStart={() => { dragItem.current = item }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => handleDrop(e, item)}
                >
                  <div className={styles.cardTop}>
                    <span className={styles.cardTitle}>{item.title}</span>
                    <button
                      onClick={() => handleDelete(item)}
                      aria-label="Delete item"
                      className={styles.deleteBtn}
                    >
                      <i className="ti ti-trash" aria-hidden="true" />
                    </button>
                  </div>

                  {item.category && (
                    <span className={styles.category}>{item.category}</span>
                  )}

                  {/* Quick status move buttons */}
                  <div className={styles.moveButtons}>
                    {COLUMNS.filter(c => c.id !== col.id).map(c => (
                      <button
                        key={c.id}
                        className={styles.moveBtn}
                        onClick={() => handleStatusChange(item, c.id)}
                        title={`Move to ${c.label}`}
                        aria-label={`Move to ${c.label}`}
                      >
                        → {c.label}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
