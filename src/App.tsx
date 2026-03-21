import { useAuthActions } from '@convex-dev/auth/react'
import { useConvexAuth, useQuery } from 'convex/react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { api } from '../convex/_generated/api'
import AppShell from './components/AppShell'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ResidentDirectory from './pages/ResidentDirectory'
import ResidentProfile from './pages/ResidentProfile'
import CreateResident from './pages/CreateResident'
import IssueList from './pages/IssueList'
import IssueDetail from './pages/IssueDetail'
import CreateIssue from './pages/CreateIssue'
import AdminPanel from './pages/AdminPanel'
import { UserContext } from './context/UserContext'

function AuthenticatedApp() {
  const me = useQuery(api.users.getMe)

  if (me === undefined) {
    return (
      <div className="spinner-wrap">
        <div className="spinner" />
      </div>
    )
  }

  if (me === null) {
    // User authenticated but no app profile yet — show setup message
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--on-surface-variant)' }}>
          Account pending setup. Please contact your administrator.
        </p>
      </div>
    )
  }

  return (
    <UserContext.Provider value={me}>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/residents" element={<ResidentDirectory />} />
          <Route path="/residents/new" element={<CreateResident />} />
          <Route path="/residents/:id" element={<ResidentProfile />} />
          <Route path="/issues" element={<IssueList />} />
          <Route path="/issues/new" element={<CreateIssue />} />
          <Route path="/issues/:id" element={<IssueDetail />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </UserContext.Provider>
  )
}

export default function App() {
  const { isAuthenticated, isLoading } = useConvexAuth()

  if (isLoading) {
    return (
      <div className="spinner-wrap" style={{ minHeight: '100dvh' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="*"
          element={isAuthenticated ? <AuthenticatedApp /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  )
}
