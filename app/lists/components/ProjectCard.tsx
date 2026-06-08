'use client'

// app/lists/components/ProjectCard.tsx

import { SupabaseClient } from '@supabase/supabase-js'
import { Project } from '../types'
import styles from './ProjectCard.module.css'

type Props = {
  project: Project
  onEdit: () => void
  onRefresh: () => void
  supabase: SupabaseClient
}

const STATUS_LABEL: Record<string, string> = {
  active:    'Active',
  completed: 'Completed',
  archived:  'Archived',
}

export default function ProjectCard({ project, onEdit, onRefresh, supabase }: Props) {
  const handleArchive = async () => {
    const next = project.status === 'archived' ? 'active' : 'archived'
    await supabase.from('projects').update({ status: next }).eq('id', project.id)
    onRefresh()
  }

  const handleDelete = async () => {
    if (!confirm(`Delete project "${project.title}"? This will not delete linked notes or tasks.`)) return
    await supabase.from('projects').delete().eq('id', project.id)
    onRefresh()
  }

  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.meta}>
          <span className={`${styles.statusBadge} ${styles[project.status]}`}>
            {STATUS_LABEL[project.status]}
          </span>
        </div>
        <div className={styles.actions}>
          <button onClick={onEdit} aria-label="Edit project" className={styles.iconBtn}>
            <i className="ti ti-edit" aria-hidden="true" />
          </button>
          <button
            onClick={handleArchive}
            aria-label={project.status === 'archived' ? 'Unarchive project' : 'Archive project'}
            className={styles.iconBtn}
          >
            <i className={`ti ${project.status === 'archived' ? 'ti-archive-off' : 'ti-archive'}`} aria-hidden="true" />
          </button>
          <button onClick={handleDelete} aria-label="Delete project" className={styles.iconBtn}>
            <i className="ti ti-trash" aria-hidden="true" />
          </button>
        </div>
      </div>

      <h3 className={styles.title}>{project.title}</h3>

      {project.description && (
        <p className={styles.description}>{project.description}</p>
      )}

      <div className={styles.counts}>
        {project._note_count !== undefined && (
          <span className={styles.count}>
            <i className="ti ti-notes" aria-hidden="true" />
            {project._note_count} note{project._note_count !== 1 ? 's' : ''}
          </span>
        )}
        {project._todo_count !== undefined && (
          <span className={styles.count}>
            <i className="ti ti-checkbox" aria-hidden="true" />
            {project._todo_count} task{project._todo_count !== 1 ? 's' : ''}
          </span>
        )}
        {project._purchase_count !== undefined && (
          <span className={styles.count}>
            <i className="ti ti-shopping-cart" aria-hidden="true" />
            {project._purchase_count} purchase{project._purchase_count !== 1 ? 's' : ''}
          </span>
        )}
        {project._links && project._links.length > 0 && (
          <span className={styles.count}>
            <i className="ti ti-link" aria-hidden="true" />
            {project._links.length} link{project._links.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <time className={styles.date} dateTime={project.created_at}>
        Created {new Date(project.created_at).toLocaleDateString('sv-SE')}
      </time>
    </article>
  )
}
