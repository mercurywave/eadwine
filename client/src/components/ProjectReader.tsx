import { useState, useEffect, useCallback } from 'react'
import { FileItem } from '../types'
import {
  fetchFiles,
  fetchFileContent,
  createFile,
  deleteFile,
  renameFile,
} from '../api'
import { FileSection } from './FileSection'
import { ConfirmDialog } from './ConfirmDialog'
import './ProjectReader.css'

interface ProjectReaderProps {
  projectId: string
  onEdit: (filename: string) => void
}

export function ProjectReader({ projectId, onEdit }: ProjectReaderProps) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [fileContents, setFileContents] = useState<Record<string, string>>({})
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [loadingAll, setLoadingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Modal states
  const [showNewFile, setShowNewFile] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<string | null>(null)
  const [renameFileFrom, setRenameFileFrom] = useState<string | null>(null)
  const [renameTo, setRenameTo] = useState('')

  const refreshFiles = useCallback(async () => {
    try {
      setLoadingFiles(true)
      const data = await fetchFiles(projectId)
      setFiles(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files')
    } finally {
      setLoadingFiles(false)
    }
  }, [projectId])

  useEffect(() => {
    refreshFiles()
  }, [refreshFiles])

  // Fetch content for all files
  useEffect(() => {
    if (files.length === 0) return

    const fetchAll = async () => {
      setLoadingAll(true)
      for (const file of files) {
        try {
          const content = await fetchFileContent(projectId, file.name)
          setFileContents(prev => ({ ...prev, [file.name]: content }))
        } catch {
          // Non-blocking: leave content as-is if fetch fails
        }
      }
      setLoadingAll(false)
    }
    fetchAll()
  }, [files, projectId])

  const handleNewFile = async () => {
    if (!newFileName.trim()) return
    try {
      const finalName = newFileName.trim().endsWith('.md')
        ? newFileName.trim()
        : `${newFileName.trim()}.md`
      await createFile(projectId, finalName)
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
      setFileContents(prev => {
        const next = { ...prev }
        delete next[confirmDeleteFile]
        return next
      })
      setConfirmDeleteFile(null)
      await refreshFiles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file')
    }
  }

  const handleRename = async () => {
    if (!renameFileFrom || !renameTo.trim()) return
    try {
      const finalName = renameTo.trim().endsWith('.md')
        ? renameTo.trim()
        : `${renameTo.trim()}.md`
      const result = await renameFile(projectId, renameFileFrom, finalName)
      // Move content to new name
      const contentToMove = fileContents[renameFileFrom]
      if (contentToMove !== undefined) {
        setFileContents(prev => {
          const next = { ...prev }
          delete next[renameFileFrom]
          next[result.name] = contentToMove
          return next
        })
      }
      setRenameFileFrom(null)
      setRenameTo('')
      await refreshFiles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename file')
    }
  }

  const handleEdit = (filename: string) => {
    // Prevent editing the summary file
    if (filename.toLowerCase() === 'summary.md') return
    onEdit(filename)
  }

  const handleDelete = (filename: string) => {
    setConfirmDeleteFile(filename)
  }

  const handleRenameClick = (filename: string) => {
    setRenameFileFrom(filename)
    setRenameTo(filename)
  }

  return (
    <div className="project-reader">
      <header className="page-header">
        <a href="/" className="back-link" aria-label="Back to projects">
          ← Projects
        </a>
        <button className="btn-primary" onClick={() => setShowNewFile(true)}>
          + New File
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {loadingFiles ? (
        <div className="loading">Loading files...</div>
      ) : files.length === 0 ? (
        <div className="empty-state">
          <p>No Markdown files yet. Create a new file to get started.</p>
        </div>
      ) : (
        <div className="reader-content">
          {files.map(file => (
            <FileSection
              key={file.name}
              file={file}
              content={fileContents[file.name] || null}
              loading={loadingAll && !fileContents[file.name]}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onRename={handleRenameClick}
            />
          ))}
        </div>
      )}

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
