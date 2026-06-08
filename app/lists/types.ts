// app/lists/types.ts

export type ProjectStatus = 'active' | 'completed' | 'archived'

export type Project = {
  id: string
  user_id: string
  title: string
  description: string | null
  status: ProjectStatus
  created_at: string
  updated_at: string
  // joined
  _note_count?: number
  _todo_count?: number
  _purchase_count?: number
  _links?: ProjectLink[]
}

export type Note = {
  id: string
  user_id: string
  project_id: string | null
  title: string
  body: string | null
  tags: string[]
  pinned: boolean
  created_at: string
  updated_at: string
}

export type TodoList = {
  id: string
  user_id: string
  project_id: string | null
  title: string
  created_at: string
  updated_at: string
  // joined
  items?: TodoItem[]
}

export type TodoItem = {
  id: string
  list_id: string
  parent_id: string | null
  title: string
  done: boolean
  due_date: string | null
  sort_order: number
  created_at: string
  // joined
  children?: TodoItem[]
}

export type PurchaseList = {
  id: string
  user_id: string
  project_id: string | null
  title: string
  created_at: string
  updated_at: string
  // joined
  items?: PurchaseItem[]
}

export type PurchaseStatus = 'considering' | 'decided' | 'bought'
export type PurchasePriority = 'low' | 'medium' | 'high'
export type DesireTier = 'need' | 'want' | 'dream'

export type PurchaseItem = {
  id: string
  list_id: string
  title: string
  url: string | null
  price: number | null
  target_price: number | null
  status: PurchaseStatus
  priority: PurchasePriority
  desire_tier: DesireTier
  notes: string | null
  created_at: string
  updated_at: string
}

export type BacklogStatus = 'backlog' | 'up_next' | 'in_progress' | 'done'

export type BacklogItem = {
  id: string
  user_id: string
  project_id: string | null
  title: string
  status: BacklogStatus
  category: string | null
  sort_order: number
  notes: string | null
  created_at: string
  updated_at: string
}

export type LinkBranch = 'bookmarks' | 'inventory' | 'pathfinder' | 'game_night'

export type ProjectLink = {
  id: string
  project_id: string
  branch: LinkBranch
  source_id: string
  label: string
  created_at: string
}

export type HubEvent = {
  id: string
  user_id: string
  source_branch: string
  event_type: string
  title: string
  metadata: Record<string, unknown>
  suggest_timeline: boolean
  dismissed: boolean
  created_at: string
}

// Helper to emit an event from anywhere in the app
export type EmitEventPayload = {
  source_branch: string
  event_type: string
  title: string
  metadata?: Record<string, unknown>
  suggest_timeline?: boolean
}
