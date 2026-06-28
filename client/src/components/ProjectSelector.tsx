import { useState } from 'react'
import { Project } from '../types'
import { ProjectCard } from './ProjectCard'
import { ConfirmDialog } from './ConfirmDialog'

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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const handleConfirmDelete = () => {
    if (confirmDeleteId) {
      onDeleteProject(confirmDeleteId)
      setConfirmDeleteId(null)
    }
  }

  return (
    <div className="project-selector">
      <header className="page-header">
        <h1>Projects</h1>
        <button className="btn-primary" onClick={onCreateProject}>
          + New Project
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loading">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <p>No projects yet. Create your first project to get started.</p>
        </div>
      ) : (
        <div className="project-grid">
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
