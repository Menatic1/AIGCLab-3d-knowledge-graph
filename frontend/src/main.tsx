import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import { KnowledgeProvider } from './context/KnowledgeContext'
import { TabProvider } from './context/TabContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <KnowledgeProvider>
        <TabProvider>
          <App />
        </TabProvider>
      </KnowledgeProvider>
    </AuthProvider>
  </React.StrictMode>,
)
