import { useState, useRef, useEffect } from 'react'
import { Sparkles, X } from 'lucide-react'
import { Macro } from '../types'
import './MacroPicker.css'

interface MacroPickerProps {
  macros: Macro[]
  onSelect: (prompt: string) => void
}

export function MacroPicker({ macros, onSelect }: MacroPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (prompt: string) => {
    onSelect(prompt)
    setIsOpen(false)
  }

  if (macros.length === 0) {
    return null
  }

  return (
    <div className="macro-picker" ref={pickerRef}>
      <button
        className="macro-picker-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Select a macro"
        aria-label="Select a macro"
      >
        <Sparkles className="btn-icon" />
      </button>

      {isOpen && (
        <div className="macro-picker-dropdown">
          <div className="macro-picker-header">
            <h3>Macros</h3>
            <button
              className="macro-picker-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close macros"
            >
              <X className="btn-icon-small" />
            </button>
          </div>
          <div className="macro-picker-list">
            {macros.map((macro) => (
              <button
                key={macro.id}
                className="macro-picker-item"
                onClick={() => handleSelect(macro.prompt)}
                title={macro.prompt}
              >
                <div className="macro-picker-item-name">{macro.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
