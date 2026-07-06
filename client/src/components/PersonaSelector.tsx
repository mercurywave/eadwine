import { Persona } from '../types'
import './PersonaSelector.css'

interface PersonaSelectorProps {
  personas: Persona[]
  defaultPersonaId?: string
  onSelect: (persona: Persona) => void
}

export function PersonaSelector({ personas, defaultPersonaId, onSelect }: PersonaSelectorProps) {
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
            className={`persona-card ${persona.id === defaultPersonaId ? 'persona-card-default' : ''}`}
            onClick={() => onSelect(persona)}
          >
            <div className="persona-card-header">
              <h4 className="persona-card-name">{persona.name}</h4>
              {persona.isDefault && <span className="persona-badge-default">Default</span>}
            </div>
            <p className="persona-card-description">{persona.description || 'No description'}</p>
            <button className="persona-card-button">Select</button>
          </div>
        ))}
      </div>
    </div>
  )
}
