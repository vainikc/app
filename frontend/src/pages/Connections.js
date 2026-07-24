import { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, UserMinus, Users, UserCheck, ShieldCheck, Lock, RefreshCw, Info, MessageSquare, Heart, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { proxyImage } from '@/lib/imageProxy';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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

const TIME_RANGES = [
  { value: '1', label: 'Past 24 hours' },
  { value: '7', label: 'Past week' },
  { value: '30', label: 'Past month' },
  { value: '90', label: 'Past 3 months' },
  { value: '0', label: 'Since last check' },
];

const Connections = () => {
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState('');
  const [tab, setTab] = useState('following'); // Default to Following since that's what user wants
  const [timeRange, setTimeRange] = useState('7'); // Past week default
  const [followersData, setFollowersData] = useState(null);
  const [followingData, setFollowingData] = useState(null);
  const [commentsData, setCommentsData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await axios.get(`${API}/accounts`);
      setAccounts(res.data);
      if (res.data.length > 0) setSelected(res.data[0].username);
    } catch (e) { console.error(e); }
  };

  const runFetch = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      if (tab === 'followers') {
        const res = await axios.get(`${API}/profile/${selected}/followers-list?limit=100&since_days=${timeRange}`);
        setFollowersData(res.data);
        if (res.data.quota_exhausted) {
          toast.error('Apify quota reached — try again later.');
        } else {
          toast.success(`Loaded ${res.data.current.length} followers`);
        }
      } else if (tab === 'following') {
        const res = await axios.get(`${API}/profile/${selected}/following-list?limit=100&since_days=${timeRange}`);
        setFollowingData(res.data);
        if (res.data.quota_exhausted) {
          toast.error('Apify quota reached — try again later.');
        } else {
          toast.success(`Loaded ${res.data.current.length} accounts`);
        }
      } else if (tab === 'comments') {
        const res = await axios.get(`${API}/profile/${selected}/post-comments?posts_limit=3&comments_limit=25`);
        setCommentsData(res.data);
        toast.success(`Loaded ${res.data.length} comments`);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to fetch');
    }
    setLoading(false);
  };

  const tabs = [
    { id: 'following', label: 'Recently Followed', icon: UserCheck, num: '01' },
    { id: 'followers', label: 'Followers', icon: Users, num: '02' },
    { id: 'comments', label: 'Comments on Posts', icon: MessageSquare, num: '03' },
  ];

  const currentData = tab === 'followers' ? followersData : tab === 'following' ? followingData : commentsData;
  const showTimeRange = tab === 'followers' || tab === 'following';

  return (
    <div className="p-10 max-w-[1600px]">
      <div className="mb-10">
        <div className="mb-3">
          <span className="corner-ornament text-[10px] font-mono uppercase tracking-[0.3em] text-[#d4a656] pl-6">
            Deep Dive Intelligence
          </span>
        </div>
        <h1 className="font-heading text-6xl font-semibold tracking-tight text-[#e8e6e1] mb-2 text-glow-amber">
          Connections
        </h1>
        <p className="text-[#8a857e] max-w-2xl">
          Who they've recently followed, who follows them, and public comments on their posts —
          all ordered by recency.
        </p>
        <div className="divider-ornate mt-6 max-w-md"></div>
      </div>

      {accounts.length === 0 ? (
        <div className="card-vintage rounded-md p-12 text-center">
          <div className="font-heading text-2xl text-[#8a857e]">No cases to inspect.</div>
          <p className="text-sm text-[#6b6660] mt-2">Track a profile first to explore its connections.</p>
        </div>
      ) : (
        <>
          {/* Case + Time Range selector */}
          <div className="card-vintage rounded-md p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#6b6660] mb-2">Investigate Case</div>
                <Select value={selected} onValueChange={setSelected}>
                  <SelectTrigger
                    data-testid="connections-account-select"
                    className="bg-[#0f0f0f] border-[#1f1f1f] text-[#e8e6e1] font-mono h-11"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141414] border-[#1f1f1f]">
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.username} className="text-[#e8e6e1] focus:bg-[#1a1613] focus:text-[#d4a656] font-mono">
                        @{a.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {showTimeRange && (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#6b6660] mb-2">Time Range</div>
                  <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger
                      data-testid="time-range-select"
                      className="bg-[#0f0f0f] border-[#1f1f1f] text-[#e8e6e1] font-mono h-11"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#141414] border-[#1f1f1f]">
                      {TIME_RANGES.map((r) => (
                        <SelectItem key={r.value} value={r.value} className="text-[#e8e6e1] focus:bg-[#1a1613] focus:text-[#d4a656] font-mono">
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-[#6b6660] flex items-start gap-2 flex-1 min-w-[300px]">
                <Info className="w-3 h-3 mt-0.5 shrink-0 text-[#d4a656]" />
                Instagram returns following lists in reverse-chronological order —
                position #1 is most recently followed. Fetch may take 30-90 seconds.
              </p>
              <Button
                data-testid="fetch-connections-btn"
                onClick={runFetch}
                disabled={loading || !selected}
                className="btn-detective px-6 py-2.5 rounded-md text-sm"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Fetching...' : 'Fetch Live Data'}
              </Button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  data-testid={`tab-${t.id}`}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-md text-sm transition-all duration-200 border ${
                    active
                      ? 'bg-[#1a1613] border-[#d4a656] text-[#d4a656]'
                      : 'bg-[#0f0f0f] border-[#1f1f1f] text-[#8a857e] hover:text-[#e8e6e1] hover:border-[#2a2622]'
                  }`}
                >
                  <span className={`text-[9px] font-mono ${active ? 'text-[#d4a656]/60' : 'text-[#4a4640]'}`}>{t.num}</span>
                  <Icon className="w-4 h-4" strokeWidth={1.5} />
                  <span className="font-medium">{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Disclaimer */}
          <div className="card-vintage rounded-md p-4 mb-6 border-l-2 border-l-[#c15147]/40">
            <div className="flex items-start gap-3">
              <Info className="w-4 h-4 text-[#c15147]/70 mt-0.5 shrink-0" />
              <div className="text-xs text-[#8a857e]">
                <strong className="text-[#c9c5be]">Note:</strong> Instagram does not publicly expose two things:
                (1) comments this user has made on <em>other</em> people's posts, and
                (2) posts this user has liked. Everything shown below is real, live, and public.
              </div>
            </div>
          </div>

          {/* Tab content */}
          {loading ? (
            <div className="card-vintage rounded-md p-12 text-center text-[#6b6660]">
              <RefreshCw className="w-6 h-6 mx-auto mb-3 animate-spin text-[#d4a656]" />
              Interrogating Instagram's public archive...
            </div>
          ) : !currentData ? (
            <div className="card-vintage rounded-md p-16 text-center">
              <div className="font-heading text-2xl text-[#8a857e] mb-2">No data yet.</div>
              <p className="text-sm text-[#6b6660]">Click "Fetch Live Data" to pull the {tab === 'comments' ? 'comments' : `${tab} list`}.</p>
            </div>
          ) : tab === 'following' ? (
            <FollowingView data={currentData} timeRange={timeRange} />
          ) : tab === 'followers' ? (
            <FollowersView data={currentData} timeRange={timeRange} />
          ) : (
            <CommentsView comments={currentData} />
          )}
        </>
      )}
    </div>
  );
};


const FollowingView = ({ data, timeRange }) => {
  if (data.quota_exhausted) {
    return <QuotaExhausted type="following" />;
  }

  const period = data.comparison_period;
  const hasBaseline = data.has_baseline;
  const hasCountBaseline = data.has_count_baseline;
  const recentlyFollowed = data.added_details || [];
  const mostRecent = data.most_recent || [];
  const netChange = data.net_change;
  const profileCount = data.profile_count ?? data.total_count;
  const sampleCount = data.sample_count ?? mostRecent.length;

  // Format net change with sign, or "—" if unknown
  const netAdded = netChange != null && netChange > 0 ? netChange : (hasBaseline ? recentlyFollowed.length : null);
  const netLost = netChange != null && netChange < 0 ? Math.abs(netChange) : (hasBaseline ? (data.removed_usernames?.length || 0) : null);

  return (
    <>
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={UserCheck}
          value={profileCount?.toLocaleString() ?? '—'}
          label="Total Following"
          color="#d4a656"
          bg="#1a1613"
          border="#2a2622"
          sublabel={sampleCount < profileCount ? `Showing ${sampleCount} of ${profileCount.toLocaleString()}` : null}
        />
        <StatCard
          icon={UserPlus}
          value={netAdded != null ? `+${netAdded}` : '—'}
          label={`Followed in ${period}`}
          color="#7d9c60"
          bg="#0f2211"
          border="#1e3e21"
          sublabel={netAdded == null ? 'Need baseline data' : null}
        />
        <StatCard
          icon={UserMinus}
          value={netLost != null ? `-${netLost}` : '—'}
          label={`Unfollowed in ${period}`}
          color="#c15147"
          bg="#221010"
          border="#3e1e1e"
          sublabel={netLost == null ? 'Need baseline data' : null}
        />
      </div>

      {/* Baseline warning */}
      {!hasBaseline && !hasCountBaseline && (
        <div className="card-vintage rounded-md p-4 mb-6 border-l-2 border-l-[#f59e0b]">
          <div className="flex items-start gap-3">
            <Clock className="w-4 h-4 text-[#f59e0b] mt-0.5 shrink-0" />
            <div className="text-xs text-[#c9c5be]">
              <strong className="text-[#f59e0b]">No historical baseline for {period}.</strong> The scheduler snapshots every 6 hours, so after {period} the "Followed/Unfollowed" numbers will populate.
              Meanwhile, the "Most Recently Followed" list below is always live-accurate — Instagram returns the following list newest-first.
            </div>
          </div>
        </div>
      )}
      {!hasBaseline && hasCountBaseline && netChange != null && (
        <div className="card-vintage rounded-md p-4 mb-6 border-l-2 border-l-[#d4a656]/60">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-[#d4a656] mt-0.5 shrink-0" />
            <div className="text-xs text-[#c9c5be]">
              <strong className="text-[#d4a656]">Numeric baseline only.</strong> We know the count changed by {netChange > 0 ? `+${netChange}` : netChange} in the {period}, but the full-list baseline needed to identify <em>which</em> accounts were followed/unfollowed doesn't exist yet. Fetch again in {period.replace('past ', '')} to get named additions/removals.
            </div>
          </div>
        </div>
      )}

      {/* Recently followed (diff-based) */}
      {recentlyFollowed.length > 0 && (
        <div className="card-vintage rounded-md p-6 mb-6 border-l-2 border-l-[#7d9c60]">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-heading text-2xl font-semibold text-[#e8e6e1] flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#7d9c60]" />
                Followed in the {period}
              </h3>
              <p className="text-xs text-[#6b6660] mt-1">Ordered by recency — position #1 is most recent</p>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#7d9c60] bg-[#0f2211] px-3 py-1 rounded-full border border-[#1e3e21]">
              {recentlyFollowed.length} new
            </span>
          </div>
          <div className="space-y-2">
            {recentlyFollowed.map((u, idx) => (
              <UserRow key={u.username} user={u} index={idx + 1} highlight="new" />
            ))}
          </div>
        </div>
      )}

      {/* Most Recent Follows (always available - top of current list) */}
      <div className="card-vintage rounded-md p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-heading text-2xl font-semibold text-[#e8e6e1] flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#d4a656]" />
              Most Recently Followed
            </h3>
            <p className="text-xs text-[#6b6660] mt-1">Live list from Instagram — position #1 = most recent</p>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#d4a656] bg-[#1a1613] px-3 py-1 rounded-full border border-[#2a2622]">
            Top {mostRecent.length}
          </span>
        </div>
        {mostRecent.length === 0 ? (
          <p className="text-sm text-[#6b6660]">No data.</p>
        ) : (
          <div className="space-y-2">
            {mostRecent.map((u, idx) => (
              <UserRow key={u.username} user={u} index={idx + 1} />
            ))}
          </div>
        )}
      </div>

      {/* Unfollowed */}
      {data.removed_usernames && data.removed_usernames.length > 0 && (
        <div className="card-vintage rounded-md p-6 mb-6 border-l-2 border-l-[#c15147]/50">
          <h3 className="font-heading text-2xl font-semibold text-[#e8e6e1] mb-4 flex items-center gap-2">
            <UserMinus className="w-5 h-5 text-[#c15147]" />
            Unfollowed in the {period}
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.removed_usernames.map((u) => (
              <a
                key={u}
                href={`https://www.instagram.com/${u}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-[#c15147] hover:text-[#e6746a] px-3 py-1.5 bg-[#221010] border border-[#3e1e1e] rounded-full transition-colors"
              >
                @{u}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Full list collapsed */}
      <details className="card-vintage rounded-md p-6">
        <summary className="cursor-pointer flex items-center justify-between text-[#c9c5be] hover:text-[#d4a656]">
          <span className="font-heading text-xl font-semibold">All Following ({data.current.length}{profileCount > data.current.length ? ` of ${profileCount.toLocaleString()}` : ''})</span>
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#6b6660]">Click to expand</span>
        </summary>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-2">
          {data.current.map((u) => (
            <UserCard key={u.username} user={u} />
          ))}
        </div>
      </details>
    </>
  );
};


const FollowersView = ({ data, timeRange }) => {
  if (data.quota_exhausted) {
    return <QuotaExhausted type="followers" />;
  }
  const period = data.comparison_period;
  const hasBaseline = data.has_baseline;
  const hasCountBaseline = data.has_count_baseline;
  const netChange = data.net_change;
  const profileCount = data.profile_count ?? data.total_count;
  const sampleCount = data.sample_count ?? data.current.length;

  const netAdded = netChange != null && netChange > 0 ? netChange : (hasBaseline ? (data.added_details?.length || 0) : null);
  const netLost = netChange != null && netChange < 0 ? Math.abs(netChange) : (hasBaseline ? (data.removed_usernames?.length || 0) : null);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={Users}
          value={profileCount?.toLocaleString() ?? '—'}
          label="Current Followers"
          color="#d4a656"
          bg="#1a1613"
          border="#2a2622"
          sublabel={sampleCount < profileCount ? `Showing ${sampleCount} of ${profileCount.toLocaleString()}` : null}
        />
        <StatCard
          icon={UserPlus}
          value={netAdded != null ? `+${netAdded}` : '—'}
          label={`New in ${period}`}
          color="#7d9c60"
          bg="#0f2211"
          border="#1e3e21"
          sublabel={netAdded == null ? 'Need baseline data' : null}
        />
        <StatCard
          icon={UserMinus}
          value={netLost != null ? `-${netLost}` : '—'}
          label={`Lost in ${period}`}
          color="#c15147"
          bg="#221010"
          border="#3e1e1e"
          sublabel={netLost == null ? 'Need baseline data' : null}
        />
      </div>

      {/* Baseline banners (same as FollowingView) */}
      {!hasBaseline && !hasCountBaseline && (
        <div className="card-vintage rounded-md p-4 mb-6 border-l-2 border-l-[#f59e0b]">
          <div className="flex items-start gap-3">
            <Clock className="w-4 h-4 text-[#f59e0b] mt-0.5 shrink-0" />
            <div className="text-xs text-[#c9c5be]">
              <strong className="text-[#f59e0b]">No historical baseline for {period}.</strong> The scheduler snapshots every 6 hours, so after {period} the "New/Lost" numbers will populate.
            </div>
          </div>
        </div>
      )}
      {!hasBaseline && hasCountBaseline && netChange != null && (
        <div className="card-vintage rounded-md p-4 mb-6 border-l-2 border-l-[#d4a656]/60">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-[#d4a656] mt-0.5 shrink-0" />
            <div className="text-xs text-[#c9c5be]">
              <strong className="text-[#d4a656]">Numeric baseline only.</strong> We know the count changed by {netChange > 0 ? `+${netChange}` : netChange} in the {period}, but the full-list baseline needed to identify <em>which</em> accounts followed/unfollowed doesn't exist yet. Fetch again in {period.replace('past ', '')} to get named additions/removals.
            </div>
          </div>
        </div>
      )}

      {data.added_details && data.added_details.length > 0 && (
        <div className="card-vintage rounded-md p-6 mb-6 border-l-2 border-l-[#7d9c60]">
          <h3 className="font-heading text-2xl font-semibold text-[#e8e6e1] mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#7d9c60]" />
            New Followers in the {period}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.added_details.map((u) => (
              <UserCard key={u.username} user={u} highlight="new" />
            ))}
          </div>
        </div>
      )}

      {data.removed_usernames && data.removed_usernames.length > 0 && (
        <div className="card-vintage rounded-md p-6 mb-6 border-l-2 border-l-[#c15147]/50">
          <h3 className="font-heading text-2xl font-semibold text-[#e8e6e1] mb-4 flex items-center gap-2">
            <UserMinus className="w-5 h-5 text-[#c15147]" />
            Lost Followers in the {period}
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.removed_usernames.map((u) => (
              <a key={u} href={`https://www.instagram.com/${u}/`} target="_blank" rel="noopener noreferrer" className="font-mono text-sm text-[#c15147] hover:text-[#e6746a] px-3 py-1.5 bg-[#221010] border border-[#3e1e1e] rounded-full transition-colors">
                @{u}
              </a>
            ))}
          </div>
        </div>
      )}

      <details className="card-vintage rounded-md p-6" open>
        <summary className="cursor-pointer flex items-center justify-between text-[#c9c5be] hover:text-[#d4a656]">
          <span className="font-heading text-xl font-semibold">All Followers ({data.current.length}{profileCount > data.current.length ? ` of ${profileCount.toLocaleString()}` : ''})</span>
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#6b6660]">Public sample</span>
        </summary>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-2">
          {data.current.map((u) => (
            <UserCard key={u.username} user={u} />
          ))}
        </div>
      </details>
    </>
  );
};


const StatCard = ({ icon: Icon, value, label, color, bg, border, sublabel }) => (
  <div className="card-vintage rounded-md p-5">
    <div className="flex items-center justify-between mb-3">
      <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ background: bg, border: `1px solid ${border}` }}>
        <Icon className="w-4 h-4" style={{ color }} strokeWidth={1.5} />
      </div>
    </div>
    <div className="font-mono text-3xl font-bold" style={{ color }}>{value}</div>
    <div className="text-[10px] font-mono uppercase tracking-widest text-[#6b6660] mt-1">{label}</div>
    {sublabel && (
      <div className="text-[10px] text-[#6b6660] mt-1 italic">{sublabel}</div>
    )}
  </div>
);


const UserRow = ({ user, index, highlight }) => (
  <a
    href={`https://www.instagram.com/${user.username}/`}
    target="_blank"
    rel="noopener noreferrer"
    className={`flex items-center gap-4 p-3 bg-[#111111] border rounded-md hover:border-[#d4a656] transition-colors group ${
      highlight === 'new' ? 'border-[#7d9c60]/40' : 'border-[#1f1f1f]'
    }`}
  >
    <span className={`font-mono text-xs w-8 text-center ${index <= 3 ? 'text-[#d4a656] font-bold' : 'text-[#4a4640]'}`}>
      #{String(index).padStart(2, '0')}
    </span>
    {user.profile_pic ? (
      <img
        src={proxyImage(user.profile_pic)}
        alt=""
        className="w-10 h-10 rounded-full object-cover border border-[#2a2622] shrink-0"
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    ) : (
      <div className="w-10 h-10 rounded-full bg-[#1a1613] border border-[#2a2622] flex items-center justify-center shrink-0">
        <span className="text-[#d4a656] font-mono text-sm">{(user.username || '?').charAt(0).toUpperCase()}</span>
      </div>
    )}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-sm font-semibold text-[#e8e6e1] truncate">@{user.username}</span>
        {user.is_verified && <ShieldCheck className="w-3.5 h-3.5 text-[#d4a656] shrink-0" strokeWidth={2} />}
        {user.is_private && <Lock className="w-3 h-3 text-[#8a857e] shrink-0" />}
      </div>
      {user.full_name && <div className="text-xs text-[#8a857e] truncate">{user.full_name}</div>}
    </div>
    {highlight === 'new' && (
      <span className="text-[9px] font-mono uppercase tracking-widest text-[#7d9c60] bg-[#0f2211] px-2 py-1 rounded-full border border-[#1e3e21]">
        NEW
      </span>
    )}
  </a>
);


const UserCard = ({ user, highlight }) => (
  <a
    href={`https://www.instagram.com/${user.username}/`}
    target="_blank"
    rel="noopener noreferrer"
    className={`flex items-center gap-3 p-3 bg-[#111111] border rounded-md hover:border-[#d4a656] transition-colors ${
      highlight === 'new' ? 'border-[#7d9c60]/40' : 'border-[#1f1f1f]'
    }`}
  >
    {user.profile_pic ? (
      <img
        src={proxyImage(user.profile_pic)}
        alt=""
        className="w-10 h-10 rounded-full object-cover border border-[#2a2622]"
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    ) : (
      <div className="w-10 h-10 rounded-full bg-[#1a1613] border border-[#2a2622] flex items-center justify-center shrink-0">
        <span className="text-[#d4a656] font-mono text-sm">{(user.username || '?').charAt(0).toUpperCase()}</span>
      </div>
    )}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1">
        <div className="font-mono text-xs font-semibold text-[#e8e6e1] truncate">@{user.username}</div>
        {user.is_verified && <ShieldCheck className="w-3 h-3 text-[#d4a656] shrink-0" strokeWidth={2} />}
        {user.is_private && <Lock className="w-2.5 h-2.5 text-[#8a857e] shrink-0" />}
      </div>
      {user.full_name && <div className="text-[11px] text-[#8a857e] truncate">{user.full_name}</div>}
    </div>
  </a>
);


const QuotaExhausted = ({ type }) => (
  <div className="card-vintage rounded-md p-12 text-center border-l-2 border-l-[#f59e0b]">
    <div className="font-heading text-2xl text-[#f59e0b] mb-3">Apify Daily Quota Reached</div>
    <p className="text-sm text-[#8a857e] max-w-md mx-auto">
      The free-tier Apify actor for {type} lists is limited to a few runs per day.
      Try again after 00:00 UTC when the quota resets, or upgrade your Apify plan for higher limits.
    </p>
  </div>
);


const CommentsView = ({ comments }) => {
  if (!comments || comments.length === 0) {
    return (
      <div className="card-vintage rounded-md p-12 text-center text-[#6b6660]">
        No comments found on recent posts.
      </div>
    );
  }
  return (
    <div className="card-vintage rounded-md p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-heading text-xl font-semibold text-[#e8e6e1]">
          Recent Comments ({comments.length})
        </h3>
        <span className="text-[10px] font-mono uppercase tracking-widest text-[#6b6660]">Sorted by likes</span>
      </div>
      <div className="space-y-3">
        {comments.map((c, idx) => (
          <div
            key={c.id || idx}
            data-testid={`comment-${idx}`}
            className="flex items-start gap-4 p-4 bg-[#111111] border border-[#1f1f1f] rounded-md hover:border-[#d4a656]/40 transition-colors"
          >
            {c.post_thumbnail && (
              <a href={c.post_url} target="_blank" rel="noopener noreferrer" className="w-16 h-16 rounded-sm overflow-hidden border border-[#2a2622] shrink-0">
                <img src={proxyImage(c.post_thumbnail)} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
              </a>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {c.author_pic && (
                  <img src={proxyImage(c.author_pic)} alt="" className="w-5 h-5 rounded-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                )}
                <a href={`https://www.instagram.com/${c.author}/`} target="_blank" rel="noopener noreferrer" className="font-mono text-sm font-semibold text-[#e8e6e1] hover:text-[#d4a656]">
                  @{c.author}
                </a>
                <span className="text-[10px] text-[#6b6660]">{formatDate(c.timestamp)}</span>
              </div>
              <p className="text-sm text-[#c9c5be] leading-relaxed">{c.text}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-[#6b6660]">
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3 text-[#c15147]" />
                  <span className="font-mono">{c.likes}</span>
                </span>
                {c.replies_count > 0 && (
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    <span className="font-mono">{c.replies_count} replies</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Connections;
