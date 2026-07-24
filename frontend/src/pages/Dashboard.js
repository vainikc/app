import { useEffect, useState } from 'react';
import axios from 'axios';
import { Users, TrendingUp, Activity, FileImage, ArrowUpRight, ArrowRight } from 'lucide-react';
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
  const [trackedAccounts, setTrackedAccounts] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrackedAccounts();
  }, []);

  const fetchTrackedAccounts = async () => {
    try {
      const res = await axios.get(`${API}/accounts`);
      setTrackedAccounts(res.data);
      setLoading(false);
      res.data.forEach((acc) => fetchProfile(acc.username));
    } catch (error) {
      console.error('Error fetching accounts:', error);
      setLoading(false);
    }
  };

  const fetchProfile = async (username) => {
    try {
      const res = await axios.get(`${API}/profile/${username}`);
      setProfiles((prev) => ({ ...prev, [username]: res.data }));
    } catch (error) {
      console.error(`Error fetching ${username}:`, error);
    }
  };

  const totalFollowers = Object.values(profiles).reduce((sum, p) => sum + (p.followers || 0), 0);
  const totalPosts = Object.values(profiles).reduce((sum, p) => sum + (p.posts || 0), 0);
  const totalFollowing = Object.values(profiles).reduce((sum, p) => sum + (p.following || 0), 0);

  const stats = [
    { label: 'Active Cases', value: trackedAccounts.length, icon: Users, hint: 'Under observation', suffix: '' },
    { label: 'Combined Reach', value: formatNumber(totalFollowers), icon: TrendingUp, hint: 'Followers indexed', suffix: '' },
    { label: 'Connections', value: formatNumber(totalFollowing), icon: Activity, hint: 'Total network', suffix: '' },
    { label: 'Evidence', value: formatNumber(totalPosts), icon: FileImage, hint: 'Posts catalogued', suffix: '' },
  ];

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div className="p-10 max-w-[1600px]">
      <div className="mb-10 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="corner-ornament text-[10px] font-mono uppercase tracking-[0.3em] text-[#d4a656]">
              Case File — Overview
            </span>
          </div>
          <h1 className="font-heading text-6xl font-semibold tracking-tight text-[#e8e6e1] mb-2 text-glow-amber">
            Dashboard
          </h1>
          <p className="text-[#8a857e] max-w-xl">
            A quiet room, a lamp, and the whole city of Instagram to observe.
            Here's what the data whispers today.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#6b6660]">Report Date</div>
          <div className="text-sm text-[#c9c5be] font-mono mt-1">{currentDate}</div>
        </div>
      </div>

      <div className="divider-ornate mb-10"></div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              data-testid={`stat-card-${stat.label.toLowerCase().replace(/ /g, '-')}`}
              className="card-vintage rounded-md p-6 group"
              style={{ animation: `fadeInUp 0.5s ease-out ${idx * 0.06}s backwards` }}
            >
              <div className="flex items-start justify-between mb-8">
                <div className="w-10 h-10 rounded-md flex items-center justify-center bg-[#1a1613] border border-[#2a2622] group-hover:border-[#d4a656] group-hover:bg-[#221a12] transition-colors duration-300">
                  <Icon className="w-5 h-5 text-[#d4a656]" strokeWidth={1.5} />
                </div>
                <ArrowUpRight className="w-4 h-4 text-[#4a4640] group-hover:text-[#d4a656] transition-colors duration-300" strokeWidth={1.5} />
              </div>
              <div className="font-mono text-4xl font-bold text-[#e8e6e1] mb-2 tracking-tight">
                {stat.value}
              </div>
              <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#d4a656]/80 mb-1">
                {stat.label}
              </div>
              <div className="text-xs text-[#6b6660]">
                {stat.hint}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card-vintage rounded-md p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-[1px] bg-[#d4a656]"></span>
              <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#d4a656]">
                Cases in Session
              </span>
            </div>
            <h2 className="font-heading text-4xl font-semibold text-[#e8e6e1]">Active Investigations</h2>
          </div>
          <button
            onClick={() => navigate('/tracker')}
            data-testid="add-account-nav-btn"
            className="btn-detective flex items-center gap-2 px-5 py-2.5 rounded-md text-sm"
          >
            <span>Open New Case</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-md skeleton"></div>
            ))}
          </div>
        ) : trackedAccounts.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-[#1f1f1f] rounded-md relative">
            <div className="absolute inset-0 animate-shimmer opacity-30 rounded-md pointer-events-none"></div>
            <div className="font-heading text-3xl text-[#8a857e] mb-3">The office is quiet.</div>
            <p className="text-sm text-[#6b6660] mb-6 max-w-md mx-auto">
              Begin an investigation by tracking any public Instagram profile.
              We'll observe, record, and analyze — you get the intelligence.
            </p>
            <button
              onClick={() => navigate('/tracker')}
              data-testid="add-first-account-btn"
              className="btn-detective px-6 py-3 rounded-md text-sm"
            >
              Open First Case
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trackedAccounts.map((account, idx) => {
              const profile = profiles[account.username];
              const caseId = `#${String(idx + 1).padStart(4, '0')}`;
              return (
                <div
                  key={account.id}
                  data-testid={`account-card-${account.username}`}
                  onClick={() => navigate('/tracker')}
                  className="cursor-pointer bg-[#111111] border border-[#1f1f1f] hover:border-[#d4a656] rounded-md p-5 transition-all duration-300 group"
                  style={{ animation: `fadeInUp 0.4s ease-out ${idx * 0.05}s backwards` }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {profile?.profile_pic ? (
                        <img
                          src={proxyImage(profile.profile_pic)}
                          alt={account.username}
                          className="w-12 h-12 rounded-full border border-[#d4a656]/40 object-cover ring-2 ring-transparent group-hover:ring-[#d4a656]/20 transition-all"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-[#1a1613] border border-[#2a2622] flex items-center justify-center">
                          <span className="text-[#d4a656] font-mono text-lg">
                            {account.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm font-semibold text-[#e8e6e1] truncate">
                          @{account.username}
                        </div>
                        {profile?.full_name && (
                          <div className="text-xs text-[#8a857e] truncate">{profile.full_name}</div>
                        )}
                      </div>
                    </div>
                    <span className="text-[9px] font-mono text-[#4a4640]">{caseId}</span>
                  </div>

                  {profile ? (
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#1f1f1f]">
                      <div>
                        <div className="font-mono text-sm text-[#e8e6e1]">{formatNumber(profile.posts)}</div>
                        <div className="text-[9px] uppercase text-[#6b6660] font-mono tracking-wider">Posts</div>
                      </div>
                      <div>
                        <div className="font-mono text-sm text-[#d4a656]">{formatNumber(profile.followers)}</div>
                        <div className="text-[9px] uppercase text-[#6b6660] font-mono tracking-wider">Followers</div>
                      </div>
                      <div>
                        <div className="font-mono text-sm text-[#e8e6e1]">{formatNumber(profile.following)}</div>
                        <div className="text-[9px] uppercase text-[#6b6660] font-mono tracking-wider">Following</div>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-3 border-t border-[#1f1f1f]">
                      <div className="h-4 skeleton rounded-sm"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
