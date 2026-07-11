import { Persona } from '../types'
import { Check } from 'lucide-react'
import styles from './PersonaSelector.module.css'

interface PersonaSelectorProps {
  personas: Persona[]
  defaultPersonaId?: string
  selectedPersonaId?: string
  onSelect: (persona: Persona) => void
}

export function PersonaSelector({ personas, defaultPersonaId, selectedPersonaId, onSelect }: PersonaSelectorProps) {
  if (personas.length === 0) {
    return null
  }

  return (
    <div className={styles['persona-selector']}>
      <h3 className={styles['persona-selector-title']}>Choose a Persona</h3>
      <p className={styles['persona-selector-hint']}>
        Select how the AI assistant should respond. This can't be changed after your first message.
      </p>
      <div className={styles['persona-cards']}>
        {personas.map((persona) => (
          <div
            key={persona.id}
            className={`${styles['persona-card']} ${
              persona.id === defaultPersonaId ? styles['persona-card-default'] : ''
            } ${
              persona.id === selectedPersonaId ? styles['persona-card-selected'] : ''
            }`}
            onClick={() => onSelect(persona)}
          >
            <div className={styles['persona-card-header']}>
              <div className={styles['persona-card-header-left']}>
                <h4 className={styles['persona-card-name']}>{persona.name}</h4>
                {persona.isDefault && <span className={styles['persona-badge-default']}>Default</span>}
              </div>
            </div>
            <p className={styles['persona-card-description']}>{persona.description || 'No description'}</p>
            <div className={styles['persona-card-check']}>
              <Check className={styles['check-icon']} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
