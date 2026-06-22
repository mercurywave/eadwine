import { useState, useEffect } from 'react'
import './App.css'

interface MessageResponse {
  message: string
  uptime: number
}

interface HealthResponse {
  status: string
  timestamp: string
}

function App() {
  const [apiMessage, setApiMessage] = useState<string>('')
  const [healthStatus, setHealthStatus] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [messageRes, healthRes] = await Promise.all([
          fetch('/api/message'),
          fetch('/api/health'),
        ])

        if (!messageRes.ok || !healthRes.ok) {
          throw new Error('Failed to fetch from server')
        }

        const messageData: MessageResponse = await messageRes.json()
        const healthData: HealthResponse = await healthRes.json()

        setApiMessage(messageData.message)
        setHealthStatus(healthData.status)
        setError('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank" rel="noopener noreferrer">
          <img src="/vite.svg" className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank" rel="noopener noreferrer">
          <img src="/react.svg" className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <p>
          {loading ? (
            'Connecting to server...'
          ) : error ? (
            <span style={{ color: 'red' }}>Error: {error}</span>
          ) : (
            <>
              <p>Server Status: <strong>{healthStatus}</strong></p>
              <p>Server Message: <strong>{apiMessage}</strong></p>
            </>
          )}
        </p>
        <p className="read-the-docs">
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
    </>
  )
}

export default App
