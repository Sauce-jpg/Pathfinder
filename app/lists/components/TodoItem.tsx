'use client'

// app/lists/components/TodoItem.tsx
// Recursive — renders a todo item and any children (subtasks) indented below it.

import { useState } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import { TodoItem as TodoItemType } from '../types'
import styles from './TodoItem.module.css'

type Props = {
  item: TodoItemType
  allItems: TodoItemType[]   // full flat list, used to find children
  onToggle: (item: TodoItemType) => void
  onRefresh: () => void
  supabase: SupabaseClient
  depth: number
}

const MAX_DEPTH = 2

export default function TodoItem({ item, allItems, onToggle, onRefresh, supabase, depth }: Props) {
  const [addingChild, setAddingChild]   = useState(false)
  const [childTitle, setChildTitle]     = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle]               = useState(item.title)

  const children = allItems.filter(i => i.parent_id === item.id)

  const handleDelete = async () => {
    await supabase.from('todo_items').delete().eq('id', item.id)
    onRefresh()
  }

  const handleRename = async () => {
    if (!title.trim()) return
    await supabase.from('todo_items').update({ title: title.trim() }).eq('id', item.id)
    setEditingTitle(false)
    onRefresh()
  }

  const handleAddChild = async () => {
    if (!childTitle.trim()) return
    await supabase.from('todo_items').insert({
      list_id:    item.list_id,
      parent_id:  item.id,
      title:      childTitle.trim(),
      sort_order: children.length,
    })
    setChildTitle('')
    setAddingChild(false)
    onRefresh()
  }

  return (
    <li className={styles.item} style={{ paddingLeft: depth * 20 }}>
      <div className={styles.row}>
        {/* Checkbox */}
        <button
          className={`${styles.checkbox} ${item.done ? styles.checked : ''}`}
          onClick={() => onToggle(item)}
          aria-label={item.done ? 'Mark incomplete' : 'Mark complete'}
          role="checkbox"
          aria-checked={item.done}
        >
          {item.done && <i className="ti ti-check" aria-hidden="true" />}
        </button>

        {/* Title */}
        {editingTitle ? (
          <input
            className={styles.titleInput}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={handleRename}
            onKeyDown={e => {
              if (e.key === 'Enter')  handleRename()
              if (e.key === 'Escape') { setTitle(item.title); setEditingTitle(false) }
            }}
            autoFocus
            aria-label="Rename item"
          />
        ) : (
          <span
            className={`${styles.title} ${item.done ? styles.done : ''}`}
            onDoubleClick={() => setEditingTitle(true)}
          >
            {item.title}
          </span>
        )}

        {/* Due date */}
        {item.due_date && (
          <span className={styles.dueDate}>
            <i className="ti ti-calendar" aria-hidden="true" />
            {new Date(item.due_date).toLocaleDateString('sv-SE')}
          </span>
        )}

        {/* Actions */}
        <div className={styles.actions}>
          {depth < MAX_DEPTH && (
            <button
              className={styles.iconBtn}
              onClick={() => setAddingChild(a => !a)}
              aria-label="Add subtask"
            >
              <i className="ti ti-subtask" aria-hidden="true" />
            </button>
          )}
          <button
            className={styles.iconBtn}
            onClick={handleDelete}
            aria-label="Delete item"
          >
            <i className="ti ti-trash" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Add subtask inline input */}
      {addingChild && (
        <div className={styles.addChildRow} style={{ paddingLeft: (depth + 1) * 20 }}>
          <input
            className={styles.addChildInput}
            value={childTitle}
            onChange={e => setChildTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter')  handleAddChild()
              if (e.key === 'Escape') setAddingChild(false)
            }}
            placeholder="Subtask…"
            autoFocus
            aria-label="New subtask"
          />
          <button onClick={handleAddChild} className={styles.iconBtn} aria-label="Add subtask">
            <i className="ti ti-plus" aria-hidden="true" />
          </button>
          <button onClick={() => setAddingChild(false)} className={styles.iconBtn} aria-label="Cancel">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Recursive children */}
      {children.length > 0 && (
        <ul className={styles.children} role="list">
          {children.map(child => (
            <TodoItem
              key={child.id}
              item={child}
              allItems={allItems}
              onToggle={onToggle}
              onRefresh={onRefresh}
              supabase={supabase}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
