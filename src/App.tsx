import { useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Dashboard from './pages/Dashboard'
import ComingSoon from './pages/ComingSoon'
import AppLayout from './components/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import { supabase } from './lib/supabase'

export default function App() {
  const navigate = useNavigate()

  useEffect(() => {
    // Listen for authentication changes globally
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // If the user signed in successfully (e.g. from Google OAuth hash token parsing)
      if (event === 'SIGNED_IN' && session) {
        // Force navigate to dashboard, which securely clears the long hash from the URL
        navigate('/dashboard', { replace: true })
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/coming-soon" element={<ComingSoon />} />
      </Route>
    </Routes>
  )
}
