'use client'

// app/lists/components/TodoList.tsx
// Renders a single to-do list with all its items, inline add, and a progress bar.

import { useState } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import { TodoList as TodoListType, TodoItem as TodoItemType, Project } from '../types'
import TodoItem from './TodoItem'
import styles from './TodoList.module.css'
import { emitEvent } from '@/lib/emitEvent'

type Props = {
  list: TodoListType
  projects: Project[]
  onRefresh: () => void
  supabase: SupabaseClient
}

export default function TodoList({ list, projects, onRefresh, supabase }: Props) {
  const [newItemTitle, setNewItemTitle] = useState('')
  const [adding, setAdding]             = useState(false)
  const [collapsed, setCollapsed]       = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [listTitle, setListTitle]       = useState(list.title)

  const items = (list.items ?? []).filter(i => !i.parent_id)

  const totalItems    = (list.items ?? []).length
  const doneItems     = (list.items ?? []).filter(i => i.done).length
  const progressPct   = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0

  const handleAddItem = async () => {
    if (!newItemTitle.trim()) return
    setAdding(true)
    await supabase.from('todo_items').insert({
      list_id:    list.id,
      title:      newItemTitle.trim(),
      sort_order: (list.items ?? []).length,
    })
    setNewItemTitle('')
    setAdding(false)
    onRefresh()
  }

  const handleToggle = async (item: TodoItemType) => {
    await supabase
      .from('todo_items')
      .update({ done: !item.done })
      .eq('id', item.id)

    // Emit event when a top-level item is completed
    if (!item.done) {
      await emitEvent(supabase, {
        source_branch:    'lists',
        event_type:       'todo_completed',
        title:            `Completed "${item.title}" in ${list.title}`,
        metadata:         { list_id: list.id, item_id: item.id },
        suggest_timeline: false,
      })
    }
    onRefresh()
  }

  const handleBacklog = async () => {
    await supabase.from('todo_lists').update({ in_backlog: !list.in_backlog }).eq('id', list.id)
    onRefresh()
  }

  const handleDeleteList = async () => {
    if (!confirm(`Delete list "${list.title}" and all its items?`)) return
    await supabase.from('todo_lists').delete().eq('id', list.id)
    onRefresh()
  }

  const handleRenameList = async () => {
    if (!listTitle.trim()) return
    await supabase.from('todo_lists').update({ title: listTitle.trim() }).eq('id', list.id)
    setEditingTitle(false)
    onRefresh()
  }

  return (
    <section className={styles.list}>
      {/* Header */}
      <div className={styles.listHeader}>
        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expand list' : 'Collapse list'}
        >
          <i className={`ti ${collapsed ? 'ti-chevron-right' : 'ti-chevron-down'}`} aria-hidden="true" />
        </button>

        {editingTitle ? (
          <input
            className={styles.titleInput}
            value={listTitle}
            onChange={e => setListTitle(e.target.value)}
            onBlur={handleRenameList}
            onKeyDown={e => { if (e.key === 'Enter') handleRenameList(); if (e.key === 'Escape') setEditingTitle(false) }}
            autoFocus
            aria-label="Rename list"
          />
        ) : (
          <h3 className={styles.listTitle} onDoubleClick={() => setEditingTitle(true)}>
            {list.title}
          </h3>
        )}

        <span className={styles.progress}>
          {doneItems}/{totalItems}
        </span>

        <button
          onClick={handleBacklog}
          aria-label={list.in_backlog ? 'Remove from backlog' : 'Add to backlog'}
          title={list.in_backlog ? 'Remove from backlog' : 'Add to backlog'}
          className={`${styles.collapseBtn} ${list.in_backlog ? styles.backlogActive : ''}`}
        >
          <i className="ti ti-stack-2" aria-hidden="true" />
        </button>
        <button
          onClick={handleDeleteList}
          aria-label="Delete list"
          title="Delete list"
          className={styles.deleteBtn}
        >
          <i className="ti ti-trash" aria-hidden="true" />
        </button>
      </div>

      {/* Progress bar */}
      {totalItems > 0 && (
        <div className={styles.progressBar} aria-label={`${progressPct}% complete`}>
          <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
        </div>
      )}

      {/* Items */}
      {!collapsed && (
        <>
          <ul className={styles.items} role="list">
            {items.length === 0 && (
              <li className={styles.emptyHint}>No items yet — add one below</li>
            )}
            {items.map(item => (
              <TodoItem
                key={item.id}
                item={item}
                allItems={list.items ?? []}
                onToggle={handleToggle}
                onRefresh={onRefresh}
                supabase={supabase}
                depth={0}
              />
            ))}
          </ul>

          {/* Inline add */}
          <div className={styles.addRow}>
            <input
              className={styles.addInput}
              value={newItemTitle}
              onChange={e => setNewItemTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddItem()}
              placeholder="Add item…"
              disabled={adding}
              aria-label="New to-do item"
            />
            <button
              className={styles.addBtn}
              onClick={handleAddItem}
              disabled={adding || !newItemTitle.trim()}
              aria-label="Add item"
            >
              <i className="ti ti-plus" aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </section>
  )
}
