import { useEffect, useState } from 'react';
import axios from 'axios';
import { Users, TrendingUp, FileImage, ArrowUpRight, ArrowRight, Waypoints } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { proxyImage } from '@/lib/imageProxy';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const formatNumber = (n) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n ?? 0);
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState({ accounts: [], totals: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await axios.get(`${API}/dashboard`);
      setData(res.data);
    } catch (error) {
      console.error('Dashboard error:', error);
    }
    setLoading(false);
  };

  const totals = data.totals || {};
  const stats = [
    { label: 'Cases', value: totals.tracked || 0, icon: Users },
    { label: 'Followers', value: formatNumber(totals.followers || 0), icon: TrendingUp },
    { label: 'Following', value: formatNumber(totals.following || 0), icon: Waypoints },
    { label: 'Posts', value: formatNumber(totals.posts || 0), icon: FileImage },
  ];

  return (
    <div className="p-10 max-w-[1600px]">
      <div className="mb-10 flex items-start justify-between gap-6">
        <div className="pl-8 hero-crosshair">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-white mb-3">
            Dashboard
          </h1>
          <p className="text-[15px] text-[#a1a1aa] max-w-xl leading-relaxed">
            Live overview of every Instagram account under observation.
          </p>
        </div>
        <button
          onClick={() => navigate('/tracker')}
          data-testid="add-account-nav-btn"
          className="btn-primary px-4 py-2.5 rounded-md text-sm flex items-center gap-2 shrink-0"
        >
          <span>New investigation</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              data-testid={`stat-card-${stat.label.toLowerCase()}`}
              className="card-neu rounded-lg p-5 group"
              style={{ animation: `fadeInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.04}s backwards` }}
            >
              <div className="flex items-center justify-between mb-6">
                <Icon className="w-4 h-4 text-[#737373] group-hover:text-[#a3e635] transition-colors" strokeWidth={1.75} />
                <ArrowUpRight className="w-3.5 h-3.5 text-[#404040] group-hover:text-white transition-colors" strokeWidth={1.75} />
              </div>
              <div className="text-3xl font-bold text-white tracking-tight mb-1">
                {stat.value}
              </div>
              <div className="text-xs text-[#737373]">{stat.label}</div>
            </div>
          );
        })}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white accent-bar">Active cases</h2>
        <span className="text-xs text-[#737373]">{data.accounts.length} {data.accounts.length === 1 ? 'case' : 'cases'}</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-lg skeleton"></div>
          ))}
        </div>
      ) : data.accounts.length === 0 ? (
        <div className="card-modern rounded-lg p-16 text-center">
          <div className="text-xl font-medium text-white mb-2">No cases open</div>
          <p className="text-sm text-[#a1a1aa] mb-6 max-w-md mx-auto">
            Track any public Instagram profile to begin. We'll observe, record, and analyze —
            you get the intelligence.
          </p>
          <button
            onClick={() => navigate('/tracker')}
            data-testid="add-first-account-btn"
            className="btn-primary px-5 py-2.5 rounded-md text-sm"
          >
            Track your first account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.accounts.map((account, idx) => {
            const profile = account.profile;
            return (
              <div
                key={account.id}
                data-testid={`account-card-${account.username}`}
                onClick={() => navigate('/tracker')}
                className="cursor-pointer card-modern rounded-lg p-5 group"
                style={{ animation: `fadeInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.05}s backwards` }}
              >
                <div className="flex items-center gap-3 mb-4">
                  {profile?.profile_pic ? (
                    <img
                      src={proxyImage(profile.profile_pic)}
                      alt={account.username}
                      className="w-10 h-10 rounded-full object-cover border border-[#262626]"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#141414] border border-[#262626] flex items-center justify-center">
                      <span className="text-[#a1a1aa] font-mono text-sm">
                        {account.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm font-medium text-white truncate">
                      @{account.username}
                    </div>
                    {profile?.full_name && (
                      <div className="text-xs text-[#737373] truncate">{profile.full_name}</div>
                    )}
                  </div>
                </div>

                {profile ? (
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#141414]">
                    <div>
                      <div className="font-mono text-sm text-white">{formatNumber(profile.posts)}</div>
                      <div className="text-[10px] text-[#525252] font-mono">Posts</div>
                    </div>
                    <div>
                      <div className="font-mono text-sm text-white">{formatNumber(profile.followers)}</div>
                      <div className="text-[10px] text-[#525252] font-mono">Followers</div>
                    </div>
                    <div>
                      <div className="font-mono text-sm text-white">{formatNumber(profile.following)}</div>
                      <div className="text-[10px] text-[#525252] font-mono">Following</div>
                    </div>
                  </div>
                ) : (
                  <div className="pt-3 border-t border-[#141414] text-xs text-[#ef4444]">Fetch failed</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
