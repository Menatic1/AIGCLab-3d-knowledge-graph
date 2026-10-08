import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import { KnowledgeProvider } from './context/KnowledgeContext'
import { TabProvider } from './context/TabContext'
import { CourseProvider } from './context/CourseContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <CourseProvider>
        <KnowledgeProvider>
          <TabProvider>
            <App />
          </TabProvider>
        </KnowledgeProvider>
      </CourseProvider>
    </AuthProvider>
  </React.StrictMode>,
)
