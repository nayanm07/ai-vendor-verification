import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom'
import { VendorList } from './pages/VendorList'
import { VendorDetail } from './pages/VendorDetail'
import { TasksPage } from './pages/TasksPage'
import { Icon } from './components/Icon'

export default function App() {
  return (
    <BrowserRouter>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <span className="brand-mark">
              <Icon name="verified_user" size={20} />
            </span>
            Vendor Verification Workspace
          </Link>
          <nav>
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
              Vendors
            </NavLink>
            <NavLink to="/tasks" className={({ isActive }) => (isActive ? 'active' : '')}>
              Tasks
            </NavLink>
          </nav>
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<VendorList />} />
          <Route path="/vendors/:id" element={<VendorDetail />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="*" element={<p>Page not found</p>} />
        </Routes>
      </main>
      <footer className="footer">
        <div className="footer-inner">Vendor Verification Workspace · AI-assisted vendor onboarding &amp; compliance</div>
      </footer>
    </BrowserRouter>
  )
}
