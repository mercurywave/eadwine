import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { ProjectSelector } from './components/ProjectSelector'
import { ProjectDetail } from './components/ProjectDetail'
import { ToastProvider, ToastContainer, useToasts } from './components/Toast'
import { Project } from './types'
import { fetchProjects, createProject, deleteProject } from './api'

function ProjectSelectorPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToasts()

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchProjects()
      setProjects(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const handleCreateProject = async () => {
    try {
      setError(null)
      const newProject = await createProject()
      setProjects(prev => [...prev, newProject])
      window.location.href = `/project/${newProject.id}`
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create project'
      setError(message)
      addToast(message, 'error')
    }
  }

  const handleDeleteProject = async (id: string) => {
    try {
      setError(null)
      await deleteProject(id)
      setProjects(prev => prev.filter(p => p.id !== id))
      addToast('Project deleted', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete project'
      setError(message)
      addToast(message, 'error')
    }
  }

  return (
    <ProjectSelector
      projects={projects}
      onCreateProject={handleCreateProject}
      onDeleteProject={handleDeleteProject}
      loading={loading}
      error={error}
    />
  )
}

function ProjectDetailRoute() {
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : undefined
  if (!id) return <Navigate to="/" replace />
  return <ProjectDetail projectId={id} />
}

function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<ProjectSelectorPage />} />
        <Route path="/project/:id" element={<ProjectDetailRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </ToastProvider>
  )
}

export default App
