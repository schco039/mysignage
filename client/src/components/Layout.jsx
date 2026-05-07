import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Monitor,
  FolderOpen,
  ListVideo,
  CalendarDays,
  ScrollText,
  Tv,
  Users,
  Shield,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import useAuth from '../hooks/useAuth';

// Items visible to all users (editors + admins)
const editorItems = [
  { to: '/assets', icon: FolderOpen, label: 'Media Library' },
  { to: '/schedule', icon: CalendarDays, label: 'Schedule' },
];

// Items only visible to admins
const adminNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/players', icon: Tv, label: 'Players' },
  { to: '/display-groups', icon: Monitor, label: 'Display Groups' },
  { to: '/logs', icon: ScrollText, label: 'Logs' },
];

const adminItems = [
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/user-groups', icon: Shield, label: 'User Groups' },
];

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
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
          {/* Admin-only nav items */}
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

          {/* Items for all users */}
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
            <div className="text-sm">
              <div className="font-semibold text-white/90">{user?.username}</div>
              <div className="text-white/40 text-xs">{user?.role}</div>
            </div>
            <button
              onClick={logout}
              className="text-white/40 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
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
    </div>
  );
}
