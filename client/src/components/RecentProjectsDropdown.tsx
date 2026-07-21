import { useState, useEffect, useRef, useCallback } from 'react'
import { Project } from '../types'
import { fetchProjects } from '../api'
import { ProjectCard } from './ProjectCard'
import { ChevronDown } from 'lucide-react'
import styles from './RecentProjectsDropdown.module.css'

interface RecentProjectsDropdownProps {
  projectId: string
  currentTitle: string
}

export function RecentProjectsDropdown({ projectId, currentTitle }: RecentProjectsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)

  const fetchRecentProjects = useCallback(async () => {
    setLoading(true)
    try {
      const allProjects = await fetchProjects()
      const filtered = allProjects
        .filter(p => p.id !== projectId)
        .slice(0, 5)
      setProjects(filtered)
    } catch {
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [projectId])

  const toggle = useCallback(() => {
    setIsOpen(prev => {
      if (!prev) {
        fetchRecentProjects()
      }
      return !prev
    })
  }, [fetchRecentProjects])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  // Click outside to dismiss
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        close()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, close])

  // Escape key to dismiss
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, close])

  return (
    <div className={styles.dropdown} ref={dropdownRef}>
      <div
        className={styles.trigger}
        ref={triggerRef}
        onClick={toggle}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggle()
          }
        }}
        tabIndex={0}
        role="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Recent projects"
      >
        <span className={styles.title}>{currentTitle}</span>
        <ChevronDown
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
          size={16}
        />
      </div>

      {isOpen && (
        <div className={styles.panel}>
          {loading ? (
            <div className={styles.loading}>Loading...</div>
          ) : projects.length === 0 ? (
            <div className={styles.empty}>No other projects</div>
          ) : (
            <div className={styles.cardList}>
              {projects.map(project => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onDelete={() => {}}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {isOpen && <div className={styles.backdrop} onClick={close} />}
    </div>
  )
}
