import { Project } from '../types'
import styles from './ProjectCard.module.css'


interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {

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
    </div>
  )
}
