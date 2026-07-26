import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Activity, Zap, BarChart3 } from 'lucide-react';
import SherlockLogo from '@/components/SherlockLogo';

const Layout = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/tracker', icon: Users, label: 'Investigate' },
    { path: '/activity', icon: Activity, label: 'Activity' },
    { path: '/map', icon: Zap, label: 'Deep Dive' },
    { path: '/reports', icon: BarChart3, label: 'Reports' },
  ];

  return (
    <div className="flex h-screen bg-black">
      <aside className="w-60 glass-strong border-r border-[#141414] flex flex-col relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#a3e635]/40 to-transparent"></div>
        <div className="p-6 border-b border-[#141414]">
          <div className="flex items-center gap-3">
            <SherlockLogo size={28} color="#ffffff" />
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white leading-none">Sherlock</h1>
              <p className="text-[10px] uppercase tracking-[0.15em] text-[#525252] font-mono mt-1">
                v3.4
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
                className={`group relative flex items-center gap-3 px-3 py-2 rounded-md transition-colors duration-150 ${
                  isActive
                    ? 'bg-[#141414] text-white'
                    : 'text-[#737373] hover:bg-[#0a0a0a] hover:text-[#e5e5e5]'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] bg-[#a3e635] rounded-r shadow-[0_0_8px_rgba(163,230,53,0.5)]"></span>
                )}
                <Icon className="w-4 h-4" strokeWidth={1.75} />
                <span className="font-medium text-[13px]">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#141414]">
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
