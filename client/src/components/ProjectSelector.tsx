import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Project } from '../types'
import { ProjectCard } from './ProjectCard'
import { ConfirmDialog } from './ConfirmDialog'
import styles from './ProjectSelector.module.css'


interface ProjectSelectorProps {
  projects: Project[]
  onCreateProject: () => void
  onDeleteProject: (id: string) => void
  loading: boolean
  error: string | null
}

export function ProjectSelector({
  projects,
  onCreateProject,
  onDeleteProject,
  loading,
  error,
}: ProjectSelectorProps) {
  const navigate = useNavigate()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const handleOpenSettings = () => {
    navigate('/settings')
  }

  const handleConfirmDelete = () => {
    if (confirmDeleteId) {
      onDeleteProject(confirmDeleteId)
      setConfirmDeleteId(null)
    }
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
              onDelete={(id) => setConfirmDeleteId(id)}
            />
          ))}
        </div>
      )}

      {confirmDeleteId && (
        <ConfirmDialog
          title="Delete Project"
          message="Are you sure you want to delete this project? This action cannot be undone."
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}
