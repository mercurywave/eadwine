import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Edit2, Check, X } from 'lucide-react'
import { fetchSettings, saveSettings, fetchModels, createPersona, updatePersona, deletePersona, setDefaultPersona, resetDefaultPersona } from '../api'
import { Settings, Persona } from '../types'
import { useToasts } from './Toast'
import './SettingsPage.css'

const DEFAULT_SETTINGS: Settings = {
  openAiEndpoint: '',
  selectedModel: '',
  defaultModel: '',
}

const sections = [
  {
    id: 'ai',
    label: 'AI Services',
    description: 'Configure third-party AI provider endpoints',
  },
  {
    id: 'structure',
    label: 'Project Structure',
    description: 'Define guidelines for good folder/file/project structure',
  },
  {
    id: 'personas',
    label: 'Personas',
    description: 'Define chat assistant personas and their behavior',
  },
]

interface PersonaForm {
  name: string
  description: string
  systemPrompt: string
}

export function SettingsPage() {
  const navigate = useNavigate()
  const { addToast } = useToasts()
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState(sections[0].id)
  const [models, setModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)

  // Persona state
  const [personas, setPersonas] = useState<Persona[]>([])
  const [editingPersona, setEditingPersona] = useState<string | null>(null)
  const [personaForm, setPersonaForm] = useState<PersonaForm>({
    name: '',
    description: '',
    systemPrompt: '',
  })
  const [showAddForm, setShowAddForm] = useState(false)
  const [loadingPersonas, setLoadingPersonas] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const data = await fetchSettings()
      setSettings({
        openAiEndpoint: data.openAiEndpoint ?? '',
        selectedModel: data.selectedModel ?? '',
        defaultModel: data.defaultModel ?? '',
        personas: data.personas ?? [],
        defaultPersonaId: data.defaultPersonaId,
        structureGuidelines: data.structureGuidelines ?? '',
      })
      setPersonas(data.personas || [])
    } catch {
      // Silently use defaults — settings file may not exist yet
    } finally {
      setLoading(false)
    }
  }

  const loadModels = async () => {
    if (!settings.openAiEndpoint) {
      setModels([])
      return
    }
    try {
      setLoadingModels(true)
      const modelList = await fetchModels()
      setModels(modelList)
    } catch {
      // Silently handle — model list may not be available
      setModels([])
    } finally {
      setLoadingModels(false)
    }
  }

  // Reload models when endpoint changes
  useEffect(() => {
    loadModels()
  }, [settings.openAiEndpoint])

  const handleSave = async () => {
    if (!settings.selectedModel) {
      addToast('Please select a model before saving', 'error')
      return
    }
    try {
      setSaving(true)
      await saveSettings({
        openAiEndpoint: settings.openAiEndpoint,
        selectedModel: settings.selectedModel,
        defaultModel: settings.defaultModel,
        personas: personas,
        defaultPersonaId: settings.defaultPersonaId,
        structureGuidelines: settings.structureGuidelines,
      })
      addToast('Settings saved', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save settings'
      addToast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenAiEndpointChange = (value: string) => {
    setSettings(prev => ({ ...prev, openAiEndpoint: value }))
  }

  const handleSelectedModelChange = (value: string) => {
    setSettings(prev => ({ ...prev, selectedModel: value }))
  }

  const handleStructureGuidelinesChange = (value: string) => {
    setSettings(prev => ({ ...prev, structureGuidelines: value }))
  }

  // Persona handlers
  const handleAddPersona = async () => {
    if (!personaForm.name || !personaForm.systemPrompt) {
      addToast('Name and system prompt are required', 'error')
      return
    }
    try {
      setLoadingPersonas(true)
      const newPersona = await createPersona(personaForm)
      setPersonas(prev => [...prev, newPersona])
      setPersonaForm({ name: '', description: '', systemPrompt: '' })
      setShowAddForm(false)
      addToast('Persona created', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create persona'
      addToast(message, 'error')
    } finally {
      setLoadingPersonas(false)
    }
  }

  const handleEditPersona = (persona: Persona) => {
    setEditingPersona(persona.id)
    setPersonaForm({
      name: persona.name,
      description: persona.description || '',
      systemPrompt: persona.systemPrompt,
    })
  }

  const handleUpdatePersona = async () => {
    if (!editingPersona || !personaForm.name || !personaForm.systemPrompt) {
      addToast('Name and system prompt are required', 'error')
      return
    }
    try {
      setLoadingPersonas(true)
      const updated = await updatePersona(editingPersona, personaForm)
      setPersonas(prev => prev.map(p => p.id === editingPersona ? updated : p))
      setEditingPersona(null)
      addToast('Persona updated', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update persona'
      addToast(message, 'error')
    } finally {
      setLoadingPersonas(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingPersona(null)
    setPersonaForm({ name: '', description: '', systemPrompt: '' })
  }

  const handleDeletePersona = async (id: string) => {
    if (!confirm('Are you sure you want to delete this persona?')) return
    try {
      setLoadingPersonas(true)
      await deletePersona(id)
      setPersonas(prev => prev.filter(p => p.id !== id))
      if (settings.defaultPersonaId === id) {
        setSettings(prev => ({ ...prev, defaultPersonaId: undefined }))
      }
      addToast('Persona deleted', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete persona'
      addToast(message, 'error')
    } finally {
      setLoadingPersonas(false)
    }
  }

  const handleSetDefault = async (id: string) => {
    try {
      setLoadingPersonas(true)
      // If there was a previous default, reset it
      if (settings.defaultPersonaId && settings.defaultPersonaId !== id) {
        await resetDefaultPersona(settings.defaultPersonaId)
      }
      await setDefaultPersona(id)
      setSettings(prev => ({ ...prev, defaultPersonaId: id }))
      addToast('Default persona set', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set default persona'
      addToast(message, 'error')
    } finally {
      setLoadingPersonas(false)
    }
  }

  const handleCancelAdd = () => {
    setShowAddForm(false)
    setPersonaForm({ name: '', description: '', systemPrompt: '' })
  }

  if (loading) {
    return (
      <div className="settings-page">
        <div className="loading">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="settings-page">
      <header className="page-header">
        <button className="btn-secondary back-btn" onClick={() => navigate('/')}>
          <ArrowLeft className="btn-icon" />
          Back to Projects
        </button>
        <h1>Settings</h1>
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </header>

      <div className="settings-layout">
        {/* Sidebar */}
        <nav className="settings-sidebar">
          <ul>
            {sections.map(section => (
              <li key={section.id}>
                <button
                  className={`sidebar-link ${activeSection === section.id ? 'active' : ''}`}
                  onClick={() => setActiveSection(section.id)}
                >
                  {section.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Main content */}
        <main className="settings-content">
          {sections.map(section => (
            <section
              key={section.id}
              className={`settings-section ${activeSection === section.id ? 'visible' : 'hidden'}`}
            >
              <h2>{section.label}</h2>
              <p className="section-description">{section.description}</p>

              {section.id === 'ai' && (
                <>
                  <div className="setting-field">
                    <label htmlFor="openAiEndpoint">OpenAI API Endpoint</label>
                    <input
                      id="openAiEndpoint"
                      type="text"
                      className="modal-input"
                      placeholder="https://api.openai.com/v1"
                      value={settings.openAiEndpoint}
                      onChange={e => handleOpenAiEndpointChange(e.target.value)}
                    />
                    <span className="field-hint">
                      Enter the base URL for your OpenAI-compatible API endpoint.
                    </span>
                  </div>

                  <div className="setting-field">
                    <label htmlFor="selectedModel">Model</label>
                    {loadingModels ? (
                      <div className="loading">Loading models...</div>
                    ) : (
                      <select
                        id="selectedModel"
                        className="modal-input"
                        value={settings.selectedModel}
                        onChange={e => handleSelectedModelChange(e.target.value)}
                      >
                        <option value="">-- Select a model --</option>
                        {models.map(model => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                    )}
                    <span className="field-hint">
                      Select the AI model to use for chat. This is required to use the chat feature.
                    </span>
                  </div>
                </>
              )}

              {section.id === 'structure' && (
                <>
                  <div className="setting-field">
                    <label htmlFor="structureGuidelines">Structure Guidelines</label>
                    <textarea
                      id="structureGuidelines"
                      className="modal-input persona-textarea"
                      placeholder="Describe your preferred folder/file/project structure. For example: 'Use kebab-case for folder names. Keep files under 500 words.'"
                      value={settings.structureGuidelines || ''}
                      onChange={e => handleStructureGuidelinesChange(e.target.value)}
                      rows={8}
                    />
                    <span className="field-hint">
                      This text will be added to the system prompt to guide the AI in maintaining your preferred project structure. Leave blank to use the default guidelines.
                    </span>
                  </div>
                </>
              )}

              {section.id === 'personas' && (
                <>
                  <div className="personas-header">
                    <button
                      className="btn-secondary"
                      onClick={() => setShowAddForm(true)}
                      disabled={loadingPersonas}
                    >
                      <Plus className="btn-icon" />
                      Add Persona
                    </button>
                  </div>

                  {/* Add Persona Form */}
                  {showAddForm && (
                    <div className="persona-form">
                      <h3>New Persona</h3>
                      <div className="setting-field">
                        <label htmlFor="persona-name">Name</label>
                        <input
                          id="persona-name"
                          type="text"
                          className="modal-input"
                          placeholder="e.g., Code Expert"
                          value={personaForm.name}
                          onChange={e => setPersonaForm(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div className="setting-field">
                        <label htmlFor="persona-description">Description</label>
                        <input
                          id="persona-description"
                          type="text"
                          className="modal-input"
                          placeholder="Brief description of this persona"
                          value={personaForm.description}
                          onChange={e => setPersonaForm(prev => ({ ...prev, description: e.target.value }))}
                        />
                      </div>
                      <div className="setting-field">
                        <label htmlFor="persona-system-prompt">System Prompt</label>
                        <textarea
                          id="persona-system-prompt"
                          className="modal-input persona-textarea"
                          placeholder="Describe how the AI assistant should respond..."
                          value={personaForm.systemPrompt}
                          onChange={e => setPersonaForm(prev => ({ ...prev, systemPrompt: e.target.value }))}
                          rows={6}
                        />
                        <span className="field-hint">
                          This text will be inserted into the system prompt when this persona is selected.
                        </span>
                      </div>
                      <div className="persona-form-actions">
                        <button
                          className="btn-primary"
                          onClick={handleAddPersona}
                          disabled={loadingPersonas || !personaForm.name || !personaForm.systemPrompt}
                        >
                          <Check className="btn-icon" />
                          Create
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={handleCancelAdd}
                        >
                          <X className="btn-icon" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Persona List */}
                  <div className="persona-list">
                    {personas.length === 0 && !showAddForm && (
                      <p className="persona-empty">No personas defined yet. Click "Add Persona" to create one.</p>
                    )}
                    {personas.map(persona => (
                      <div
                        key={persona.id}
                        className={`persona-item ${persona.id === settings.defaultPersonaId ? 'persona-item-default' : ''}`}
                      >
                        {editingPersona === persona.id ? (
                          // Edit mode
                          <div className="persona-edit-form">
                            <div className="setting-field">
                              <label htmlFor={`edit-persona-name-${persona.id}`}>Name</label>
                              <input
                                id={`edit-persona-name-${persona.id}`}
                                type="text"
                                className="modal-input"
                                value={personaForm.name}
                                onChange={e => setPersonaForm(prev => ({ ...prev, name: e.target.value }))}
                              />
                            </div>
                            <div className="setting-field">
                              <label htmlFor={`edit-persona-description-${persona.id}`}>Description</label>
                              <input
                                id={`edit-persona-description-${persona.id}`}
                                type="text"
                                className="modal-input"
                                value={personaForm.description}
                                onChange={e => setPersonaForm(prev => ({ ...prev, description: e.target.value }))}
                              />
                            </div>
                            <div className="setting-field">
                              <label htmlFor={`edit-persona-system-prompt-${persona.id}`}>System Prompt</label>
                              <textarea
                                id={`edit-persona-system-prompt-${persona.id}`}
                                className="modal-input persona-textarea"
                                value={personaForm.systemPrompt}
                                onChange={e => setPersonaForm(prev => ({ ...prev, systemPrompt: e.target.value }))}
                                rows={4}
                              />
                            </div>
                            <div className="persona-form-actions">
                              <button
                                className="btn-primary"
                                onClick={handleUpdatePersona}
                                disabled={loadingPersonas || !personaForm.name || !personaForm.systemPrompt}
                              >
                                <Check className="btn-icon" />
                                Save
                              </button>
                              <button
                                className="btn-secondary"
                                onClick={handleCancelEdit}
                              >
                                <X className="btn-icon" />
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          // View mode
                          <div className="persona-item-content">
                            <div className="persona-item-header">
                              <div>
                                <h4 className="persona-item-name">{persona.name}</h4>
                                {persona.description && <p className="persona-item-desc">{persona.description}</p>}
                              </div>
                              {persona.id === settings.defaultPersonaId && (
                                <span className="persona-badge-default">Default</span>
                              )}
                            </div>
                            <div className="persona-item-actions">
                              {persona.id !== settings.defaultPersonaId && (
                                <button
                                  className="btn-icon-btn"
                                  onClick={() => handleSetDefault(persona.id)}
                                  title="Set as default"
                                  disabled={loadingPersonas}
                                >
                                  ★
                                </button>
                              )}
                              {persona.id === settings.defaultPersonaId && (
                                <button
                                  className="btn-icon-btn"
                                  onClick={() => handleSetDefault(persona.id)}
                                  title="Reset default"
                                  disabled={loadingPersonas}
                                >
                                  ★
                                </button>
                              )}
                              <button
                                className="btn-icon-btn"
                                onClick={() => handleEditPersona(persona)}
                                title="Edit"
                                disabled={loadingPersonas}
                              >
                                <Edit2 className="btn-icon-small" />
                              </button>
                              <button
                                className="btn-icon-btn btn-danger"
                                onClick={() => handleDeletePersona(persona.id)}
                                title="Delete"
                                disabled={loadingPersonas}
                              >
                                <Trash2 className="btn-icon-small" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          ))}
        </main>
      </div>
    </div>
  )
}
