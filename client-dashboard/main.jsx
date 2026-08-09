import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './theme.css'
import { initTheme } from './theme.js'

initTheme() // applied before first render, so there's no flash of the wrong theme

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)