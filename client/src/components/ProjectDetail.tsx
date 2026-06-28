import { useState, useEffect, useCallback } from 'react'
import { FileItem } from '../types'
import {
  fetchFiles,
  fetchFileContent,
  saveFileContent,
  createFile,
  deleteFile,
  renameFile,
} from '../api'
import { ConfirmDialog } from './ConfirmDialog'

interface ProjectDetailProps {
  projectId: string
}

export function ProjectDetail({ projectId }: ProjectDetailProps) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projectTitle, setProjectTitle] = useState('Untitled Project')

  // Modal states
  const [showNewFile, setShowNewFile] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<string | null>(null)
  const [renameFileFrom, setRenameFileFrom] = useState<string | null>(null)
  const [renameTo, setRenameTo] = useState('')

  const refreshFiles = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchFiles(projectId)
      setFiles(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    const loadProjectInfo = async () => {
      try {
        const titleContent = await fetchFileContent(projectId, 'SUMMARY.md')
        const lines = titleContent.split('\n').filter(l => l.trim())
        if (lines.length > 0) {
          setProjectTitle(lines[0].replace(/^#\s+/, ''))
        }
      } catch {
        setProjectTitle('Untitled Project')
      }
    }
    loadProjectInfo()
    refreshFiles()
  }, [refreshFiles, projectId])

  const handleSelectFile = async (filename: string) => {
    try {
      const content = await fetchFileContent(projectId, filename)
      setSelectedFile(filename)
      setContent(content)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file')
    }
  }

  const handleSave = async () => {
    if (!selectedFile) return
    try {
      setSaving(true)
      await saveFileContent(projectId, selectedFile, content)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file')
    } finally {
      setSaving(false)
    }
  }

  const handleNewFile = async () => {
    if (!newFileName.trim()) return
    try {
      await createFile(projectId, newFileName.trim())
      setNewFileName('')
      setShowNewFile(false)
      await refreshFiles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create file')
    }
  }

  const handleDeleteFile = async () => {
    if (!confirmDeleteFile) return
    try {
      await deleteFile(projectId, confirmDeleteFile)
      if (selectedFile === confirmDeleteFile) {
        setSelectedFile(null)
        setContent('')
      }
      setConfirmDeleteFile(null)
      await refreshFiles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file')
    }
  }

  const handleRename = async () => {
    if (!renameFileFrom || !renameTo.trim()) return
    try {
      const result = await renameFile(projectId, renameFileFrom, renameTo.trim())
      if (selectedFile === renameFileFrom) {
        setSelectedFile(result.name)
      }
      setRenameFileFrom(null)
      setRenameTo('')
      await refreshFiles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename file')
    }
  }

  return (
    <div className="project-detail">
      <header className="page-header">
        <a href="/" className="back-link" aria-label="Back to projects">
          ← Projects
        </a>
        <button className="btn-primary" onClick={() => setShowNewFile(true)}>
          + New File
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="detail-layout">
        {/* File list sidebar */}
        <aside className="file-list-panel">
          <h2>Files</h2>
          {loading ? (
            <div className="loading">Loading files...</div>
          ) : files.length === 0 ? (
            <p className="empty-state">No files yet. Create a new file to get started.</p>
          ) : (
            <ul className="file-list" role="list">
              {files.map(file => (
                <li
                  key={file.name}
                  className={`file-list-item ${selectedFile === file.name ? 'active' : ''}`}
                >
                  <button
                    className="file-list-name"
                    onClick={() => handleSelectFile(file.name)}
                    aria-label={`Edit ${file.name}`}
                  >
                    {file.name}
                  </button>
                  <div className="file-list-actions">
                    <button
                      className="file-action-btn"
                      onClick={() => {
                        setRenameFileFrom(file.name)
                        setRenameTo(file.name)
                      }}
                      aria-label={`Rename ${file.name}`}
                      title="Rename"
                    >
                      ✏️
                    </button>
                    <button
                      className="file-action-btn"
                      onClick={() => setConfirmDeleteFile(file.name)}
                      aria-label={`Delete ${file.name}`}
                      title="Delete"
                    >
                      🗑
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Editor panel */}
        <main className="editor-panel">
          {selectedFile ? (
            <>
              <div className="editor-header">
                <h2>{selectedFile}</h2>
                <button
                  className="btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
              <textarea
                className="markdown-editor"
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Write your Markdown here..."
                spellCheck={false}
              />
            </>
          ) : (
            <div className="editor-placeholder">
              <p>Select a file to edit</p>
            </div>
          )}
        </main>
      </div>

      {/* New File Modal */}
      {showNewFile && (
        <div className="modal-backdrop" onClick={() => setShowNewFile(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>New File</h2>
            <input
              className="modal-input"
              type="text"
              placeholder="filename.md"
              value={newFileName}
              onChange={e => setNewFileName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleNewFile()
                if (e.key === 'Escape') setShowNewFile(false)
              }}
              autoFocus
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowNewFile(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleNewFile}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {confirmDeleteFile && (
        <ConfirmDialog
          title="Delete File"
          message={`Are you sure you want to delete "${confirmDeleteFile}"?`}
          onConfirm={handleDeleteFile}
          onCancel={() => setConfirmDeleteFile(null)}
        />
      )}

      {/* Rename Modal */}
      {renameFileFrom && (
        <div className="modal-backdrop" onClick={() => setRenameFileFrom(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Rename File</h2>
            <input
              className="modal-input"
              type="text"
              value={renameTo}
              onChange={e => setRenameTo(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleRename()
                if (e.key === 'Escape') setRenameFileFrom(null)
              }}
              autoFocus
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setRenameFileFrom(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleRename}>Rename</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
