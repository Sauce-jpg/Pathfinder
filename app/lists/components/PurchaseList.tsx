'use client'

// app/lists/components/PurchaseList.tsx

import { useState } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import { PurchaseList as PurchaseListType, PurchaseItem as PurchaseItemType } from '../types'
import PurchaseItem from './PurchaseItem'
import PurchaseItemModal from './PurchaseItemModal'
import styles from './PurchaseList.module.css'
import { emitEvent } from '@/lib/emitEvent'

type Props = {
  list: PurchaseListType
  onRefresh: () => void
  supabase: SupabaseClient
}

export default function PurchaseList({ list, onRefresh, supabase }: Props) {
  const [collapsed, setCollapsed]         = useState(false)
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem]     = useState<PurchaseItemType | null>(null)
  const [compareIds, setCompareIds]       = useState<Set<string>>(new Set())

  const items = list.items ?? []
  const boughtCount = items.filter(i => i.status === 'bought').length

  const handleDeleteList = async () => {
    if (!confirm(`Delete list "${list.title}" and all its items?`)) return
    await supabase.from('purchase_lists').delete().eq('id', list.id)
    onRefresh()
  }

  const handleMarkBought = async (item: PurchaseItemType) => {
    await supabase
      .from('purchase_items')
      .update({ status: 'bought' })
      .eq('id', item.id)

    await emitEvent(supabase, {
      source_branch:    'lists',
      event_type:       'purchase_bought',
      title:            `Bought "${item.title}"${item.price ? ` for ${item.price} SEK` : ''}`,
      metadata:         { list_id: list.id, item_id: item.id, price: item.price },
      suggest_timeline: true,
    })

    onRefresh()
  }

  const toggleCompare = (id: string) =>
    setCompareIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const compareItems = items.filter(i => compareIds.has(i.id))

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

        <h3 className={styles.listTitle}>{list.title}</h3>

        <span className={styles.tally}>
          {boughtCount}/{items.length} bought
        </span>

        <button
          className={styles.addItemBtn}
          onClick={() => { setEditingItem(null); setShowItemModal(true) }}
          aria-label="Add item"
        >
          <i className="ti ti-plus" aria-hidden="true" />
          Add item
        </button>

        <button onClick={handleDeleteList} aria-label="Delete list" className={styles.deleteBtn}>
          <i className="ti ti-trash" aria-hidden="true" />
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Compare bar */}
          {compareIds.size >= 2 && (
            <div className={styles.compareBar}>
              <i className="ti ti-columns" aria-hidden="true" />
              Comparing {compareIds.size} items
              <button
                className={styles.compareViewBtn}
                onClick={() => {
                  const ids = [...compareIds].join(',')
                  window.open(`/lists/purchases/compare?ids=${ids}`, '_blank')
                }}
              >
                Open comparison
                <i className="ti ti-external-link" aria-hidden="true" />
              </button>
              <button className={styles.clearCompareBtn} onClick={() => setCompareIds(new Set())}>
                Clear
              </button>
            </div>
          )}

          {/* Items */}
          {items.length === 0 ? (
            <p className={styles.empty}>No items yet.</p>
          ) : (
            <ul className={styles.items} role="list">
              {items.map(item => (
                <PurchaseItem
                  key={item.id}
                  item={item}
                  inCompare={compareIds.has(item.id)}
                  onToggleCompare={() => toggleCompare(item.id)}
                  onEdit={() => { setEditingItem(item); setShowItemModal(true) }}
                  onMarkBought={() => handleMarkBought(item)}
                  onRefresh={onRefresh}
                  supabase={supabase}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {showItemModal && (
        <PurchaseItemModal
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
