import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Activity, Network, BarChart3, Search, Fingerprint } from 'lucide-react';

const Layout = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/tracker', icon: Users, label: 'Tracker' },
    { path: '/activity', icon: Activity, label: 'Activity' },
    { path: '/map', icon: Network, label: 'Ties & Trails' },
    { path: '/reports', icon: BarChart3, label: 'Reports' },
    { path: '/search', icon: Search, label: 'Search' },
  ];

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      <aside className="w-64 bg-[#0d0d0d] border-r border-[#1a1a1a] flex flex-col">
        <div className="p-6 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-md bg-gradient-to-br from-[#d4a656] to-[#8b5f2b] flex items-center justify-center amber-glow">
              <Fingerprint className="w-6 h-6 text-[#0a0a0a]" strokeWidth={2} />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight text-[#e8e6e1]">Sherlock</h1>
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#6b6660] font-mono">Intelligence</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.label.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}`}
                className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors duration-200 ${
                  isActive
                    ? 'bg-[#1a1613] text-[#d4a656] border-l-2 border-[#d4a656]'
                    : 'text-[#8a857e] hover:bg-[#141414] hover:text-[#e8e6e1] border-l-2 border-transparent'
                }`}
              >
                <Icon className="w-[18px] h-[18px]" strokeWidth={1.5} />
                <span className="font-medium text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#1a1a1a]">
          <div className="text-[10px] font-mono uppercase tracking-widest text-[#6b6660]">Live Data</div>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full bg-[#7d9c60] animate-pulse"></div>
            <span className="text-xs text-[#8a857e]">Apify Connected</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
