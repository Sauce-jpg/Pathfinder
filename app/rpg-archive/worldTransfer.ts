import { supabase } from '@/lib/supabaseClient';

type Row = Record<string, unknown> & { id: string };

export type WorldBundle = {
  format: string;
  version: number;
  exported_at: string;
  world: Row;
  entity_types: Row[];
  relationship_types: Row[];
  entities: Row[];
  relationships: Row[];
  assets: Row[];
  entity_assets: Row[];
  campaigns: Row[];
  sessions: Row[];
  session_entities: Row[];
  quests: Row[];
  quest_entities: Row[];
  events?: Row[];
  event_entities?: Row[];
};

const PAGE = 1000;

async function fetchAll(table: string, worldId: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('world_id', worldId)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data as Row[]) ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

export async function exportWorld(worldId: string): Promise<WorldBundle> {
  const { data: world, error } = await supabase
    .from('ra_worlds')
    .select('*')
    .eq('id', worldId)
    .single();
  if (error || !world) throw new Error(error?.message ?? 'World not found.');

  const [
    entity_types,
    relationship_types,
    entities,
    relationships,
    assets,
    entity_assets,
    campaigns,
    sessions,
    session_entities,
    quests,
    quest_entities,
    events,
    event_entities,
  ] = await Promise.all([
    fetchAll('ra_entity_types', worldId),
    fetchAll('ra_relationship_types', worldId),
    fetchAll('ra_entities', worldId),
    fetchAll('ra_relationships', worldId),
    fetchAll('ra_assets', worldId),
    fetchAll('ra_entity_assets', worldId),
    fetchAll('ra_campaigns', worldId),
    fetchAll('ra_sessions', worldId),
    fetchAll('ra_session_entities', worldId),
    fetchAll('ra_quests', worldId),
    fetchAll('ra_quest_entities', worldId),
    fetchAll('ra_events', worldId),
    fetchAll('ra_event_entities', worldId),
  ]);

  return {
    format: 'rpg-archive-world',
    version: 1,
    exported_at: new Date().toISOString(),
    world: world as Row,
    entity_types,
    relationship_types,
    entities,
    relationships,
    assets,
    entity_assets,
    campaigns,
    sessions,
    session_entities,
    quests,
    quest_entities,
    events,
    event_entities,
  };
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type FieldDefLite = { key: string; type: string };

async function chunkInsert(
  table: string,
  rows: Row[],
  onProgress?: (msg: string) => void
) {
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase
      .from(table)
      .insert(rows.slice(i, i + 100));
    if (error) throw new Error(`${table}: ${error.message}`);
    onProgress?.(
      `${table.replace('ra_', '')}: ${Math.min(i + 100, rows.length)}/${
        rows.length
      }`
    );
  }
}

/**
 * Imports a bundle as a brand-new world. Every UUID is regenerated and
 * every internal reference (foreign keys, allowed-type arrays, entity_ref
 * and asset_ref field values) is remapped. Returns the new world's slug.
 * If any step fails, the partially imported world is deleted again.
 */
export async function importWorld(
  bundle: WorldBundle,
  newName: string,
  onProgress?: (msg: string) => void
): Promise<string> {
  if (bundle.format !== 'rpg-archive-world' || bundle.version !== 1) {
    throw new Error('This file is not a valid RPG Archive world export.');
  }

  // Fresh UUIDs for every row in every table.
  const map = new Map<string, string>();
  const allRowSets = [
    bundle.entity_types,
    bundle.relationship_types,
    bundle.entities,
    bundle.relationships,
    bundle.assets,
    bundle.entity_assets,
    bundle.campaigns,
    bundle.sessions,
    bundle.session_entities,
    bundle.quests,
    bundle.quest_entities,
    bundle.events ?? [],
    bundle.event_entities ?? [],
  ];
  for (const rows of allRowSets) {
    for (const row of rows ?? []) map.set(row.id, crypto.randomUUID());
  }
  const newWorldId = crypto.randomUUID();
  map.set(bundle.world.id, newWorldId);

  const remap = (id: unknown): unknown =>
    typeof id === 'string' ? map.get(id) ?? id : id;

  // Insert the world first (with slug-conflict retry).
  onProgress?.('Creating world…');
  let slug = slugify(newName) || 'imported-world';
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await supabase.from('ra_worlds').insert({
      ...bundle.world,
      id: newWorldId,
      name: newName,
      slug,
    });
    if (!error) break;
    if (error.code === '23505' && attempt === 0) {
      slug = `${slug}-${Date.now().toString(36)}`;
      continue;
    }
    throw new Error(error.message);
  }

  try {
    // Configuration first.
    onProgress?.('Importing configuration…');
    await chunkInsert(
      'ra_entity_types',
      (bundle.entity_types ?? []).map((r) => ({
        ...r,
        id: remap(r.id),
        world_id: newWorldId,
      })) as Row[],
      onProgress
    );
    await chunkInsert(
      'ra_relationship_types',
      (bundle.relationship_types ?? []).map((r) => ({
        ...r,
        id: remap(r.id),
        world_id: newWorldId,
        allowed_source_types: ((r.allowed_source_types as string[]) ?? []).map(
          (id) => (map.get(id) ?? id) as string
        ),
        allowed_target_types: ((r.allowed_target_types as string[]) ?? []).map(
          (id) => (map.get(id) ?? id) as string
        ),
      })) as Row[],
      onProgress
    );

    // Entities — remap entity_ref/asset_ref values inside jsonb data.
    onProgress?.('Importing entities…');
    const fieldsByType = new Map<string, FieldDefLite[]>();
    for (const t of bundle.entity_types ?? []) {
      fieldsByType.set(t.id, (t.fields as FieldDefLite[]) ?? []);
    }
    await chunkInsert(
      'ra_entities',
      (bundle.entities ?? []).map((e) => {
        const data = { ...((e.data as Record<string, unknown>) ?? {}) };
        for (const f of fieldsByType.get(e.entity_type_id as string) ?? []) {
          if (f.type === 'entity_ref' || f.type === 'asset_ref') {
            const v = data[f.key];
            if (typeof v === 'string') data[f.key] = remap(v);
            else if (Array.isArray(v))
              data[f.key] = v.map((x) => remap(x));
          }
        }
        return {
          ...e,
          id: remap(e.id),
          world_id: newWorldId,
          entity_type_id: remap(e.entity_type_id),
          data,
        };
      }) as Row[],
      onProgress
    );

    // Relationships — remap refs inside metadata properties too.
    onProgress?.('Importing relationships…');
    const schemaByRelType = new Map<string, FieldDefLite[]>();
    for (const t of bundle.relationship_types ?? []) {
      schemaByRelType.set(t.id, (t.metadata_schema as FieldDefLite[]) ?? []);
    }
    await chunkInsert(
      'ra_relationships',
      (bundle.relationships ?? []).map((r) => {
        const properties = {
          ...((r.properties as Record<string, unknown>) ?? {}),
        };
        for (const f of schemaByRelType.get(
          r.relationship_type_id as string
        ) ?? []) {
          if (f.type === 'entity_ref' || f.type === 'asset_ref') {
            const v = properties[f.key];
            if (typeof v === 'string') properties[f.key] = remap(v);
            else if (Array.isArray(v))
              properties[f.key] = v.map((x) => remap(x));
          }
        }
        return {
          ...r,
          id: remap(r.id),
          world_id: newWorldId,
          relationship_type_id: remap(r.relationship_type_id),
          source_id: remap(r.source_id),
          target_id: remap(r.target_id),
          properties,
        };
      }) as Row[],
      onProgress
    );

    // Assets keep their file_key/url — they point at the same R2 objects.
    onProgress?.('Importing assets…');
    await chunkInsert(
      'ra_assets',
      (bundle.assets ?? []).map((a) => ({
        ...a,
        id: remap(a.id),
        world_id: newWorldId,
      })) as Row[],
      onProgress
    );
    await chunkInsert(
      'ra_entity_assets',
      (bundle.entity_assets ?? []).map((r) => ({
        ...r,
        id: remap(r.id),
        world_id: newWorldId,
        entity_id: remap(r.entity_id),
        asset_id: remap(r.asset_id),
      })) as Row[],
      onProgress
    );

    // Campaigns and their objects.
    onProgress?.('Importing campaigns…');
    await chunkInsert(
      'ra_campaigns',
      (bundle.campaigns ?? []).map((c) => ({
        ...c,
        id: remap(c.id),
        world_id: newWorldId,
      })) as Row[],
      onProgress
    );
    await chunkInsert(
      'ra_sessions',
      (bundle.sessions ?? []).map((s) => ({
        ...s,
        id: remap(s.id),
        world_id: newWorldId,
        campaign_id: remap(s.campaign_id),
      })) as Row[],
      onProgress
    );
    await chunkInsert(
      'ra_session_entities',
      (bundle.session_entities ?? []).map((r) => ({
        ...r,
        id: remap(r.id),
        world_id: newWorldId,
        campaign_id: remap(r.campaign_id),
        session_id: remap(r.session_id),
        entity_id: remap(r.entity_id),
      })) as Row[],
      onProgress
    );
    await chunkInsert(
      'ra_quests',
      (bundle.quests ?? []).map((q) => ({
        ...q,
        id: remap(q.id),
        world_id: newWorldId,
        campaign_id: remap(q.campaign_id),
      })) as Row[],
      onProgress
    );
    await chunkInsert(
      'ra_quest_entities',
      (bundle.quest_entities ?? []).map((r) => ({
        ...r,
        id: remap(r.id),
        world_id: newWorldId,
        campaign_id: remap(r.campaign_id),
        quest_id: remap(r.quest_id),
        entity_id: remap(r.entity_id),
      })) as Row[],
      onProgress
    );

    // Timeline events.
    onProgress?.('Importing timeline…');
    await chunkInsert(
      'ra_events',
      (bundle.events ?? []).map((ev) => ({
        ...ev,
        id: remap(ev.id),
        world_id: newWorldId,
      })) as Row[],
      onProgress
    );
    await chunkInsert(
      'ra_event_entities',
      (bundle.event_entities ?? []).map((r) => ({
        ...r,
        id: remap(r.id),
        world_id: newWorldId,
        event_id: remap(r.event_id),
        entity_id: remap(r.entity_id),
      })) as Row[],
      onProgress
    );
  } catch (e) {
    // Clean up the partial import so a failed run leaves nothing behind.
    onProgress?.('Import failed — cleaning up…');
    await supabase.from('ra_worlds').delete().eq('id', newWorldId);
    throw e;
  }

  return slug;
}
