import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import { KnowledgeProvider } from './context/KnowledgeContext'
import { TutorProvider } from './context/TutorContext'
import { TabProvider } from './context/TabContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <TutorProvider>
        <KnowledgeProvider>
          <TabProvider>
            <App />
          </TabProvider>
        </KnowledgeProvider>
      </TutorProvider>
    </AuthProvider>
  </React.StrictMode>,
)
