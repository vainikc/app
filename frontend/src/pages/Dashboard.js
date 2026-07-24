import { useEffect, useState } from 'react';
import axios from 'axios';
import { Users, TrendingUp, Activity, Sparkles, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
    { label: 'Tracked', value: trackedAccounts.length, icon: Users, hint: 'Cases active' },
    { label: 'Followers', value: formatNumber(totalFollowers), icon: TrendingUp, hint: 'Combined reach' },
    { label: 'Following', value: formatNumber(totalFollowing), icon: Activity, hint: 'Total connections' },
    { label: 'Posts', value: formatNumber(totalPosts), icon: Sparkles, hint: 'Content indexed' },
  ];

  return (
    <div className="p-10 max-w-[1600px]">
      <div className="mb-10">
        <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#d4a656] mb-3">
          Case File — Overview
        </div>
        <h1 className="font-heading text-5xl sm:text-6xl font-semibold tracking-tight text-[#e8e6e1] mb-2">
          Dashboard
        </h1>
        <p className="text-[#8a857e] max-w-2xl">
          A quiet room, a lamp, and the whole city of Instagram to observe. Here's what the data whispers today.
        </p>
        <div className="divider-ornate mt-6 max-w-md"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              data-testid={`stat-card-${stat.label.toLowerCase()}`}
              className="card-detective rounded-md p-6"
              style={{ animation: `fadeInUp 0.4s ease-out ${idx * 0.05}s backwards` }}
            >
              <div className="flex items-start justify-between mb-6">
                <div className="w-10 h-10 rounded-md flex items-center justify-center bg-[#1a1613] border border-[#2a2622]">
                  <Icon className="w-5 h-5 text-[#d4a656]" strokeWidth={1.5} />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#6b6660]">
                  {stat.hint}
                </span>
              </div>
              <div className="font-mono text-4xl font-bold text-[#e8e6e1] mb-2">
                {stat.value}
              </div>
              <div className="text-xs font-mono uppercase tracking-[0.2em] text-[#8a857e]">
                {stat.label}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card-detective rounded-md p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-heading text-3xl font-semibold text-[#e8e6e1]">Active Cases</h2>
            <p className="text-sm text-[#8a857e] mt-1">Accounts under observation</p>
          </div>
          <button
            onClick={() => navigate('/tracker')}
            data-testid="add-account-nav-btn"
            className="flex items-center gap-2 px-5 py-2.5 bg-[#d4a656] hover:bg-[#c48f3e] text-[#0a0a0a] font-medium rounded-md transition-colors duration-200"
          >
            <span className="text-sm">New Case</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <div className="text-[#6b6660] text-sm">Loading intelligence...</div>
          </div>
        ) : trackedAccounts.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-[#1f1f1f] rounded-md">
            <div className="font-heading text-2xl text-[#8a857e] mb-3">No cases open</div>
            <p className="text-sm text-[#6b6660] mb-6">Begin an investigation by tracking an Instagram profile.</p>
            <button
              onClick={() => navigate('/tracker')}
              data-testid="add-first-account-btn"
              className="px-6 py-3 bg-[#d4a656] hover:bg-[#c48f3e] text-[#0a0a0a] font-medium rounded-md transition-colors duration-200"
            >
              Open First Case
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trackedAccounts.map((account, idx) => {
              const profile = profiles[account.username];
              return (
                <div
                  key={account.id}
                  data-testid={`account-card-${account.username}`}
                  onClick={() => navigate('/tracker')}
                  className="cursor-pointer bg-[#111111] border border-[#1f1f1f] hover:border-[#d4a656] rounded-md p-5 transition-colors duration-200"
                  style={{ animation: `fadeInUp 0.4s ease-out ${idx * 0.05}s backwards` }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    {profile?.profile_pic ? (
                      <img
                        src={profile.profile_pic}
                        alt={account.username}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-full border border-[#d4a656]/40 object-cover"
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

                  {profile ? (
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#1f1f1f]">
                      <div>
                        <div className="font-mono text-sm text-[#e8e6e1]">{formatNumber(profile.posts)}</div>
                        <div className="text-[10px] uppercase text-[#6b6660] font-mono">Posts</div>
                      </div>
                      <div>
                        <div className="font-mono text-sm text-[#d4a656]">{formatNumber(profile.followers)}</div>
                        <div className="text-[10px] uppercase text-[#6b6660] font-mono">Followers</div>
                      </div>
                      <div>
                        <div className="font-mono text-sm text-[#e8e6e1]">{formatNumber(profile.following)}</div>
                        <div className="text-[10px] uppercase text-[#6b6660] font-mono">Following</div>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-3 border-t border-[#1f1f1f]">
                      <div className="text-xs text-[#6b6660]">Loading profile...</div>
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
