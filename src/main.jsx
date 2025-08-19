import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import "leaflet/dist/leaflet.css"
import './index.css'
import { registerSW } from 'virtual:pwa-register'

// auto-register and update
registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
