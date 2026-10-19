import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { VendorList } from './pages/VendorList'
import { VendorDetail } from './pages/VendorDetail'
import { TasksPage } from './pages/TasksPage'

export default function App() {
  return (
    <BrowserRouter>
      <header className="topbar">
        <Link to="/">Vendor Verification Workspace</Link>
        <nav>
          <Link to="/">Vendors</Link>
          <Link to="/tasks">Tasks</Link>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<VendorList />} />
          <Route path="/vendors/:id" element={<VendorDetail />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="*" element={<p>Page not found</p>} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
