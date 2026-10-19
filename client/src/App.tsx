import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { VendorList } from './pages/VendorList'
import { VendorDetail } from './pages/VendorDetail'

export default function App() {
  return (
    <BrowserRouter>
      <header className="topbar">
        <Link to="/">Vendor Verification Workspace</Link>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<VendorList />} />
          <Route path="/vendors/:id" element={<VendorDetail />} />
          <Route path="*" element={<p>Page not found</p>} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
