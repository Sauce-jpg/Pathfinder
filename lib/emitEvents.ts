// lib/emitEvent.ts
// Call this from any branch when something meaningful happens.
// It writes to hub_events. The lists branch login banner picks these up.
//
// Usage:
//   import { emitEvent } from '@/lib/emitEvent'
//   await emitEvent(supabase, {
//     source_branch: 'inventory',
//     event_type: 'item_added',
//     title: 'Added RTX 5080 to inventory',
//     metadata: { item_id: '...', cost: 12995 },
//     suggest_timeline: true,
//   })

import { SupabaseClient } from '@supabase/supabase-js'
import { EmitEventPayload } from '@/app/lists/types'

export async function emitEvent(
  supabase: SupabaseClient,
  payload: EmitEventPayload
): Promise<void> {
  const { error } = await supabase.from('hub_events').insert({
    source_branch: payload.source_branch,
    event_type: payload.event_type,
    title: payload.title,
    metadata: payload.metadata ?? {},
    suggest_timeline: payload.suggest_timeline ?? false,
    dismissed: false,
  })

  if (error) {
    // Non-fatal — event emission should never break the calling feature
    console.warn('[emitEvent] failed to write hub_event:', error.message)
  }
}
