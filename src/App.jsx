import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import HomePage from './pages/HomePage'
import CreateStoryPage from './pages/CreateStoryPage'
import StoryDetailPage from './pages/StoryDetailPage'
import AssetsManagerPage from './pages/AssetsManagerPage'
import DeletedStoriesPage from './pages/DeletedStoriesPage'
import StatsPage from './pages/StatsPage'
import PlaylistsPage from './pages/PlaylistsPage'
import ZenModePage from './pages/ZenModePage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stories/:id"
            element={
              <ProtectedRoute>
                <StoryDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/stories/create"
            element={
              <ProtectedRoute>
                <CreateStoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/stories/trash"
            element={
              <ProtectedRoute>
                <DeletedStoriesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/stories/:id/edit"
            element={
              <ProtectedRoute>
                <CreateStoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/stories/:id/assets"
            element={
              <ProtectedRoute>
                <AssetsManagerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stats"
            element={
              <ProtectedRoute>
                <StatsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/playlists"
            element={
              <ProtectedRoute>
                <PlaylistsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/zen"
            element={
              <ProtectedRoute>
                <ZenModePage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
