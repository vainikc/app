import { useEffect, useState } from 'react';
import axios from 'axios';
import { Heart, MessageCircle, Image as ImageIcon, ExternalLink, Film, ChevronDown } from 'lucide-react';
import { proxyImage } from '@/lib/imageProxy';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const formatNumber = (n) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n ?? 0);
};

const formatDate = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString();
  } catch { return ''; }
};

const ActivityFeed = () => {
  const [trackedAccounts, setTrackedAccounts] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [activities, setActivities] = useState({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [selectedFilter, setSelectedFilter] = useState('all');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const res = await axios.get(`${API}/accounts`);
      setTrackedAccounts(res.data);
      setLoading(false);
      // Init all sections expanded
      const initExpanded = {};
      res.data.forEach(acc => { initExpanded[acc.username] = true; });
      setExpanded(initExpanded);
      // Fetch in parallel
      res.data.forEach((acc) => {
        fetchProfile(acc.username);
        fetchActivity(acc.username);
      });
    } catch (error) {
      console.error('Error:', error);
      setLoading(false);
    }
  };

  const fetchProfile = async (username) => {
    try {
      const res = await axios.get(`${API}/profile/${username}`);
      setProfiles((prev) => ({ ...prev, [username]: res.data }));
    } catch (e) { console.error(e); }
  };

  const fetchActivity = async (username) => {
    try {
      const res = await axios.get(`${API}/profile/${username}/activity`);
      setActivities((prev) => ({ ...prev, [username]: res.data }));
    } catch (error) {
      console.error(`Activity error for ${username}:`, error);
    }
  };

  const toggle = (username) => {
    setExpanded((e) => ({ ...e, [username]: !e[username] }));
  };

  const visible = selectedFilter === 'all'
    ? trackedAccounts
    : trackedAccounts.filter(a => a.username === selectedFilter);

  return (
    <div className="p-10 max-w-[1600px]">
      <div className="mb-8">
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-white mb-3">
          Activity
        </h1>
        <p className="text-[15px] text-[#a1a1aa] max-w-2xl leading-relaxed">
          Recent posts from each tracked profile, grouped by account.
        </p>
      </div>

      {loading ? (
        <div className="card-modern rounded-lg p-12 text-center text-[#a1a1aa]">Loading activity…</div>
      ) : trackedAccounts.length === 0 ? (
        <div className="card-modern rounded-lg p-16 text-center">
          <div className="text-lg text-white mb-2">Nothing to observe</div>
          <p className="text-sm text-[#a1a1aa]">Track a profile to see activity here.</p>
        </div>
      ) : (
        <>
          {/* Filter chips */}
          <div className="flex gap-2 mb-6 flex-wrap">
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                selectedFilter === 'all'
                  ? 'bg-white text-black border-white'
                  : 'bg-transparent text-[#a1a1aa] border-[#1f1f1f] hover:text-white hover:border-[#333]'
              }`}
            >
              All ({trackedAccounts.length})
            </button>
            {trackedAccounts.map((a) => (
              <button
                key={a.username}
                data-testid={`filter-${a.username}`}
                onClick={() => setSelectedFilter(a.username)}
                className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors border ${
                  selectedFilter === a.username
                    ? 'bg-white text-black border-white'
                    : 'bg-transparent text-[#a1a1aa] border-[#1f1f1f] hover:text-white hover:border-[#333]'
                }`}
              >
                @{a.username}
              </button>
            ))}
          </div>

          {/* Per-profile sections */}
          <div className="space-y-4">
            {visible.map((account) => {
              const profile = profiles[account.username];
              const posts = activities[account.username] || [];
              const isOpen = expanded[account.username] !== false;
              return (
                <div
                  key={account.id}
                  data-testid={`activity-section-${account.username}`}
                  className="card-modern rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggle(account.username)}
                    className="w-full flex items-center gap-4 p-5 hover:bg-[#0f0f0f] transition-colors"
                  >
                    {profile?.profile_pic ? (
                      <img
                        src={proxyImage(profile.profile_pic)}
                        alt={account.username}
                        className="w-12 h-12 rounded-full object-cover border border-[#262626]"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[#141414] border border-[#262626] flex items-center justify-center">
                        <span className="text-[#a1a1aa] font-mono text-sm">
                          {account.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 text-left">
                      <div className="font-mono text-sm font-semibold text-white">@{account.username}</div>
                      {profile?.full_name && (
                        <div className="text-xs text-[#737373]">{profile.full_name}</div>
                      )}
                    </div>
                    <div className="text-xs text-[#a1a1aa]">
                      {posts.length} {posts.length === 1 ? 'post' : 'posts'}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-[#737373] transition-transform ${isOpen ? 'rotate-180' : ''}`} strokeWidth={1.75} />
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5">
                      {!activities[account.username] ? (
                        <div className="text-xs text-[#737373] py-4">Loading posts…</div>
                      ) : posts.length === 0 ? (
                        <div className="text-xs text-[#737373] py-4">No recent posts.</div>
                      ) : (
                        <div className="space-y-2">
                          {posts.map((activity, idx) => (
                            <a
                              key={`${account.username}-${idx}`}
                              href={activity.post_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              data-testid={`activity-item-${account.username}-${idx}`}
                              className="flex items-start gap-3 p-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-md hover:border-[#333] transition-colors group"
                            >
                              {activity.media_url ? (
                                <img
                                  src={proxyImage(activity.media_url)}
                                  alt=""
                                  className="w-16 h-16 rounded-md object-cover border border-[#262626] shrink-0"
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                />
                              ) : (
                                <div className="w-16 h-16 rounded-md bg-[#141414] border border-[#262626] flex items-center justify-center shrink-0">
                                  <ImageIcon className="w-5 h-5 text-[#737373]" strokeWidth={1.5} />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] font-mono uppercase tracking-wide text-white bg-white/10 px-2 py-0.5 rounded">
                                    {activity.post_type}
                                  </span>
                                  {activity.post_type === 'Video' && <Film className="w-3 h-3 text-white" />}
                                  <span className="text-[10px] text-[#525252] ml-auto">{formatDate(activity.timestamp)}</span>
                                </div>
                                <p className="text-sm text-[#d4d4d8] line-clamp-2 mb-2 leading-relaxed">
                                  {activity.content || 'New post'}
                                </p>
                                <div className="flex items-center gap-4 text-xs text-[#737373]">
                                  <div className="flex items-center gap-1">
                                    <Heart className="w-3 h-3" strokeWidth={2} />
                                    <span className="font-mono">{formatNumber(activity.likes)}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <MessageCircle className="w-3 h-3" strokeWidth={2} />
                                    <span className="font-mono">{formatNumber(activity.comments)}</span>
                                  </div>
                                  <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                    <span className="text-[10px] font-mono uppercase text-white">Open</span>
                                    <ExternalLink className="w-3 h-3 text-white" />
                                  </div>
                                </div>
                              </div>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default ActivityFeed;
