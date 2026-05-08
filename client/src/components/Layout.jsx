import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderOpen,
  CalendarDays,
  ScrollText,
  Tv,
  Users,
  Shield,
  LogOut,
  Menu,
  X,
  KeyRound,
} from 'lucide-react';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import useAuth from '../hooks/useAuth';
import api from '../api/client';

const editorItems = [
  { to: '/assets', icon: FolderOpen, label: 'Media Library' },
  { to: '/schedule', icon: CalendarDays, label: 'Schedule' },
];

const adminNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/players', icon: Tv, label: 'Players' },
  { to: '/logs', icon: ScrollText, label: 'Logs' },
];

const adminItems = [
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/user-groups', icon: Shield, label: 'User Groups' },
];

function PasswordModal({ onClose, forced = false, onSuccess }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: (data) => api.put('/auth/password', data),
    onSuccess: () => {
      setSuccess(true);
      if (onSuccess) onSuccess();
      setTimeout(() => onClose(), 1500);
    },
    onError: (err) => setError(err.response?.data?.error || 'Fehler'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) { setError('Passwörter stimmen nicht überein'); return; }
    if (newPassword.length < 4) { setError('Mindestens 4 Zeichen'); return; }
    mutation.mutate({ currentPassword, newPassword });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-semibold">Passwort ändern</h3>
            {forced && (
              <p className="text-xs text-orange-600 mt-1">
                Du musst dein Passwort beim ersten Login ändern.
              </p>
            )}
          </div>
          {!forced && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {success ? (
            <div className="text-center text-green-600 font-medium py-4">✓ Passwort geändert</div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Aktuelles Passwort</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Neues Passwort</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Bestätigen</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <button
                type="submit"
                disabled={mutation.isPending}
                className="w-full btn-brand py-2 text-sm disabled:opacity-40"
              >
                {mutation.isPending ? 'Speichere...' : 'Passwort ändern'}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const forcedPasswordChange = !!user?.mustChangePassword;

  const handlePasswordChanged = () => {
    // User-Objekt im LocalStorage updaten
    const updated = { ...user, mustChangePassword: false };
    localStorage.setItem('user', JSON.stringify(updated));
    window.location.reload();
  };

  return (
    <div className="flex h-screen">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 sidebar-gradient text-white transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-5 border-b border-white/10">
          <h1 className="text-xl font-extrabold tracking-tight">mySignage</h1>
          <button className="lg:hidden text-white/70 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="mt-6 px-3">
          {isAdmin && adminNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-all text-sm font-medium ${
                  isActive
                    ? 'bg-white/20 text-white shadow-lg shadow-black/10 backdrop-blur-sm'
                    : 'text-white/65 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}

          {editorItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-all text-sm font-medium ${
                  isActive
                    ? 'bg-white/20 text-white shadow-lg shadow-black/10 backdrop-blur-sm'
                    : 'text-white/65 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div className="mt-8 mb-3 px-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">
                Admin
              </div>
              {adminItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-all text-sm font-medium ${
                      isActive
                        ? 'bg-white/20 text-white shadow-lg shadow-black/10 backdrop-blur-sm'
                        : 'text-white/65 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <item.icon size={18} />
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <div className="text-sm min-w-0">
              <div className="font-semibold text-white/90 truncate">{user?.username}</div>
              <div className="text-white/40 text-xs">{user?.role}</div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setPasswordModal(true)}
                className="text-white/40 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
                title="Passwort ändern"
              >
                <KeyRound size={16} />
              </button>
              <button
                onClick={logout}
                className="text-white/40 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-gray-50/80">
        <header className="h-16 border-b border-gray-200/80 bg-white/80 backdrop-blur-sm flex items-center px-4 lg:px-6">
          <button className="lg:hidden mr-4 text-gray-600 hover:text-gray-900" onClick={() => setSidebarOpen(true)}>
            <Menu size={24} />
          </button>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      {(passwordModal || forcedPasswordChange) && (
        <PasswordModal
          onClose={() => setPasswordModal(false)}
          forced={forcedPasswordChange}
          onSuccess={forcedPasswordChange ? handlePasswordChanged : undefined}
        />
      )}
    </div>
  );
}
