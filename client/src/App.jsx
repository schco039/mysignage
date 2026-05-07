import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Players from './pages/Players';
import Assets from './pages/Assets';
import Playlists from './pages/Playlists';
import PlaylistEditor from './pages/PlaylistEditor';
import Schedule from './pages/Schedule';
import Logs from './pages/Logs';
import Users from './pages/Users';
import UserGroups from './pages/UserGroups';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/players" element={<Players />} />
        <Route path="/assets" element={<Assets />} />
        <Route path="/playlists" element={<Playlists />} />
        <Route path="/playlists/:id/edit" element={<PlaylistEditor />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/logs" element={<Logs />} />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute adminOnly>
              <Users />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/user-groups"
          element={
            <ProtectedRoute adminOnly>
              <UserGroups />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
