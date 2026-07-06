import { NavLink, Outlet } from 'react-router-dom'
import './App.css'

function App() {
  return (
    <div className="app-shell">
      <header className="app-nav">
        <span className="brand">GolFrame</span>
        <nav>
          <NavLink to="/" end>
            Library
          </NavLink>
          <NavLink to="/compare">Compare</NavLink>
          <NavLink to="/trends">Trends</NavLink>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}

export default App
