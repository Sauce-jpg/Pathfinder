'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from './reveals.module.css';

type World = {
  id: string;
  name: string;
  slug: string;
  appearance: { accent?: string };
};

type EntityRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  entity_type_id: string;
};

type FieldDefLite = { key: string; label: string };

type EntityType = {
  id: string;
  display_name: string;
  icon: string | null;
  sort_order: number;
  fields: FieldDefLite[];
};

type Group = { id: string; name: string };
type Member = { user_id: string; role: string };
type UserName = { id: string; display_name: string };

type RevealRow = {
  id: string;
  target_id: string;
  field_key: string | null;
  subject_type: string;
  subject_id: string | null;
};

type TemplateItem = {
  target_type: string;
  target_id: string;
  field_key?: string | null;
};

type Template = {
  id: string;
  name: string;
  description: string | null;
  items: TemplateItem[];
};

/** entityId -> 'full' or a set of field keys ('__doc' = documentation). */
type Selection = Map<string, 'full' | Set<string>>;

type GrantItem = { target_id: string; field_key: string | null };

export default function RevealsPage() {
  const params = useParams<{ world: string }>();
  const worldSlug = params.world;

  const [world, setWorld] = useState<World | null>(null);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [types, setTypes] = useState<EntityType[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [players, setPlayers] = useState<string[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [reveals, setReveals] = useState<RevealRow[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [subject, setSubject] = useState('');
  const [note, setNote] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Selection>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [templateName, setTemplateName] = useState('');
  const [working, setWorking] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: w, error: wErr } = await supabase
      .from('ra_worlds')
      .select('id, name, slug, appearance')
      .eq('slug', worldSlug)
      .single();

    if (wErr || !w) {
      setError(wErr?.message ?? 'World not found.');
      setLoading(false);
      return;
    }
    setWorld(w as World);

    const [entsRes, typesRes, groupsRes, membersRes, revealsRes, tmplRes] =
      await Promise.all([
        supabase
          .from('ra_entities')
          .select('id, name, slug, status, entity_type_id')
          .eq('world_id', w.id)
          .neq('status', 'deleted')
          .order('name', { ascending: true }),
        supabase
          .from('ra_entity_types')
          .select('id, display_name, icon, sort_order, fields')
          .eq('world_id', w.id)
          .order('sort_order', { ascending: true }),
        supabase
          .from('ra_player_groups')
          .select('id, name')
          .eq('world_id', w.id)
          .order('name', { ascending: true }),
        supabase
          .from('ra_world_members')
          .select('user_id, role')
          .eq('world_id', w.id)
          .eq('status', 'accepted')
          .in('role', ['player', 'viewer']),
        supabase
          .from('ra_reveals')
          .select('id, target_id, field_key, subject_type, subject_id')
          .eq('world_id', w.id)
          .eq('target_type', 'entity'),
        supabase
          .from('ra_reveal_templates')
          .select('id, name, description, items')
          .eq('world_id', w.id)
          .order('name', { ascending: true }),
      ]);

    if (!entsRes.error) setEntities((entsRes.data as EntityRow[]) ?? []);
    if (!typesRes.error) setTypes((typesRes.data as EntityType[]) ?? []);
    if (!groupsRes.error) setGroups((groupsRes.data as Group[]) ?? []);
    if (!revealsRes.error)
      setReveals((revealsRes.data as RevealRow[]) ?? []);
    if (!tmplRes.error) setTemplates((tmplRes.data as Template[]) ?? []);

    const playerIds = ((membersRes.data as Member[]) ?? []).map(
      (m) => m.user_id
    );
    setPlayers(playerIds);
    if (playerIds.length > 0) {
      const { data: nameRows } = await supabase.rpc('hub_user_names', {
        p_ids: playerIds,
      });
      setNames(
        new Map(
          ((nameRows as UserName[]) ?? []).map((n) => [n.id, n.display_name])
        )
      );
    }
    setLoading(false);
  }, [worldSlug]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const accent = world?.appearance?.accent || '#c8900a';
  const typeById = new Map(types.map((t) => [t.id, t]));

  // ----- subject helpers -----

  function parseSubject():
    | { subject_type: string; subject_id: string | null }
    | null {
    if (!subject) return null;
    if (subject === 'all')
      return { subject_type: 'all_players', subject_id: null };
    if (subject.startsWith('group:'))
      return { subject_type: 'group', subject_id: subject.slice(6) };
    if (subject.startsWith('user:'))
      return { subject_type: 'user', subject_id: subject.slice(5) };
    return null;
  }

  const parsed = parseSubject();
  const subjectReveals = parsed
    ? reveals.filter(
        (r) =>
          r.subject_type === parsed.subject_type &&
          (r.subject_id ?? null) === parsed.subject_id
      )
    : [];
  const revealedKeys = new Set(
    subjectReveals.map((r) => `${r.target_id}:${r.field_key ?? ''}`)
  );
  const fullRevealed = new Set(
    subjectReveals.filter((r) => r.field_key === null).map((r) => r.target_id)
  );
  const partialRevealed = new Set(
    subjectReveals.filter((r) => r.field_key !== null).map((r) => r.target_id)
  );

  // ----- selection model -----

  function rowState(id: string): 'none' | 'full' | 'partial' {
    const entry = selected.get(id);
    if (!entry) return 'none';
    return entry === 'full' ? 'full' : 'partial';
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.get(id) === 'full') next.delete(id);
      else next.set(id, 'full');
      return next;
    });
  }

  function toggleField(id: string, key: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      const entry = next.get(id);
      if (entry === 'full') return prev;
      const set = new Set(entry ?? []);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      if (set.size === 0) next.delete(id);
      else next.set(id, set);
      return next;
    });
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectionToItems(sel: Selection): GrantItem[] {
    const items: GrantItem[] = [];
    for (const [id, entry] of sel) {
      if (entry === 'full') items.push({ target_id: id, field_key: null });
      else
        for (const key of entry)
          items.push({ target_id: id, field_key: key });
    }
    return items;
  }

  function selectAllVisible() {
    setSelected((prev) => {
      const next = new Map(prev);
      visible.forEach((e) => next.set(e.id, 'full'));
      return next;
    });
  }

  // ----- filters -----

  const visible = entities.filter((e) => {
    if (typeFilter && e.entity_type_id !== typeFilter) return false;
    if (search && !e.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  // ----- bulk actions -----

  async function grantItems(items: GrantItem[]) {
    const sub = parseSubject();
    if (!world || !sub || items.length === 0) {
      setError('Pick a subject and at least one entity or section.');
      return;
    }
    setWorking(true);
    setError(null);
    setInfo(null);

    const missing = items.filter(
      (i) => !revealedKeys.has(`${i.target_id}:${i.field_key ?? ''}`)
    );
    if (missing.length === 0) {
      setInfo('Everything selected is already revealed to that subject.');
      setWorking(false);
      return;
    }

    const rows = missing.map((i) => ({
      world_id: world.id,
      target_type: 'entity',
      target_id: i.target_id,
      field_key: i.field_key,
      subject_type: sub.subject_type,
      subject_id: sub.subject_id,
      note: note.trim() || null,
    }));

    const { error } = await supabase.from('ra_reveals').insert(rows);
    setWorking(false);
    if (error) {
      setError(error.message);
      return;
    }
    setInfo(
      `Granted ${missing.length} reveal${missing.length === 1 ? '' : 's'} (${
        items.length - missing.length
      } already existed).`
    );
    setNote('');
    loadAll();
  }

  async function revokeSelected() {
    const sub = parseSubject();
    if (!world || !sub || selected.size === 0) {
      setError('Pick a subject and at least one entity or section.');
      return;
    }
    setWorking(true);
    setError(null);
    setInfo(null);

    const ids: string[] = [];
    for (const [entityId, entry] of selected) {
      for (const r of subjectReveals) {
        if (r.target_id !== entityId) continue;
        // Full selection = clean slate: full + all field grants go.
        if (entry === 'full') ids.push(r.id);
        else if (r.field_key !== null && entry.has(r.field_key))
          ids.push(r.id);
      }
    }

    if (ids.length === 0) {
      setInfo('Nothing selected is revealed to that subject.');
      setWorking(false);
      return;
    }

    const { error } = await supabase
      .from('ra_reveals')
      .delete()
      .in('id', ids);
    setWorking(false);
    if (error) {
      setError(error.message);
      return;
    }
    setInfo(`Revoked ${ids.length} reveal${ids.length === 1 ? '' : 's'}.`);
    loadAll();
  }

  // ----- templates -----

  async function saveTemplate() {
    if (!world || !templateName.trim() || selected.size === 0) {
      setError('Name the template and select at least one entity or section.');
      return;
    }
    setWorking(true);
    setError(null);
    const items = selectionToItems(selected).map((i) => ({
      target_type: 'entity',
      target_id: i.target_id,
      field_key: i.field_key,
    }));
    const { error } = await supabase.from('ra_reveal_templates').insert({
      world_id: world.id,
      name: templateName.trim(),
      items,
    });
    setWorking(false);
    if (error) {
      setError(error.message);
      return;
    }
    setInfo(
      `Template "${templateName.trim()}" saved (${items.length} items).`
    );
    setTemplateName('');
    loadAll();
  }

  async function applyTemplate(t: Template) {
    const items: GrantItem[] = (t.items ?? [])
      .filter((i) => i.target_type === 'entity')
      .map((i) => ({
        target_id: i.target_id,
        field_key: i.field_key ?? null,
      }));
    await grantItems(items);
  }

  function loadTemplateSelection(t: Template) {
    const next: Selection = new Map();
    for (const i of t.items ?? []) {
      if (i.target_type !== 'entity') continue;
      if (!i.field_key) {
        next.set(i.target_id, 'full');
      } else if (next.get(i.target_id) !== 'full') {
        const set = new Set(
          (next.get(i.target_id) as Set<string>) ?? []
        );
        set.add(i.field_key);
        next.set(i.target_id, set);
      }
    }
    setSelected(next);
    setExpanded(
      new Set(
        Array.from(next.entries())
          .filter(([, v]) => v !== 'full')
          .map(([k]) => k)
      )
    );
    setInfo(`Loaded selection from "${t.name}".`);
  }

  async function deleteTemplate(t: Template) {
    const ok = window.confirm(`Delete the template "${t.name}"?`);
    if (!ok) return;
    const { error } = await supabase
      .from('ra_reveal_templates')
      .delete()
      .eq('id', t.id);
    if (error) setError(error.message);
    else loadAll();
  }

  function templateSummary(t: Template): string {
    const items = t.items ?? [];
    const full = items.filter((i) => !i.field_key).length;
    const partial = items.length - full;
    const parts: string[] = [];
    if (full > 0) parts.push(`${full} full`);
    if (partial > 0) parts.push(`${partial} sections`);
    return parts.join(' · ') || 'empty';
  }

  if (loading) {
    return (
      <div className={styles.wrap}>
        <p className={styles.muted}>Loading…</p>
      </div>
    );
  }

  if (!world) {
    return (
      <div className={styles.wrap}>
        <div className={styles.error}>{error ?? 'World not found.'}</div>
        <Link href="/rpg-archive" className={styles.backLink}>
          ← All Worlds
        </Link>
      </div>
    );
  }

  const selectedCount = selected.size;

  return (
    <div className={styles.wrap} style={{ ['--ra-accent' as string]: accent }}>
      <Link href={`/rpg-archive/${worldSlug}`} className={styles.backLink}>
        ← {world.name}
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>Reveals</h1>
        <p className={styles.subtitle}>
          Bulk-manage what players can see. Expand a row (▸) to reveal only
          individual sections of an entity.
        </p>
      </header>

      {error && <div className={styles.error}>{error}</div>}
      {info && <p className={styles.info}>{info}</p>}

      <div className={styles.actionBar}>
        <select value={subject} onChange={(e) => setSubject(e.target.value)}>
          <option value="">— subject —</option>
          <option value="all">All Players</option>
          {groups.map((g) => (
            <option key={g.id} value={`group:${g.id}`}>
              Group: {g.name}
            </option>
          ))}
          {players.map((id) => (
            <option key={id} value={`user:${id}`}>
              {names.get(id) ?? 'Player'}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
        />
        <button
          className={styles.primaryBtn}
          onClick={() => grantItems(selectionToItems(selected))}
          disabled={working || !subject || selectedCount === 0}
        >
          Reveal Selected ({selectedCount})
        </button>
        <button
          className={styles.dangerBtn}
          onClick={revokeSelected}
          disabled={working || !subject || selectedCount === 0}
        >
          Revoke Selected
        </button>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.pillRow}>
          <button
            className={`${styles.pill} ${
              typeFilter === null ? styles.pillActive : ''
            }`}
            onClick={() => setTypeFilter(null)}
          >
            All ({entities.length})
          </button>
          {types.map((t) => {
            const count = entities.filter(
              (e) => e.entity_type_id === t.id
            ).length;
            if (count === 0) return null;
            return (
              <button
                key={t.id}
                className={`${styles.pill} ${
                  typeFilter === t.id ? styles.pillActive : ''
                }`}
                onClick={() =>
                  setTypeFilter(typeFilter === t.id ? null : t.id)
                }
              >
                {t.icon ? `${t.icon} ` : ''}
                {t.display_name} ({count})
              </button>
            );
          })}
        </div>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Filter by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className={styles.smallBtn} onClick={selectAllVisible}>
          Select all shown
        </button>
        <button
          className={styles.smallBtn}
          onClick={() => setSelected(new Map())}
        >
          Clear
        </button>
      </div>

      <div className={styles.rowsCard}>
        {visible.length === 0 ? (
          <p className={styles.mutedPad}>No entities match the filter.</p>
        ) : (
          visible.map((e) => {
            const t = typeById.get(e.entity_type_id);
            const state = rowState(e.id);
            const entry = selected.get(e.id);
            const partialSet =
              entry && entry !== 'full' ? entry : new Set<string>();
            const isExpanded = expanded.has(e.id);
            const sections: FieldDefLite[] = [
              { key: '__doc', label: 'Documentation' },
              ...(t?.fields ?? []),
            ];
            return (
              <div key={e.id} className={styles.rowBlock}>
                <div className={styles.row}>
                  <input
                    type="checkbox"
                    checked={state === 'full'}
                    ref={(el) => {
                      if (el) el.indeterminate = state === 'partial';
                    }}
                    onChange={() => toggleRow(e.id)}
                  />
                  <button
                    className={styles.expandBtn}
                    onClick={() => toggleExpand(e.id)}
                    title="Pick individual sections"
                  >
                    {isExpanded ? '▾' : '▸'}
                  </button>
                  <span className={styles.rowIcon}>{t?.icon || '◆'}</span>
                  <Link
                    href={`/rpg-archive/${worldSlug}/archive/${e.slug}`}
                    className={styles.rowName}
                  >
                    {e.name}
                  </Link>
                  <span className={styles.rowType}>
                    {t?.display_name ?? 'Entity'}
                  </span>
                  {state === 'partial' && (
                    <span className={styles.partialTag}>
                      {partialSet.size} section
                      {partialSet.size === 1 ? '' : 's'} picked
                    </span>
                  )}
                  {e.status !== 'published' && (
                    <span className={styles.draftTag}>
                      {e.status} — invisible to players
                    </span>
                  )}
                  {subject && fullRevealed.has(e.id) && (
                    <span className={styles.revealedTag}>revealed</span>
                  )}
                  {subject &&
                    !fullRevealed.has(e.id) &&
                    partialRevealed.has(e.id) && (
                      <span className={styles.partialRevealedTag}>
                        partially revealed
                      </span>
                    )}
                </div>
                {isExpanded && (
                  <div className={styles.subPanel}>
                    {state === 'full' && (
                      <p className={styles.subHint}>
                        Entire entity selected — uncheck the row to pick
                        individual sections.
                      </p>
                    )}
                    {sections.map((s) => (
                      <label key={s.key} className={styles.subItem}>
                        <input
                          type="checkbox"
                          checked={
                            state === 'full' || partialSet.has(s.key)
                          }
                          disabled={state === 'full'}
                          onChange={() => toggleField(e.id, s.key)}
                        />
                        <span>{s.label}</span>
                        {subject &&
                          revealedKeys.has(`${e.id}:${s.key}`) && (
                            <span className={styles.subRevealed}>
                              ✓ revealed
                            </span>
                          )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <section className={styles.templates}>
        <h2 className={styles.sectionTitle}>Reveal Templates</h2>
        <p className={styles.mutedSmall}>
          Save the current selection — full entities and individual sections
          alike — as a named set, then apply it to any subject in one click.
        </p>
        <div className={styles.templateCreate}>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Basic knowledge, Act 1, Fire Keepers lore…"
          />
          <button
            className={styles.secondaryBtn}
            onClick={saveTemplate}
            disabled={working || !templateName.trim() || selectedCount === 0}
          >
            Save Selection as Template ({selectedCount})
          </button>
        </div>
        {templates.map((t) => (
          <div key={t.id} className={styles.templateRow}>
            <span className={styles.templateName}>{t.name}</span>
            <span className={styles.templateMeta}>{templateSummary(t)}</span>
            <div className={styles.templateBtns}>
              <button
                className={styles.primaryBtn}
                onClick={() => applyTemplate(t)}
                disabled={working || !subject}
                title={
                  subject
                    ? 'Grant all items to the subject'
                    : 'Pick a subject first'
                }
              >
                Apply
              </button>
              <button
                className={styles.smallBtn}
                onClick={() => loadTemplateSelection(t)}
              >
                Load selection
              </button>
              <button
                className={styles.smallBtn}
                onClick={() => deleteTemplate(t)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
