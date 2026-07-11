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

type EntityType = {
  id: string;
  display_name: string;
  icon: string | null;
  sort_order: number;
};

type Group = { id: string; name: string };
type Member = { user_id: string; role: string };
type UserName = { id: string; display_name: string };

type RevealRow = {
  id: string;
  target_id: string;
  subject_type: string;
  subject_id: string | null;
};

type Template = {
  id: string;
  name: string;
  description: string | null;
  items: { target_type: string; target_id: string; field_key?: string }[];
};

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
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
          .select('id, display_name, icon, sort_order')
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
          .select('id, target_id, subject_type, subject_id')
          .eq('world_id', w.id)
          .eq('target_type', 'entity')
          .is('field_key', null),
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

  function parseSubject(): { subject_type: string; subject_id: string | null } | null {
    if (!subject) return null;
    if (subject === 'all') return { subject_type: 'all_players', subject_id: null };
    if (subject.startsWith('group:'))
      return { subject_type: 'group', subject_id: subject.slice(6) };
    if (subject.startsWith('user:'))
      return { subject_type: 'user', subject_id: subject.slice(5) };
    return null;
  }

  const parsed = parseSubject();
  const revealedForSubject = new Set(
    parsed
      ? reveals
          .filter(
            (r) =>
              r.subject_type === parsed.subject_type &&
              (r.subject_id ?? null) === parsed.subject_id
          )
          .map((r) => r.target_id)
      : []
  );

  // ----- filters & selection -----

  const visible = entities.filter((e) => {
    if (typeFilter && e.entity_type_id !== typeFilter) return false;
    if (search && !e.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      visible.forEach((e) => next.add(e.id));
      return next;
    });
  }

  // ----- bulk actions -----

  async function revealSelected(ids?: string[]) {
    const targets = ids ?? Array.from(selected);
    const sub = parseSubject();
    if (!world || !sub || targets.length === 0) {
      setError('Pick a subject and at least one entity.');
      return;
    }
    setWorking(true);
    setError(null);
    setInfo(null);

    const missing = targets.filter((id) => !revealedForSubject.has(id));
    if (missing.length === 0) {
      setInfo('Everything selected is already revealed to that subject.');
      setWorking(false);
      return;
    }

    const rows = missing.map((id) => ({
      world_id: world.id,
      target_type: 'entity',
      target_id: id,
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
      `Revealed ${missing.length} ${
        missing.length === 1 ? 'entity' : 'entities'
      } (${targets.length - missing.length} already revealed).`
    );
    setNote('');
    loadAll();
  }

  async function revokeSelected() {
    const sub = parseSubject();
    if (!world || !sub || selected.size === 0) {
      setError('Pick a subject and at least one entity.');
      return;
    }
    setWorking(true);
    setError(null);
    setInfo(null);

    const ids = reveals
      .filter(
        (r) =>
          selected.has(r.target_id) &&
          r.subject_type === sub.subject_type &&
          (r.subject_id ?? null) === sub.subject_id
      )
      .map((r) => r.id);

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
      setError('Name the template and select at least one entity.');
      return;
    }
    setWorking(true);
    setError(null);
    const items = Array.from(selected).map((id) => ({
      target_type: 'entity',
      target_id: id,
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
    setInfo(`Template "${templateName.trim()}" saved (${items.length} items).`);
    setTemplateName('');
    loadAll();
  }

  async function applyTemplate(t: Template) {
    const ids = (t.items ?? [])
      .filter((i) => i.target_type === 'entity' && !i.field_key)
      .map((i) => i.target_id);
    await revealSelected(ids);
  }

  function loadTemplateSelection(t: Template) {
    setSelected(
      new Set(
        (t.items ?? [])
          .filter((i) => i.target_type === 'entity')
          .map((i) => i.target_id)
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

  return (
    <div className={styles.wrap} style={{ ['--ra-accent' as string]: accent }}>
      <Link href={`/rpg-archive/${worldSlug}`} className={styles.backLink}>
        ← {world.name}
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>Reveals</h1>
        <p className={styles.subtitle}>
          Bulk-manage what players can see — and save selections as templates
          for onboarding new players.
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
          onClick={() => revealSelected()}
          disabled={working || !subject || selected.size === 0}
        >
          Reveal Selected ({selected.size})
        </button>
        <button
          className={styles.dangerBtn}
          onClick={revokeSelected}
          disabled={working || !subject || selected.size === 0}
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
          onClick={() => setSelected(new Set())}
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
            const isRevealed = revealedForSubject.has(e.id);
            return (
              <label key={e.id} className={styles.row}>
                <input
                  type="checkbox"
                  checked={selected.has(e.id)}
                  onChange={() => toggle(e.id)}
                />
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
                {e.status !== 'published' && (
                  <span className={styles.draftTag}>
                    {e.status} — invisible to players
                  </span>
                )}
                {subject && isRevealed && (
                  <span className={styles.revealedTag}>revealed</span>
                )}
              </label>
            );
          })
        )}
      </div>

      <section className={styles.templates}>
        <h2 className={styles.sectionTitle}>Reveal Templates</h2>
        <p className={styles.mutedSmall}>
          Save the current selection as a named set — then apply it to any
          player, group, or everyone in one click.
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
            disabled={working || !templateName.trim() || selected.size === 0}
          >
            Save Selection as Template ({selected.size})
          </button>
        </div>
        {templates.map((t) => (
          <div key={t.id} className={styles.templateRow}>
            <span className={styles.templateName}>{t.name}</span>
            <span className={styles.templateMeta}>
              {(t.items ?? []).length} items
            </span>
            <div className={styles.templateBtns}>
              <button
                className={styles.primaryBtn}
                onClick={() => applyTemplate(t)}
                disabled={working || !subject}
                title={subject ? 'Reveal all items to the subject' : 'Pick a subject first'}
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
