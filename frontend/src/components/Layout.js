import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Activity, Network, BarChart3, Search, Waypoints } from 'lucide-react';
import SherlockLogo from '@/components/SherlockLogo';

const Layout = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard', num: '01' },
    { path: '/tracker', icon: Users, label: 'Tracker', num: '02' },
    { path: '/activity', icon: Activity, label: 'Activity', num: '03' },
    { path: '/connections', icon: Waypoints, label: 'Connections', num: '04' },
    { path: '/map', icon: Network, label: 'Ties & Trails', num: '05' },
    { path: '/reports', icon: BarChart3, label: 'Reports', num: '06' },
    { path: '/search', icon: Search, label: 'Search', num: '07' },
  ];

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      <aside className="w-64 bg-[#0c0c0c] border-r border-[#1a1a1a] flex flex-col relative">
        {/* Vertical accent line */}
        <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-[#d4a656]/30 to-transparent"></div>

        <div className="p-6 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-3">
            <SherlockLogo size={40} color="#d4a656" />
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight text-[#e8e6e1] leading-none">
                Sherlock
              </h1>
              <p className="text-[9px] uppercase tracking-[0.3em] text-[#d4a656]/70 font-mono mt-1">
                Intelligence Bureau
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-b border-[#1a1a1a]/60">
          <div className="text-[9px] font-mono uppercase tracking-[0.25em] text-[#6b6660] mb-1">
            Case Directory
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
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-sm transition-all duration-200 relative ${
                  isActive
                    ? 'bg-gradient-to-r from-[#1a1613] to-transparent text-[#d4a656]'
                    : 'text-[#8a857e] hover:bg-[#141414] hover:text-[#e8e6e1]'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-[#d4a656] rounded-r"></div>
                )}
                <span className={`text-[9px] font-mono ${isActive ? 'text-[#d4a656]/60' : 'text-[#4a4640]'}`}>
                  {item.num}
                </span>
                <Icon className="w-[17px] h-[17px]" strokeWidth={1.5} />
                <span className="font-medium text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-5 border-t border-[#1a1a1a]">
          <div className="text-[9px] font-mono uppercase tracking-[0.25em] text-[#6b6660] mb-2">
            System Status
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-1.5 h-1.5 rounded-full bg-[#7d9c60]"></div>
                <div className="absolute inset-0 rounded-full bg-[#7d9c60] animate-ping opacity-40"></div>
              </div>
              <span className="text-xs text-[#c9c5be]">Apify</span>
            </div>
            <span className="text-[10px] font-mono text-[#6b6660]">LIVE</span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#7d9c60]"></div>
              <span className="text-xs text-[#c9c5be]">GPT-5.4</span>
            </div>
            <span className="text-[10px] font-mono text-[#6b6660]">READY</span>
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
