import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Edit2, Check, X, HardDrive, AlertTriangle } from 'lucide-react'
import { fetchSettings, saveSettings, fetchModels, createPersona, updatePersona, deletePersona, setDefaultPersona, resetDefaultPersona, createMacro, updateMacro, deleteMacro, fetchBackupStatus, triggerBackup } from '../api'
import { Settings, Persona, Macro } from '../types'
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
  {
    id: 'macros',
    label: 'Macros',
    description: 'Create prompt shortcuts you can use in chat',
  },
  {
    id: 'backups',
    label: 'Backups',
    description: 'Automatically back up server data using Git',
  },
]

interface PersonaForm {
  name: string
  description: string
  systemPrompt: string
}

interface MacroForm {
  name: string
  prompt: string
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

  // Macro state
  const [macros, setMacros] = useState<Macro[]>([])
  const [editingMacro, setEditingMacro] = useState<string | null>(null)
  const [macroForm, setMacroForm] = useState<MacroForm>({
    name: '',
    prompt: '',
  })
  const [showAddMacroForm, setShowAddMacroForm] = useState(false)
  const [loadingMacros, setLoadingMacros] = useState(false)

  // Backup state
  const [backupStatus, setBackupStatus] = useState<{ gitAvailable: boolean; initialized: boolean; lastCommitTimestamp?: string; lastCommitMessage?: string } | null>(null)
  const [backuping, setBackuping] = useState(false)
  const [loadingBackup, setLoadingBackup] = useState(false)

  useEffect(() => {
    loadSettings()
    loadBackupStatus()
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
        summaryMaxLength: data.summaryMaxLength,
        memoryMaxLength: data.memoryMaxLength,
        otherMaxLength: data.otherMaxLength,
        backupTime: data.backupTime,
      })
      setPersonas(data.personas || [])
      setMacros(data.macros || [])
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

  const loadBackupStatus = async () => {
    try {
      setLoadingBackup(true)
      const status = await fetchBackupStatus()
      setBackupStatus(status)
    } catch {
      // Silently handle — backup status may not be available
      setBackupStatus({ gitAvailable: false, initialized: false })
    } finally {
      setLoadingBackup(false)
    }
  }

  const handleSave = async () => {
    if (!settings.selectedModel) {
      addToast('Please select a model before saving', 'error')
      return
    }
    // Validate required file size limits
    if (settings.summaryMaxLength && settings.summaryMaxLength <= 0) {
      addToast('Summary file length limit is required and must be a positive number', 'error')
      return
    }
    if (settings.memoryMaxLength && settings.memoryMaxLength <= 0) {
      addToast('Memory file length limit is required and must be a positive number', 'error')
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
        summaryMaxLength: settings.summaryMaxLength,
        memoryMaxLength: settings.memoryMaxLength,
        otherMaxLength: settings.otherMaxLength,
        backupTime: settings.backupTime,
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

  const handleSummaryMaxLengthChange = (value: string) => {
    const trimmed = value.trim()
    if (trimmed === '') {
      setSettings(prev => ({ ...prev, summaryMaxLength: undefined }))
    } else {
      const num = Number(value)
      if (!isNaN(num) && isFinite(num)) {
        setSettings(prev => ({ ...prev, summaryMaxLength: num }))
      }
    }
  }

  const handleMemoryMaxLengthChange = (value: string) => {
    const trimmed = value.trim()
    if (trimmed === '') {
      setSettings(prev => ({ ...prev, memoryMaxLength: undefined }))
    } else {
      const num = Number(value)
      if (!isNaN(num) && isFinite(num)) {
        setSettings(prev => ({ ...prev, memoryMaxLength: num }))
      }
    }
  }

  const handleOtherMaxLengthChange = (value: string) => {
    const trimmed = value.trim()
    if (trimmed === '') {
      setSettings(prev => ({ ...prev, otherMaxLength: undefined }))
    } else {
      const num = Number(value)
      if (!isNaN(num) && isFinite(num)) {
        setSettings(prev => ({ ...prev, otherMaxLength: num }))
      }
    }
  }

  const handleBackupTimeChange = (value: string) => {
    setSettings(prev => ({ ...prev, backupTime: value || undefined }))
  }

  const handleTriggerBackup = async () => {
    try {
      setBackuping(true)
      const result = await triggerBackup()
      if (result.success) {
        addToast(result.message || 'Backup created', 'success')
      } else {
        addToast(result.message || 'Backup failed', 'error')
      }
      // Refresh backup status
      await loadBackupStatus()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to trigger backup'
      addToast(message, 'error')
    } finally {
      setBackuping(false)
    }
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
      setPersonaForm({ name: '', description: '', systemPrompt: '' })
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
      // If clicking the already-default persona, reset it
      if (settings.defaultPersonaId === id) {
        await resetDefaultPersona(id)
        setSettings(prev => ({ ...prev, defaultPersonaId: undefined }))
        addToast('Default persona cleared', 'success')
      } else {
        // If there was a previous default, reset it
        if (settings.defaultPersonaId) {
          await resetDefaultPersona(settings.defaultPersonaId)
        }
        await setDefaultPersona(id)
        setSettings(prev => ({ ...prev, defaultPersonaId: id }))
        addToast('Default persona set', 'success')
      }
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

  // Macro handlers
  const handleAddMacro = async () => {
    if (!macroForm.name || !macroForm.prompt) {
      addToast('Name and prompt are required', 'error')
      return
    }
    try {
      setLoadingMacros(true)
      const newMacro = await createMacro(macroForm)
      setMacros(prev => [...prev, newMacro])
      setMacroForm({ name: '', prompt: '' })
      setShowAddMacroForm(false)
      addToast('Macro created', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create macro'
      addToast(message, 'error')
    } finally {
      setLoadingMacros(false)
    }
  }

  const handleEditMacro = (macro: Macro) => {
    setEditingMacro(macro.id)
    setMacroForm({
      name: macro.name,
      prompt: macro.prompt,
    })
  }

  const handleUpdateMacro = async () => {
    if (!editingMacro || !macroForm.name || !macroForm.prompt) {
      addToast('Name and prompt are required', 'error')
      return
    }
    try {
      setLoadingMacros(true)
      const updated = await updateMacro(editingMacro, macroForm)
      setMacros(prev => prev.map(m => m.id === editingMacro ? updated : m))
      setEditingMacro(null)
      addToast('Macro updated', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update macro'
      addToast(message, 'error')
    } finally {
      setLoadingMacros(false)
    }
  }

  const handleCancelEditMacro = () => {
    setEditingMacro(null)
    setMacroForm({ name: '', prompt: '' })
  }

  const handleDeleteMacro = async (id: string) => {
    if (!confirm('Are you sure you want to delete this macro?')) return
    try {
      setLoadingMacros(true)
      await deleteMacro(id)
      setMacros(prev => prev.filter(m => m.id !== id))
      addToast('Macro deleted', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete macro'
      addToast(message, 'error')
    } finally {
      setLoadingMacros(false)
    }
  }

  const handleCancelAddMacro = () => {
    setShowAddMacroForm(false)
    setMacroForm({ name: '', prompt: '' })
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

                  <div className="setting-field">
                    <label htmlFor="summaryMaxLength">SUMMARY.md Limit (characters)</label>
                    <input
                      id="summaryMaxLength"
                      type="number"
                      className="modal-input"
                      min="1"
                      placeholder="1000"
                      value={settings.summaryMaxLength ?? ''}
                      onChange={e => handleSummaryMaxLengthChange(e.target.value)}
                    />
                    <span className="field-hint">
                      Maximum string length for SUMMARY.md. The agent will reject writes that exceed this limit. Required.
                    </span>
                  </div>

                  <div className="setting-field">
                    <label htmlFor="memoryMaxLength">MEMORY.md Limit (characters)</label>
                    <input
                      id="memoryMaxLength"
                      type="number"
                      className="modal-input"
                      min="1"
                      placeholder="5000"
                      value={settings.memoryMaxLength ?? ''}
                      onChange={e => handleMemoryMaxLengthChange(e.target.value)}
                    />
                    <span className="field-hint">
                      Maximum string length for MEMORY.md. The agent will reject writes that exceed this limit. Required.
                    </span>
                  </div>

                  <div className="setting-field">
                    <label htmlFor="otherMaxLength">Other .md Files Limit (characters)</label>
                    <input
                      id="otherMaxLength"
                      type="number"
                      className="modal-input"
                      min="0"
                      placeholder="Leave blank for no limit"
                      value={settings.otherMaxLength ?? ''}
                      onChange={e => handleOtherMaxLengthChange(e.target.value)}
                    />
                    <span className="field-hint">
                      Maximum string length for all other .md files. Leave blank or set to 0 for no limit.
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

              {section.id === 'macros' && (
                <>
                  <div className="macros-header">
                    <button
                      className="btn-secondary"
                      onClick={() => setShowAddMacroForm(true)}
                      disabled={loadingMacros}
                    >
                      <Plus className="btn-icon" />
                      Add Macro
                    </button>
                  </div>

                  {/* Add Macro Form */}
                  {showAddMacroForm && (
                    <div className="macro-form">
                      <h3>New Macro</h3>
                      <div className="setting-field">
                        <label htmlFor="macro-name">Name</label>
                        <input
                          id="macro-name"
                          type="text"
                          className="modal-input"
                          placeholder="e.g., Summarize"
                          value={macroForm.name}
                          onChange={e => setMacroForm(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div className="setting-field">
                        <label htmlFor="macro-prompt">Prompt</label>
                        <textarea
                          id="macro-prompt"
                          className="modal-input macro-textarea"
                          placeholder="Enter the prompt that will be sent to the agent..."
                          value={macroForm.prompt}
                          onChange={e => setMacroForm(prev => ({ ...prev, prompt: e.target.value }))}
                          rows={4}
                        />
                        <span className="field-hint">
                          This prompt will be submitted to the agent when you select this macro in chat.
                        </span>
                      </div>
                      <div className="persona-form-actions">
                        <button
                          className="btn-primary"
                          onClick={handleAddMacro}
                          disabled={loadingMacros || !macroForm.name || !macroForm.prompt}
                        >
                          <Check className="btn-icon" />
                          Create
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={handleCancelAddMacro}
                        >
                          <X className="btn-icon" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Macro List */}
                  <div className="macro-list">
                    {macros.length === 0 && !showAddMacroForm && (
                      <p className="macro-empty">No macros defined yet. Click "Add Macro" to create one.</p>
                    )}
                    {macros.map(macro => (
                      <div
                        key={macro.id}
                        className="macro-item"
                      >
                        {editingMacro === macro.id ? (
                          // Edit mode
                          <div className="macro-edit-form">
                            <div className="setting-field">
                              <label htmlFor={`edit-macro-name-${macro.id}`}>Name</label>
                              <input
                                id={`edit-macro-name-${macro.id}`}
                                type="text"
                                className="modal-input"
                                value={macroForm.name}
                                onChange={e => setMacroForm(prev => ({ ...prev, name: e.target.value }))}
                              />
                            </div>
                            <div className="setting-field">
                              <label htmlFor={`edit-macro-prompt-${macro.id}`}>Prompt</label>
                              <textarea
                                id={`edit-macro-prompt-${macro.id}`}
                                className="modal-input macro-textarea"
                                value={macroForm.prompt}
                                onChange={e => setMacroForm(prev => ({ ...prev, prompt: e.target.value }))}
                                rows={3}
                              />
                            </div>
                            <div className="persona-form-actions">
                              <button
                                className="btn-primary"
                                onClick={handleUpdateMacro}
                                disabled={loadingMacros || !macroForm.name || !macroForm.prompt}
                              >
                                <Check className="btn-icon" />
                                Save
                              </button>
                              <button
                                className="btn-secondary"
                                onClick={handleCancelEditMacro}
                              >
                                <X className="btn-icon" />
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          // View mode
                          <div className="macro-item-content">
                            <div className="macro-item-header">
                              <h4 className="macro-item-name">{macro.name}</h4>
                              <p className="macro-item-prompt">{macro.prompt}</p>
                            </div>
                            <div className="macro-item-actions">
                              <button
                                className="btn-icon-btn"
                                onClick={() => handleEditMacro(macro)}
                                title="Edit"
                                disabled={loadingMacros}
                              >
                                <Edit2 className="btn-icon-small" />
                              </button>
                              <button
                                className="btn-icon-btn btn-danger"
                                onClick={() => handleDeleteMacro(macro.id)}
                                title="Delete"
                                disabled={loadingMacros}
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

              {section.id === 'backups' && (
                <>
                  {loadingBackup ? (
                    <div className="loading">Loading backup status...</div>
                  ) : (
                    <>
                      {!backupStatus?.gitAvailable ? (
                        <div className="backup-error">
                          <AlertTriangle className="backup-error-icon" />
                          <div>
                            <h3>Git is not installed</h3>
                            <p>Server backups require Git to be installed on this system. Please install Git and restart the server to enable this feature.</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="backup-status">
                            <h3>Backup Status</h3>
                            {backupStatus.initialized ? (
                              <div className="backup-status-info">
                                {backupStatus.lastCommitTimestamp ? (
                                  <div className="backup-status-item">
                                    <span className="backup-status-label">Last backup:</span>
                                    <span className="backup-status-value">{new Date(backupStatus.lastCommitTimestamp).toLocaleString()}</span>
                                  </div>
                                ) : (
                                  <div className="backup-status-item">
                                    <span className="backup-status-label">Repository initialized</span>
                                    <span className="backup-status-value">No commits yet</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="backup-status-info">
                                <div className="backup-status-item">
                                  <span className="backup-status-label">Repository:</span>
                                  <span className="backup-status-value">Not initialized</span>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="backup-actions">
                            <button
                              className="btn-primary"
                              onClick={handleTriggerBackup}
                              disabled={backuping}
                            >
                              <HardDrive className="btn-icon" />
                              {backuping ? 'Backing up...' : 'Backup Now'}
                            </button>
                          </div>

                          <div className="setting-field">
                            <label htmlFor="backupTime">Daily Backup Time</label>
                            <input
                              id="backupTime"
                              type="time"
                              className="modal-input"
                              value={settings.backupTime || ''}
                              onChange={e => handleBackupTimeChange(e.target.value)}
                            />
                            <span className="field-hint">
                              Set the time of day for automatic daily backups. Leave blank to disable scheduled backups.
                            </span>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </section>
          ))}
        </main>
      </div>
    </div>
  )
}
