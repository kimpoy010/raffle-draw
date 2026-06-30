import { Routes, Route } from 'react-router-dom'
import AdminPage from './pages/AdminPage.jsx'
import DrawPage from './pages/DrawPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DrawPage />} />
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  )
}
