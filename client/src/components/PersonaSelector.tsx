import { Persona } from '../types'
import { Check } from 'lucide-react'
import './PersonaSelector.css'

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
    <div className="persona-selector">
      <h3 className="persona-selector-title">Choose a Persona</h3>
      <p className="persona-selector-hint">
        Select how the AI assistant should respond. This can't be changed after your first message.
      </p>
      <div className="persona-cards">
        {personas.map((persona) => (
          <div
            key={persona.id}
            className={`persona-card ${
              persona.id === defaultPersonaId ? 'persona-card-default' : ''
            } ${
              persona.id === selectedPersonaId ? 'persona-card-selected' : ''
            }`}
            onClick={() => onSelect(persona)}
          >
            <div className="persona-card-header">
              <div className="persona-card-header-left">
                <h4 className="persona-card-name">{persona.name}</h4>
                {persona.isDefault && <span className="persona-badge-default">Default</span>}
              </div>
            </div>
            <p className="persona-card-description">{persona.description || 'No description'}</p>
            <div className="persona-card-check">
              <Check className="check-icon" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
