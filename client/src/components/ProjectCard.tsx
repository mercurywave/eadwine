import { Project } from '../types'
import { Trash2 } from 'lucide-react'
import styles from './ProjectCard.module.css'


interface ProjectCardProps {
  project: Project
  onDelete: (id: string) => void
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(project.id)
  }

  return (
    <div
      className={styles['project-card']}
      role="button"
      tabIndex={0}
      aria-label={`Open project ${project.title}`}
      onClick={() => window.location.href = `/project/${project.id}`}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          window.location.href = `/project/${project.id}`
        }
      }}
    >
      <div className={styles['project-card-content']}>
        <div className={styles['project-card-tags']}>
          {project.tags.map(tag => (
            <span key={tag} className={styles['tag-pill']}>{tag}</span>
          ))}
        </div>
        <h3 className={styles['project-card-title']}>{project.title || 'Untitled Project'}</h3>
        <p className={styles['project-card-summary']}>{project.summary || 'No summary'}</p>
      </div>
      <button
        className={styles['project-card-delete']}
        onClick={handleDelete}
        aria-label={`Delete project ${project.title}`}
        title="Delete project"
      >
        <Trash2 className={styles['project-card-delete-icon']} />
      </button>
    </div>
  )
}
