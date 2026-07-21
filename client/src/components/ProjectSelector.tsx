import { useNavigate } from 'react-router-dom'
import { Project } from '../types'
import { ProjectCard } from './ProjectCard'
import styles from './ProjectSelector.module.css'


interface ProjectSelectorProps {
  projects: Project[]
  onCreateProject: () => void
  loading: boolean
  error: string | null
}

export function ProjectSelector({
  projects,
  onCreateProject,
  loading,
  error,
}: ProjectSelectorProps) {
  const navigate = useNavigate()

  const handleOpenSettings = () => {
    navigate('/settings')
  }

  return (
    <div className={styles['project-selector']}>
      <header className={styles['page-header']}>
        <h1>Projects</h1>
        <div className={styles['page-header-actions']}>
          <button className="btn-secondary" onClick={handleOpenSettings}>
            Settings
          </button>
          <button className="btn-primary" onClick={onCreateProject}>
            + New Project
          </button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loading">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className={styles['empty-state']}>
          <p>No projects yet. Create your first project to get started.</p>
        </div>
      ) : (
        <div className={styles['project-grid']}>
          {projects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
            />
          ))}
        </div>
      )}

    </div>
  )
}
