import { useState, useRef, useCallback, useEffect } from 'react'
import styles from './Splitter.module.css'

interface SplitterProps {
  orientation: 'vertical'
  onResize: (rightWidth: number) => void
  minLeftWidth?: number
  minRightWidth?: number
  initialRightWidth: number
}

export function Splitter({
  orientation,
  onResize,
  minLeftWidth = 300,
  minRightWidth = 250,
  initialRightWidth,
}: SplitterProps) {
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const rightWidthRef = useRef(initialRightWidth)

  // Keep ref in sync with prop changes
  useEffect(() => {
    rightWidthRef.current = initialRightWidth
  }, [initialRightWidth])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleTouchStart = useCallback(() => {
    setIsDragging(true)
  }, [])

  const handleMove = useCallback(
    (clientX: number) => {
      if (!isDragging || !containerRef.current) return

      // Get the parent flex container, not the splitter itself
      const parent = containerRef.current.parentElement
      if (!parent) return

      const rect = parent.getBoundingClientRect()
      const leftPanelWidth = clientX - rect.left

      // Calculate right panel width
      const containerTotalWidth = rect.width
      const newRightWidth = containerTotalWidth - leftPanelWidth - 6 // 6px is splitter width

      // Clamp to min/max constraints
      const clampedRightWidth = Math.max(
        minRightWidth,
        Math.min(containerTotalWidth - minLeftWidth - 6, newRightWidth)
      )

      rightWidthRef.current = clampedRightWidth
      onResize(clampedRightWidth)
    },
    [isDragging, minLeftWidth, minRightWidth, onResize]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      handleMove(e.clientX)
    },
    [handleMove]
  )

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX)
      }
    },
    [handleMove]
  )

  const handleEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Attach document-level listeners when dragging starts
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleEnd)
      document.addEventListener('touchmove', handleTouchMove)
      document.addEventListener('touchend', handleEnd)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleEnd)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleEnd)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, handleMouseMove, handleTouchMove, handleEnd])

  return (
    <div
      ref={containerRef}
      className={`${styles['splitter']} ${styles[`splitter-${orientation}`]} ${isDragging ? styles['splitter-dragging'] : ''}`}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      role="separator"
      aria-orientation="vertical"
      tabIndex={0}
    />
  )
}
