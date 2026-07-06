import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import Library from './pages/Library.tsx'
import SwingDetail from './pages/SwingDetail.tsx'
import Compare from './pages/Compare.tsx'
import Trends from './pages/Trends.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Library />} />
          <Route path="swings/:id" element={<SwingDetail />} />
          <Route path="compare" element={<Compare />} />
          <Route path="trends" element={<Trends />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
