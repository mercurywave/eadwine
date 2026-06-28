import { Project } from '../types'

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
      className="project-card"
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
      <div className="project-card-content">
        <h3 className="project-card-title">{project.title || 'Untitled Project'}</h3>
        <p className="project-card-summary">{project.summary || 'No summary'}</p>
      </div>
      <button
        className="project-card-delete"
        onClick={handleDelete}
        aria-label={`Delete project ${project.title}`}
        title="Delete project"
      >
        🗑
      </button>
    </div>
  )
}
