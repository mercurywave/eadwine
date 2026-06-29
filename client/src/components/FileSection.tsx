import { FileItem } from '../types'
import { MarkdownRenderer } from './MarkdownRenderer'
import './FileSection.css'

interface FileSectionProps {
  file: FileItem
  content: string | null
  loading: boolean
  onEdit: (filename: string) => void
  onDelete: (filename: string) => void
  onRename: (filename: string) => void
}

export function FileSection({
  file,
  content,
  loading,
  onEdit,
  onDelete,
  onRename,
}: FileSectionProps) {
  const displayName = file.name.replace(/\.md$/, '')
  return (
    <section className="file-section" aria-label={`File: ${displayName}`}>
      <div className="file-section-header">
        <h2 className="file-section-title">{displayName}</h2>
        <div className="file-section-actions">
          <button
            className="btn-secondary"
            onClick={() => onEdit(file.name)}
            aria-label={`Edit ${displayName}`}
            title="Edit file"
          >
            ✏️ Edit
          </button>
          {!file.isSummary && (
            <>
              <button
                className="btn-secondary"
                onClick={() => onRename(file.name)}
                aria-label={`Rename ${displayName}`}
                title="Rename file"
              >
                📝 Rename
              </button>
              <button
                className="btn-secondary"
                onClick={() => onDelete(file.name)}
                aria-label={`Delete ${displayName}`}
                title="Delete file"
              >
                🗑
              </button>
            </>
          )}
        </div>
      </div>

      <div className="file-section-body">
        {loading ? (
          <div className="loading">Loading content...</div>
        ) : content ? (
          <MarkdownRenderer content={content} filename={displayName} />
        ) : (
          <div className="empty-state">No content to display.</div>
        )}
      </div>
    </section>
  )
}
