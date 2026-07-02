import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { fetchSettings, saveSettings } from '../api'
import { Settings } from '../types'
import { useToasts } from './Toast'
import './SettingsPage.css'

const DEFAULT_SETTINGS: Settings = {
  openAiEndpoint: '',
}

const sections = [
  {
    id: 'ai',
    label: 'AI Services',
    description: 'Configure third-party AI provider endpoints',
  },
]

export function SettingsPage() {
  const navigate = useNavigate()
  const { addToast } = useToasts()
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState(sections[0].id)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const data = await fetchSettings()
      setSettings({
        openAiEndpoint: data.openAiEndpoint ?? '',
      })
    } catch {
      // Silently use defaults — settings file may not exist yet
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await saveSettings(settings)
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
              )}
            </section>
          ))}
        </main>
      </div>
    </div>
  )
}
