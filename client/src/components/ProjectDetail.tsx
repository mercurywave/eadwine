import { useParams, useNavigate } from 'react-router-dom'
import { ProjectReader } from './ProjectReader'
import { ProjectEditor } from './ProjectEditor'

interface ProjectDetailProps {
  projectId: string
}

export function ProjectDetail({ projectId }: ProjectDetailProps) {
  const params = useParams()
  const navigate = useNavigate()
  const editFilename = params?.filename

  // If we have an edit filename in the URL, render the editor
  if (editFilename) {
    return <ProjectEditor projectId={projectId} />
  }

  // Otherwise render the reader view
  return (
    <ProjectReader
      projectId={projectId}
      onEdit={(filename) => navigate(`/project/${projectId}/edit/${encodeURIComponent(filename)}`)}
    />
  )
}
