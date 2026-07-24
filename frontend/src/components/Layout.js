import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Activity, Network, BarChart3, Search } from 'lucide-react';

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
    <div className="flex h-screen bg-[#030712]">
      <aside className="w-64 bg-[#0B101E] border-r border-[#1E293B] flex flex-col">
        <div className="p-6 border-b border-[#1E293B]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[#2563EB] to-[#06B6D4] flex items-center justify-center">
              <Search className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-black tracking-tighter text-[#F8FAFC]">Sherlock</h1>
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
                data-testid={`nav-${item.label.toLowerCase().replace(/ & /g, '-')}`}
                className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors duration-200 ${
                  isActive
                    ? 'bg-[#2563EB] text-white'
                    : 'text-[#94A3B8] hover:bg-[#111827] hover:text-[#F8FAFC]'
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={1.5} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;