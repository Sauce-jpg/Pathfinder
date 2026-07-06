'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from './rpgArchive.module.css';

type World = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ruleset: { system?: string; edition?: string };
  appearance: { accent?: string };
  status: string;
  created_at: string;
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function RpgArchivePage() {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [system, setSystem] = useState('');
  const [accent, setAccent] = useState('#c8900a');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadWorlds();
  }, []);

  async function loadWorlds() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('ra_worlds')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) {
      setError(error.message);
    } else {
      setWorlds((data as World[]) ?? []);
    }
    setLoading(false);
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function resetForm() {
    setName('');
    setSlug('');
    setSlugTouched(false);
    setDescription('');
    setSystem('');
    setAccent('#c8900a');
    setShowForm(false);
  }

  async function createWorld() {
    if (!name.trim() || !slug.trim()) {
      setError('Name and slug are required.');
      return;
    }
    setSaving(true);
    setError(null);
    const { error } = await supabase.from('ra_worlds').insert({
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      ruleset: system.trim() ? { system: system.trim() } : {},
      appearance: { accent },
    });
    setSaving(false);
    if (error) {
      setError(
        error.code === '23505'
          ? `The slug "${slug}" is already taken.`
          : error.message
      );
      return;
    }
    resetForm();
    loadWorlds();
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>The Hub</p>
          <h1 className={styles.title}>RPG Archive</h1>
          <p className={styles.subtitle}>
            Worlds, knowledge, and the campaigns that explore them.
          </p>
        </div>
        <button
          className={styles.primaryBtn}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? 'Cancel' : '+ New World'}
        </button>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      {showForm && (
        <section className={styles.formCard}>
          <h2 className={styles.formTitle}>Create a World</h2>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Shadow Slave"
                autoFocus
              />
            </label>
            <label className={styles.field}>
              <span>Slug</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
                placeholder="shadow-slave"
              />
            </label>
            <label className={styles.field}>
              <span>Game System (optional)</span>
              <input
                type="text"
                value={system}
                onChange={(e) => setSystem(e.target.value)}
                placeholder="Custom Homebrew"
              />
            </label>
            <label className={styles.field}>
              <span>Accent Color</span>
              <input
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className={styles.colorInput}
              />
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span>Description (optional)</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="A world of nightmares, aspects, and forgotten shores…"
              />
            </label>
          </div>
          <div className={styles.formActions}>
            <button
              className={styles.primaryBtn}
              onClick={createWorld}
              disabled={saving}
            >
              {saving ? 'Creating…' : 'Create World'}
            </button>
          </div>
        </section>
      )}

      {loading ? (
        <p className={styles.muted}>Loading worlds…</p>
      ) : worlds.length === 0 ? (
        <div className={styles.empty}>
          <p>No worlds yet.</p>
          <p className={styles.muted}>
            A World is a complete setting — its configuration, its archive of
            knowledge, and the campaigns played within it. Create your first
            one to get started.
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {worlds.map((w) => (
            <Link
              key={w.id}
              href={`/rpg-archive/${w.slug}`}
              className={styles.card}
              style={{ borderTopColor: w.appearance?.accent || '#c8900a' }}
            >
              <h2 className={styles.cardTitle}>{w.name}</h2>
              {w.ruleset?.system && (
                <span
                  className={styles.badge}
                  style={{ color: w.appearance?.accent || '#c8900a' }}
                >
                  {w.ruleset.system}
                </span>
              )}
              {w.description && (
                <p className={styles.cardDesc}>{w.description}</p>
              )}
              <span className={styles.cardMeta}>
                Created {new Date(w.created_at).toLocaleDateString('sv-SE')}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
