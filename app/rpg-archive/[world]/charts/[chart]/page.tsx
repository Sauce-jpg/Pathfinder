'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from '../charts.module.css';

type World = {
  id: string;
  name: string;
  slug: string;
  appearance: { accent?: string };
};

type Column = { id: string; label: string; group?: string };
type Cell = { text?: string; entityId?: string };

type Chart = {
  id: string;
  name: string;
  description: string | null;
  columns: Column[];
  rows: Cell[][];
};

type EntityOption = {
  id: string;
  name: string;
  slug: string;
  entity_type_id: string;
};

type EntityType = { id: string; display_name: string; sort_order: number };

export default function ChartDetailPage() {
  const params = useParams<{ world: string; chart: string }>();
  const { world: worldSlug, chart: chartId } = params;
  const router = useRouter();

  const [world, setWorld] = useState<World | null>(null);
  const [chart, setChart] = useState<Chart | null>(null);
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [types, setTypes] = useState<EntityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [columns, setColumns] = useState<Column[]>([]);
  const [rows, setRows] = useState<Cell[][]>([]);
  const [saving, setSaving] = useState(false);

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

    const [chartRes, entsRes, typesRes] = await Promise.all([
      supabase
        .from('ra_charts')
        .select('id, name, description, columns, rows')
        .eq('id', chartId)
        .single(),
      supabase
        .from('ra_entities')
        .select('id, name, slug, entity_type_id')
        .eq('world_id', w.id)
        .neq('status', 'deleted')
        .order('name', { ascending: true }),
      supabase
        .from('ra_entity_types')
        .select('id, display_name, sort_order')
        .eq('world_id', w.id)
        .order('sort_order', { ascending: true }),
    ]);

    if (chartRes.error || !chartRes.data) {
      setError(chartRes.error?.message ?? 'Chart not found.');
      setLoading(false);
      return;
    }
    const c = chartRes.data as Chart;
    setChart(c);
    setName(c.name);
    setDescription(c.description ?? '');
    setColumns(c.columns ?? []);
    setRows(c.rows ?? []);

    if (!entsRes.error) setEntities((entsRes.data as EntityOption[]) ?? []);
    if (!typesRes.error) setTypes((typesRes.data as EntityType[]) ?? []);
    setLoading(false);
  }, [worldSlug, chartId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const accent = world?.appearance?.accent || '#c8900a';
  const entityById = new Map(entities.map((e) => [e.id, e]));

  async function save() {
    if (!chart || !name.trim()) {
      setError('Chart name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from('ra_charts')
      .update({
        name: name.trim(),
        description: description.trim() || null,
        columns,
        rows,
        updated_at: new Date().toISOString(),
      })
      .eq('id', chart.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEditing(false);
    loadAll();
  }

  async function deleteChart() {
    if (!chart) return;
    const ok = window.confirm(
      `Delete the chart "${chart.name}"? This cannot be undone.`
    );
    if (!ok) return;
    const { error } = await supabase
      .from('ra_charts')
      .delete()
      .eq('id', chart.id);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(`/rpg-archive/${worldSlug}/charts`);
  }

  // ----- column & row operations (rows stay aligned with columns) -----

  function addColumn() {
    setColumns((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: `Column ${prev.length + 1}` },
    ]);
    setRows((prev) => prev.map((r) => [...r, { text: '' }]));
  }

  function updateColumn(i: number, patch: Partial<Column>) {
    setColumns((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c))
    );
  }

  function deleteColumn(i: number) {
    setColumns((prev) => prev.filter((_, idx) => idx !== i));
    setRows((prev) => prev.map((r) => r.filter((_, idx) => idx !== i)));
  }

  function moveColumn(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= columns.length) return;
    setColumns((prev) => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setRows((prev) =>
      prev.map((r) => {
        const next = [...r];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      })
    );
  }

  function addRow() {
    setRows((prev) => [...prev, columns.map(() => ({ text: '' }))]);
  }

  function deleteRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function moveRow(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    setRows((prev) => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function setCell(r: number, c: number, cell: Cell) {
    setRows((prev) =>
      prev.map((row, ri) =>
        ri === r ? row.map((cl, ci) => (ci === c ? cell : cl)) : row
      )
    );
  }

  // ----- header group computation (adjacent equal groups merge) -----

  function groupSpans(): { label: string; span: number }[] {
    const spans: { label: string; span: number }[] = [];
    for (const col of columns) {
      const g = col.group?.trim() || '';
      const last = spans[spans.length - 1];
      if (last && last.label === g) last.span += 1;
      else spans.push({ label: g, span: 1 });
    }
    return spans;
  }

  const hasGroups = columns.some((c) => (c.group ?? '').trim() !== '');

  if (loading) {
    return (
      <div className={styles.wrap}>
        <p className={styles.muted}>Loading chart…</p>
      </div>
    );
  }

  if (!world || !chart) {
    return (
      <div className={styles.wrap}>
        <div className={styles.error}>{error ?? 'Chart not found.'}</div>
        <Link
          href={`/rpg-archive/${worldSlug}/charts`}
          className={styles.backLink}
        >
          ← Charts
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.wrap} style={{ ['--ra-accent' as string]: accent }}>
      <Link
        href={`/rpg-archive/${worldSlug}/charts`}
        className={styles.backLink}
      >
        ← Charts
      </Link>

      <header className={styles.header}>
        <div>
          {editing ? (
            <>
              <input
                className={styles.nameInput}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className={styles.descInput}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
              />
            </>
          ) : (
            <>
              <h1 className={styles.title}>{chart.name}</h1>
              {chart.description && (
                <p className={styles.subtitle}>{chart.description}</p>
              )}
            </>
          )}
        </div>
        <div className={styles.headerBtns}>
          {editing ? (
            <>
              <button
                className={styles.secondaryBtn}
                onClick={() => {
                  setEditing(false);
                  setName(chart.name);
                  setDescription(chart.description ?? '');
                  setColumns(chart.columns ?? []);
                  setRows(chart.rows ?? []);
                }}
              >
                Cancel
              </button>
              <button
                className={styles.primaryBtn}
                onClick={save}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Chart'}
              </button>
            </>
          ) : (
            <>
              <button className={styles.dangerBtn} onClick={deleteChart}>
                Delete
              </button>
              <button
                className={styles.primaryBtn}
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
            </>
          )}
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      {!editing ? (
        <div className={styles.tableScroll}>
          <table className={styles.chartTable}>
            <thead>
              {hasGroups && (
                <tr>
                  {groupSpans().map((g, i) => (
                    <th
                      key={i}
                      colSpan={g.span}
                      className={styles.groupHeader}
                    >
                      {g.label}
                    </th>
                  ))}
                </tr>
              )}
              <tr>
                {columns.map((c) => (
                  <th key={c.id} className={styles.colHeader}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => {
                    const ent = cell.entityId
                      ? entityById.get(cell.entityId)
                      : undefined;
                    return (
                      <td key={ci} className={styles.cell}>
                        {cell.entityId ? (
                          ent ? (
                            <Link
                              href={`/rpg-archive/${worldSlug}/archive/${ent.slug}`}
                              className={styles.cellLink}
                            >
                              {ent.name}
                            </Link>
                          ) : (
                            <span className={styles.missing}>
                              missing entity
                            </span>
                          )
                        ) : (
                          cell.text
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className={styles.editHint}>
            Each cell is text or an entity link — use the ⛓ / T toggle.
            Column groups with the same name merge into a spanning header.
          </div>
          <div className={styles.tableScroll}>
            <table className={styles.editTable}>
              <thead>
                <tr>
                  <th className={styles.rowTools} />
                  {columns.map((c, i) => (
                    <th key={c.id} className={styles.colEditor}>
                      <input
                        className={styles.colGroupInput}
                        value={c.group ?? ''}
                        onChange={(e) =>
                          updateColumn(i, { group: e.target.value })
                        }
                        placeholder="Group (optional)"
                      />
                      <input
                        className={styles.colLabelInput}
                        value={c.label}
                        onChange={(e) =>
                          updateColumn(i, { label: e.target.value })
                        }
                        placeholder="Column label"
                      />
                      <div className={styles.colBtns}>
                        <button onClick={() => moveColumn(i, -1)} title="Move left">
                          ←
                        </button>
                        <button onClick={() => moveColumn(i, 1)} title="Move right">
                          →
                        </button>
                        <button
                          onClick={() => deleteColumn(i)}
                          title="Delete column"
                        >
                          ✕
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri}>
                    <td className={styles.rowTools}>
                      <button onClick={() => moveRow(ri, -1)} title="Move up">
                        ↑
                      </button>
                      <button onClick={() => moveRow(ri, 1)} title="Move down">
                        ↓
                      </button>
                      <button onClick={() => deleteRow(ri)} title="Delete row">
                        ✕
                      </button>
                    </td>
                    {row.map((cell, ci) => {
                      const isEntity = cell.entityId !== undefined;
                      return (
                        <td key={ci} className={styles.cellEditor}>
                          <div className={styles.cellControl}>
                            <button
                              className={styles.cellToggle}
                              title={
                                isEntity
                                  ? 'Switch to text'
                                  : 'Switch to entity link'
                              }
                              onClick={() =>
                                setCell(
                                  ri,
                                  ci,
                                  isEntity ? { text: '' } : { entityId: '' }
                                )
                              }
                            >
                              {isEntity ? '⛓' : 'T'}
                            </button>
                            {isEntity ? (
                              <select
                                value={cell.entityId}
                                onChange={(e) =>
                                  setCell(ri, ci, {
                                    entityId: e.target.value,
                                  })
                                }
                              >
                                <option value="">— pick entity —</option>
                                {types.map((t) => {
                                  const opts = entities.filter(
                                    (en) => en.entity_type_id === t.id
                                  );
                                  if (opts.length === 0) return null;
                                  return (
                                    <optgroup
                                      key={t.id}
                                      label={t.display_name}
                                    >
                                      {opts.map((en) => (
                                        <option key={en.id} value={en.id}>
                                          {en.name}
                                        </option>
                                      ))}
                                    </optgroup>
                                  );
                                })}
                              </select>
                            ) : (
                              <input
                                value={cell.text ?? ''}
                                onChange={(e) =>
                                  setCell(ri, ci, { text: e.target.value })
                                }
                                placeholder="Text…"
                              />
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.gridBtns}>
            <button className={styles.secondaryBtn} onClick={addRow}>
              + Row
            </button>
            <button className={styles.secondaryBtn} onClick={addColumn}>
              + Column
            </button>
          </div>
        </>
      )}
    </div>
  );
}
