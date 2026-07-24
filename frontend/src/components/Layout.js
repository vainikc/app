import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Activity, Network, BarChart3, Search, Waypoints, LogOut } from 'lucide-react';
import SherlockLogo from '@/components/SherlockLogo';
import { useAuth } from '@/lib/AuthContext';

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/tracker', icon: Users, label: 'Tracker' },
    { path: '/activity', icon: Activity, label: 'Activity' },
    { path: '/connections', icon: Waypoints, label: 'Connections' },
    { path: '/map', icon: Network, label: 'Ties & Trails' },
    { path: '/reports', icon: BarChart3, label: 'Reports' },
    { path: '/search', icon: Search, label: 'Search' },
  ];

  return (
    <div className="flex h-screen bg-black">
      <aside className="w-60 bg-[#050505] border-r border-[#141414] flex flex-col">
        <div className="p-6 border-b border-[#141414]">
          <div className="flex items-center gap-3">
            <SherlockLogo size={28} color="#ffffff" />
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white leading-none">Sherlock</h1>
              <p className="text-[10px] uppercase tracking-[0.15em] text-[#525252] font-mono mt-1">
                v3.3
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.label.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}`}
                className={`group flex items-center gap-3 px-3 py-2 rounded-md transition-colors duration-150 ${
                  isActive
                    ? 'bg-[#141414] text-white'
                    : 'text-[#737373] hover:bg-[#0a0a0a] hover:text-[#e5e5e5]'
                }`}
              >
                <Icon className="w-4 h-4" strokeWidth={1.75} />
                <span className="font-medium text-[13px]">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#141414] space-y-3">
          {user && (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-mono text-white truncate" data-testid="current-user-email">
                  {user.email}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-[#525252]">{user.role || 'user'}</div>
              </div>
              <button
                onClick={async () => { await logout(); navigate('/login'); }}
                data-testid="logout-btn"
                title="Sign out"
                className="text-[#737373] hover:text-white p-1.5 rounded-md hover:bg-[#0f0f0f] transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-[#525252]">
            <div className="dot-live"></div>
            <span>Live data</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-black">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
