import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { saveFileContent } from '../api'
import './ProjectEditor.css'

interface ProjectEditorProps {
  projectId: string
}

export function ProjectEditor({ projectId }: ProjectEditorProps) {
  const params = useParams()
  const navigate = useNavigate()
  const filename = params?.filename || ''
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadContent = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/files/${encodeURIComponent(filename)}`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `HTTP ${res.status}`)
        }
        const data = await res.json()
        setContent(data.content || '')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load file')
      } finally {
        setLoading(false)
      }
    }
    if (filename) {
      loadContent()
    }
  }, [projectId, filename])

  const handleSave = async () => {
    if (!filename) return
    try {
      setSaving(true)
      setError(null)
      await saveFileContent(projectId, filename, content)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file')
    } finally {
      setSaving(false)
    }
  }

  const handleBack = () => {
    navigate(`/project/${projectId}`)
  }

  return (
    <div className="project-editor">
      <header className="page-header">
        <button className="back-link" onClick={handleBack} aria-label="Back to project">
          ← Back to project
        </button>
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={saving || !filename}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loading">Loading editor...</div>
      ) : (
        <div className="editor-layout">
          <div className="editor-filename">{filename}</div>
          <textarea
            className="markdown-editor"
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Write your Markdown here..."
            spellCheck={false}
            aria-label="Markdown content"
          />
        </div>
      )}
    </div>
  )
}
