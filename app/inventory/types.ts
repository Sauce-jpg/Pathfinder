export type ItemStatus =
  | "owned"
  | "household"
  | "wishlist"
  | "on_order"
  | "lent_out"
  | "gifted"
  | "sold"
  | "consumed"
  | "discarded";

export const STATUS_OPTIONS: Array<{ value: ItemStatus; label: string; color: string }> = [
  { value: "owned",     label: "Owned",           color: ""        },
  { value: "household",  label: "Household",        color: "#06b6d4" },
  { value: "wishlist",  label: "Wishlist",         color: "#3b82f6" },
  { value: "on_order",  label: "On order",         color: "#8b5cf6" },
  { value: "lent_out",  label: "Lent out",         color: "#f59e0b" },
  { value: "gifted",    label: "Gifted",           color: "#ec4899" },
  { value: "sold",      label: "Sold",             color: "#f97316" },
  { value: "consumed",  label: "Consumed",         color: "#6b7280" },
  { value: "discarded", label: "Discarded",        color: "#ef4444" },
];

export function statusLabel(s: string): string {
  return STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;
}

export function statusColor(s: string): string {
  return STATUS_OPTIONS.find((o) => o.value === s)?.color ?? "";
}

export type DbItem = {
  id: string;
  user_id: string;
  name: string;
  type: string | null;
  category: string | null;
  brand: string | null;
  model: string | null;
  quantity: number;
  location: string | null;
  tags: string[];
  notes: string | null;
  images: string[];
  purchase: any;
  specs: any;
  purchase_history: any;
  parent_id: string | null;
  status: ItemStatus;
  status_meta: any;
};

export type DbItemLink = {
  id: string;
  user_id: string;
  from_item_id: string;
  to_item_id: string;
  relation_type: string;
  note: string | null;
  meta: any;
  created_at: string;
};

export type DbSetup = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  parent_setup_id: string | null;
};

export type DbSetupItem = {
  id: string;
  setup_id: string;
  item_id: string;
  user_id: string;
  position: number;
  include_in_parent_summary: boolean;
};

export type DbPhoto = {
  id: string;
  user_id: string;
  url: string;
  date_taken: string | null;
  location: string | null;
  description: string | null;
  tags: string[];
  item_ids: string[];
  pins: Array<{ item_id: string; x: number; y: number }>;
  created_at: string;
  updated_at: string;
};

export type DbOrderMeta = {
  order_id:    string;
  user_id:     string;
  extra_costs: Array<{ label: string; amount: number; currency: string }>;
  documents:   string[];
  notes:       string | null;
  created_at:  string;
  updated_at:  string;
};

export type Tab = "inventory" | "setups" | "orders";

export type SortKey =
  | "name-asc"
  | "name-desc"
  | "date-desc"
  | "date-asc"
  | "price-desc"
  | "price-asc";

export type Filters = {
  q: string;
  category: string;
  location: string;
  buildStatus: string;
  paintStatus: string;
  sort: SortKey;
  status: string;
  showNonOwned: boolean;
};

export const DEFAULT_FILTERS: Filters = {
  q: "",
  category: "",
  location: "",
  buildStatus: "",
  paintStatus: "",
  sort: "name-asc",
  status: "",
  showNonOwned: false,
};

export type ColumnKey =
  | "name"
  | "brand_model"
  | "category"
  | "type"
  | "location"
  | "price"
  | "date"
  | "tags"
  | "quantity"
  | "build_status"
  | "paint_status"
  | "status";

export type ColumnDef = {
  key: ColumnKey;
  label: string;
  defaultWidth?: number;
};

export const ALL_COLUMNS: ColumnDef[] = [
  { key: "name",         label: "Name",          defaultWidth: 220 },
  { key: "brand_model",  label: "Brand / Model",  defaultWidth: 180 },
  { key: "category",     label: "Category",       defaultWidth: 130 },
  { key: "type",         label: "Type",           defaultWidth: 110 },
  { key: "location",     label: "Location",       defaultWidth: 130 },
  { key: "price",        label: "Price",          defaultWidth: 100 },
  { key: "date",         label: "Date",           defaultWidth: 110 },
  { key: "tags",         label: "Tags",           defaultWidth: 180 },
  { key: "quantity",     label: "Qty",            defaultWidth:  70 },
  { key: "build_status", label: "Build",          defaultWidth: 110 },
  { key: "paint_status", label: "Paint",          defaultWidth: 110 },
  { key: "status",       label: "Status",         defaultWidth: 110 },
];

export const CATEGORY_COLUMN_PRESETS: Record<string, ColumnKey[]> = {
  default:     ["name", "category", "location", "price", "date"],
  Wargame:     ["name", "quantity", "build_status", "paint_status", "location"],
  Peripherals: ["name", "brand_model", "category", "location", "price"],
  "PC Setup":  ["name", "brand_model", "type", "location", "price"],
  LEGO:        ["name", "brand_model", "quantity", "price", "date"],
  Lighting:    ["name", "brand_model", "location", "price", "date"],
  Furniture:   ["name", "brand_model", "location", "price", "date"],
  Tools:       ["name", "brand_model", "location", "price", "date"],
};
