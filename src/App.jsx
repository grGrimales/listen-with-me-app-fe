import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import HomePage from './pages/HomePage'
import CreateStoryPage from './pages/CreateStoryPage'
import StoryDetailPage from './pages/StoryDetailPage'
import StoryEvaluationPage from './pages/StoryEvaluationPage'
import AdminSentenceManagerPage from './pages/AdminSentenceManagerPage'
import AssetsManagerPage from './pages/AssetsManagerPage'
import DeletedStoriesPage from './pages/DeletedStoriesPage'
import StatsPage from './pages/StatsPage'
import PlaylistsPage from './pages/PlaylistsPage'
import ZenModePage from './pages/ZenModePage'
import PhrasesPage from './pages/PhrasesPage'
import PhrasePlaylistDetailPage from './pages/PhrasePlaylistDetailPage'
import PhraseStatsPage from './pages/PhraseStatsPage'
import PhraseImportPage from './pages/PhraseImportPage'
import PhrasePlaylistManagePage from './pages/PhrasePlaylistManagePage'
import PhraseVocabularyPage from './pages/PhraseVocabularyPage'
import StoryPhrasePlaylistsPage from './pages/StoryPhrasePlaylistsPage'
import PhraseZenPage from './pages/PhraseZenPage'
import PhraseZenStatsPage from './pages/PhraseZenStatsPage'

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
            path="/stories/:id/evaluation"
            element={
              <ProtectedRoute>
                <StoryEvaluationPage />
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
            path="/admin/stories/:id/sentences"
            element={
              <ProtectedRoute>
                <AdminSentenceManagerPage />
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
          <Route
            path="/phrases"
            element={
              <ProtectedRoute>
                <PhrasesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/phrases/stats"
            element={
              <ProtectedRoute>
                <PhraseStatsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/phrases/import"
            element={
              <ProtectedRoute>
                <PhraseImportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/phrases/from-stories"
            element={
              <ProtectedRoute>
                <StoryPhrasePlaylistsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/phrases/zen"
            element={
              <ProtectedRoute>
                <PhraseZenPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/phrases/zen/stats"
            element={
              <ProtectedRoute>
                <PhraseZenStatsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/phrases/:id/manage"
            element={
              <ProtectedRoute>
                <PhrasePlaylistManagePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/phrases/:id/vocabulary"
            element={
              <ProtectedRoute>
                <PhraseVocabularyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/phrases/:id"
            element={
              <ProtectedRoute>
                <PhrasePlaylistDetailPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
