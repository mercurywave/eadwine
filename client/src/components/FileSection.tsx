import { useState } from 'react'
import { FileItem } from '../types'
import { MarkdownRenderer } from './MarkdownRenderer'
import { Pencil, FilePenLine, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import './FileSection.css'

interface FileSectionProps {
  file: FileItem
  content: string | null
  loading: boolean
  onEdit: (filename: string) => void
  onDelete: (filename: string) => void
  onRename: (filename: string) => void
  collapsed?: boolean
}

export function FileSection({
  file,
  content,
  loading,
  onEdit,
  onDelete,
  onRename,
  collapsed: initiallyCollapsed = false,
}: FileSectionProps) {
  const displayName = file.name.replace(/\.md$/, '')
  const [collapsed, setCollapsed] = useState(initiallyCollapsed)

  const isReserved = file.isSummary || file.isMemory

  return (
    <section className={`file-section${collapsed ? ' collapsed' : ''}`} aria-label={`File: ${displayName}`}>
      <div className="file-section-header">
        {!isReserved && (
          <button
            className="file-section-toggle"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? `Expand ${displayName}` : `Collapse ${displayName}`}
            title={collapsed ? 'Expand file' : 'Collapse file'}
          >
            {collapsed ? <ChevronRight className="btn-icon" /> : <ChevronDown className="btn-icon" />}
          </button>
        )}
        <h2 className="file-section-title">{displayName}</h2>
        <div className="file-section-actions">
          <button
            className="btn-secondary"
            onClick={() => onEdit(file.name)}
            aria-label={`Edit ${displayName}`}
            title="Edit file"
          >
            <Pencil className="btn-icon" />
            Edit
          </button>
          {!isReserved && (
            <>
              <button
                className="btn-secondary"
                onClick={() => onRename(file.name)}
                aria-label={`Rename ${displayName}`}
                title="Rename file"
              >
                <FilePenLine className="btn-icon" />
                Rename
              </button>
              <button
                className="btn-secondary"
                onClick={() => onDelete(file.name)}
                aria-label={`Delete ${displayName}`}
                title="Delete file"
              >
                <Trash2 className="btn-icon" />
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
