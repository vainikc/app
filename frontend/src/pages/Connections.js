import { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, UserMinus, Users, UserCheck, ShieldCheck, Lock, RefreshCw, Info, MessageSquare, Heart, Clock, Sparkles } from 'lucide-react';
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
  const [tab, setTab] = useState('following');
  const [timeRange, setTimeRange] = useState('7');
  const [followersData, setFollowersData] = useState(null);
  const [followingData, setFollowingData] = useState(null);
  const [commentsData, setCommentsData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    // Clear previous data when switching account or time range
    setFollowersData(null);
    setFollowingData(null);
  }, [selected, timeRange]);

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
        if (res.data.quota_exhausted) toast.error('Apify quota exhausted');
        else toast.success(`Loaded followers`);
      } else if (tab === 'following') {
        const res = await axios.get(`${API}/profile/${selected}/following-list?limit=100&since_days=${timeRange}`);
        setFollowingData(res.data);
        if (res.data.quota_exhausted) toast.error('Apify quota exhausted');
        else toast.success(`Loaded following`);
      } else if (tab === 'comments') {
        const res = await axios.get(`${API}/profile/${selected}/post-comments?posts_limit=3&comments_limit=25`);
        setCommentsData(res.data);
        toast.success(`${res.data.length} comments`);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to fetch');
    }
    setLoading(false);
  };

  const tabs = [
    { id: 'following', label: 'Recently followed', icon: UserCheck },
    { id: 'followers', label: 'Followers', icon: Users },
    { id: 'comments', label: 'Comments on posts', icon: MessageSquare },
  ];

  const currentData = tab === 'followers' ? followersData : tab === 'following' ? followingData : commentsData;
  const showTimeRange = tab === 'followers' || tab === 'following';

  return (
    <div className="p-10 max-w-[1600px]">
      <div className="mb-8">
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-white mb-3">
          Connections
        </h1>
        <p className="text-[15px] text-[#a1a1aa] max-w-2xl leading-relaxed">
          Who they've recently followed, who follows them, and public comments on their posts.
        </p>
      </div>

      {accounts.length === 0 ? (
        <div className="card-modern rounded-lg p-16 text-center">
          <div className="text-xl font-medium text-white mb-2">No cases to inspect</div>
          <p className="text-sm text-[#a1a1aa]">Track a profile first to explore its connections.</p>
        </div>
      ) : (
        <>
          {/* Controls */}
          <div className="card-modern rounded-lg p-5 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="md:col-span-2">
                <div className="text-xs text-[#737373] mb-2">Case</div>
                <Select value={selected} onValueChange={setSelected}>
                  <SelectTrigger data-testid="connections-account-select" className="bg-[#0a0a0a] border-[#1f1f1f] text-white font-mono h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a0a0a] border-[#1f1f1f]">
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.username} className="text-white focus:bg-[#141414] font-mono">
                        @{a.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {showTimeRange && (
                <div>
                  <div className="text-xs text-[#737373] mb-2">Time range</div>
                  <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger data-testid="time-range-select" className="bg-[#0a0a0a] border-[#1f1f1f] text-white h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0a0a0a] border-[#1f1f1f]">
                      {TIME_RANGES.map((r) => (
                        <SelectItem key={r.value} value={r.value} className="text-white focus:bg-[#141414]">
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-[#525252] flex-1 min-w-[300px]">
                Instagram returns following newest-first · Fetch takes 30–90s
              </p>
              <Button
                data-testid="fetch-connections-btn"
                onClick={runFetch}
                disabled={loading || !selected}
                className="btn-primary px-5 py-2 h-10 rounded-md text-sm"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Fetching' : 'Fetch live data'}
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  data-testid={`tab-${t.id}`}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors border ${
                    active
                      ? 'bg-white border-white text-black'
                      : 'bg-transparent border-[#1f1f1f] text-[#a1a1aa] hover:text-white hover:border-[#333]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={2} />
                  <span className="font-medium">{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Disclaimer */}
          <div className="card-modern rounded-lg p-3.5 mb-6 border-l-2 border-l-[#dc2626]/50">
            <div className="flex items-start gap-3">
              <Info className="w-3.5 h-3.5 text-[#dc2626]/80 mt-0.5 shrink-0" />
              <div className="text-xs text-[#a1a1aa]">
                Instagram doesn't publicly expose: (1) comments this user made on <em>other</em> posts, or
                (2) posts they've liked. Everything shown below is real, live, and public.
              </div>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="card-modern rounded-lg p-16 text-center text-[#a1a1aa]">
              <RefreshCw className="w-5 h-5 mx-auto mb-3 animate-spin" />
              Interrogating Instagram's public archive…
            </div>
          ) : !currentData ? (
            <div className="card-modern rounded-lg p-16 text-center">
              <div className="text-lg text-white mb-2">No data yet</div>
              <p className="text-sm text-[#a1a1aa]">
                Click <span className="text-white">Fetch live data</span> to pull the {tab === 'comments' ? 'comments' : `${tab} list`}.
              </p>
            </div>
          ) : tab === 'following' ? (
            <FollowingView data={currentData} />
          ) : tab === 'followers' ? (
            <FollowersView data={currentData} />
          ) : (
            <CommentsView comments={currentData} />
          )}
        </>
      )}
    </div>
  );
};


const BaselineBanner = ({ hasBaseline, hasCountBaseline, netChange, period, smartRecentCount }) => {
  if (!hasBaseline && !hasCountBaseline) {
    return (
      <div className="card-modern rounded-lg p-3.5 mb-4 border-l-2 border-l-[#f59e0b]/70">
        <div className="flex items-start gap-3">
          <Clock className="w-3.5 h-3.5 text-[#f59e0b] mt-0.5 shrink-0" />
          <div className="text-xs text-[#d4d4d8]">
            <strong className="text-[#f59e0b]">No baseline for {period}.</strong>{' '}
            The scheduler snapshots every 6h — come back later. Meanwhile the recency-ordered list below is always live.
          </div>
        </div>
      </div>
    );
  }
  if (!hasBaseline && hasCountBaseline && netChange != null) {
    const capped = smartRecentCount != null && smartRecentCount < Math.abs(netChange);
    return (
      <div className="card-modern rounded-lg p-3.5 mb-4 border-l-2 border-l-white/40">
        <div className="flex items-start gap-3">
          <Sparkles className="w-3.5 h-3.5 text-white mt-0.5 shrink-0" />
          <div className="text-xs text-[#d4d4d8]">
            <strong className="text-white">Smart-scoped list.</strong>{' '}
            {capped ? (
              <>
                {Math.abs(netChange)} {netChange > 0 ? 'new follows' : 'unfollows'} happened in the {period}.
                Instagram's public API caps the scrape at 200, so we're showing the {smartRecentCount} most recent —
                the rest can be surfaced once the scheduler builds a full-list baseline.
              </>
            ) : (
              <>
                We know {Math.abs(netChange)} new {netChange > 0 ? 'follows' : 'unfollows'} happened in the {period},
                so we've narrowed the scrape to exactly those {Math.abs(netChange)} accounts using Instagram's recency ordering.
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
  return null;
};


const FollowingView = ({ data }) => {
  if (data.quota_exhausted) return <QuotaExhausted type="following" />;

  const period = data.comparison_period;
  const hasBaseline = data.has_baseline;
  const hasCountBaseline = data.has_count_baseline;
  const netChange = data.net_change;
  const profileCount = data.profile_count ?? data.total_count;
  const sampleCount = data.sample_count ?? 0;
  const smartRecent = data.smart_recent || [];
  const mostRecent = data.most_recent || [];
  const removedUsernames = data.removed_usernames || [];

  const netAdded = netChange != null && netChange > 0 ? netChange : (hasBaseline ? (data.added_details?.length || 0) : null);
  const netLost = netChange != null && netChange < 0 ? Math.abs(netChange) : (hasBaseline ? removedUsernames.length : null);

  return (
    <>
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <StatCard label="Total following" value={profileCount?.toLocaleString() ?? '—'} sublabel={sampleCount < profileCount ? `Scraped ${sampleCount} of ${profileCount.toLocaleString()}` : null} />
        <StatCard label={`Followed in ${period}`} value={netAdded != null ? `+${netAdded}` : '—'} tone="pos" sublabel={netAdded == null ? 'Need baseline' : null} />
        <StatCard label={`Unfollowed in ${period}`} value={netLost != null ? `-${netLost}` : '—'} tone="neg" sublabel={netLost == null ? 'Need baseline' : null} />
      </div>

      <BaselineBanner hasBaseline={hasBaseline} hasCountBaseline={hasCountBaseline} netChange={netChange} period={period} smartRecentCount={smartRecent.length} />

      {/* SMART SCOPED - the killer feature */}
      {smartRecent.length > 0 && (
        <div className="card-modern-hi rounded-lg p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-white" />
                {smartRecent.length === netChange
                  ? `${smartRecent.length} accounts followed in the ${period}`
                  : `Top ${smartRecent.length} of ${netChange} accounts followed in the ${period}`}
              </h3>
              <p className="text-xs text-[#737373] mt-0.5">
                {smartRecent.length === netChange
                  ? 'Ordered by recency — position #1 is most recent'
                  : `Scraper capped at 200 · showing the most-recent ${smartRecent.length} of ${netChange}`}
              </p>
            </div>
            <span className="text-xs text-white bg-white/10 px-2.5 py-1 rounded font-mono">
              {smartRecent.length} NEW
            </span>
          </div>
          <div className="space-y-1.5">
            {smartRecent.map((u, idx) => (
              <UserRow key={u.username || idx} user={u} index={idx + 1} highlight="new" />
            ))}
          </div>
        </div>
      )}

      {/* Full-list diff added (only when hasBaseline) */}
      {hasBaseline && (data.added_details || []).length > 0 && smartRecent.length === 0 && (
        <div className="card-modern-hi rounded-lg p-6 mb-4">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#22c55e]" />
            New in the {period}
          </h3>
          <div className="space-y-1.5">
            {data.added_details.map((u, idx) => (
              <UserRow key={u.username || idx} user={u} index={idx + 1} highlight="new" />
            ))}
          </div>
        </div>
      )}

      {/* Unfollowed */}
      {removedUsernames.length > 0 && (
        <div className="card-modern rounded-lg p-6 mb-4 border-l-2 border-l-[#dc2626]/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <UserMinus className="w-4 h-4 text-[#dc2626]" />
            Unfollowed in the {period}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {removedUsernames.map((u) => (
              <a key={u} href={`https://www.instagram.com/${u}/`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-[#dc2626] hover:text-[#f87171] px-2.5 py-1 bg-[#1a0a0a] border border-[#3a1010] rounded transition-colors">
                @{u}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Most Recently Followed (fallback when no smart_recent) */}
      {smartRecent.length === 0 && (
        <div className="card-modern rounded-lg p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-white" />
                Most recently followed
              </h3>
              <p className="text-xs text-[#737373] mt-0.5">Top of Instagram's list — always fresh</p>
            </div>
            <span className="text-xs text-[#737373]">Top {mostRecent.length}</span>
          </div>
          {mostRecent.length === 0 ? (
            <p className="text-sm text-[#737373]">No data.</p>
          ) : (
            <div className="space-y-1.5">
              {mostRecent.map((u, idx) => (
                <UserRow key={u.username || idx} user={u} index={idx + 1} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Collapsed full list */}
      <details className="card-modern rounded-lg p-5">
        <summary className="cursor-pointer flex items-center justify-between text-white hover:text-[#e5e5e5] list-none">
          <span className="text-sm font-medium">
            All following ({sampleCount}{profileCount > sampleCount ? ` of ${profileCount.toLocaleString()}` : ''})
          </span>
          <span className="text-xs text-[#737373]">Expand</span>
        </summary>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[500px] overflow-y-auto pr-2">
          {data.current.map((u) => (
            <UserCard key={u.username} user={u} />
          ))}
        </div>
      </details>
    </>
  );
};


const FollowersView = ({ data }) => {
  if (data.quota_exhausted) return <QuotaExhausted type="followers" />;

  const period = data.comparison_period;
  const hasBaseline = data.has_baseline;
  const hasCountBaseline = data.has_count_baseline;
  const netChange = data.net_change;
  const profileCount = data.profile_count ?? data.total_count;
  const sampleCount = data.sample_count ?? data.current.length;
  const smartRecent = data.smart_recent || [];

  const netAdded = netChange != null && netChange > 0 ? netChange : (hasBaseline ? (data.added_details?.length || 0) : null);
  const netLost = netChange != null && netChange < 0 ? Math.abs(netChange) : (hasBaseline ? (data.removed_usernames?.length || 0) : null);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <StatCard label="Current followers" value={profileCount?.toLocaleString() ?? '—'} sublabel={sampleCount < profileCount ? `Scraped ${sampleCount} of ${profileCount.toLocaleString()}` : null} />
        <StatCard label={`New in ${period}`} value={netAdded != null ? `+${netAdded}` : '—'} tone="pos" sublabel={netAdded == null ? 'Need baseline' : null} />
        <StatCard label={`Lost in ${period}`} value={netLost != null ? `-${netLost}` : '—'} tone="neg" sublabel={netLost == null ? 'Need baseline' : null} />
      </div>

      <BaselineBanner hasBaseline={hasBaseline} hasCountBaseline={hasCountBaseline} netChange={netChange} period={period} smartRecentCount={smartRecent.length} />

      {smartRecent.length > 0 && (
        <div className="card-modern-hi rounded-lg p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {smartRecent.length} new followers in the {period}
              </h3>
              <p className="text-xs text-[#737373] mt-0.5">Scraper narrowed to the {smartRecent.length} most recent</p>
            </div>
            <span className="text-xs text-white bg-white/10 px-2.5 py-1 rounded font-mono">
              {smartRecent.length} NEW
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {smartRecent.map((u) => (
              <UserCard key={u.username} user={u} highlight="new" />
            ))}
          </div>
        </div>
      )}

      {data.removed_usernames && data.removed_usernames.length > 0 && (
        <div className="card-modern rounded-lg p-6 mb-4 border-l-2 border-l-[#dc2626]/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <UserMinus className="w-4 h-4 text-[#dc2626]" />
            Lost in the {period}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {data.removed_usernames.map((u) => (
              <a key={u} href={`https://www.instagram.com/${u}/`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-[#dc2626] hover:text-[#f87171] px-2.5 py-1 bg-[#1a0a0a] border border-[#3a1010] rounded">
                @{u}
              </a>
            ))}
          </div>
        </div>
      )}

      <details className="card-modern rounded-lg p-5" open>
        <summary className="cursor-pointer flex items-center justify-between text-white hover:text-[#e5e5e5] list-none">
          <span className="text-sm font-medium">
            All followers ({sampleCount}{profileCount > sampleCount ? ` of ${profileCount.toLocaleString()}` : ''})
          </span>
          <span className="text-xs text-[#737373]">Public sample</span>
        </summary>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[600px] overflow-y-auto pr-2">
          {data.current.map((u) => (
            <UserCard key={u.username} user={u} />
          ))}
        </div>
      </details>
    </>
  );
};


const StatCard = ({ label, value, sublabel, tone }) => {
  const valueColor = tone === 'pos' ? 'text-[#22c55e]' : tone === 'neg' ? 'text-[#dc2626]' : 'text-white';
  return (
    <div className="card-modern rounded-lg p-5">
      <div className="text-xs text-[#737373] mb-2">{label}</div>
      <div className={`font-mono text-3xl font-bold ${valueColor} tracking-tight`}>{value}</div>
      {sublabel && <div className="text-xs text-[#525252] mt-1">{sublabel}</div>}
    </div>
  );
};


const UserRow = ({ user, index, highlight }) => (
  <a
    href={`https://www.instagram.com/${user.username}/`}
    target="_blank"
    rel="noopener noreferrer"
    className={`flex items-center gap-3 px-3 py-2 rounded-md border transition-colors group ${
      highlight === 'new'
        ? 'bg-[#0a0a0a] border-white/10 hover:border-white/30'
        : 'bg-transparent border-transparent hover:bg-[#0a0a0a] hover:border-[#1f1f1f]'
    }`}
  >
    <span className={`font-mono text-xs w-8 text-center ${index <= 3 ? 'text-white' : 'text-[#525252]'}`}>
      {String(index).padStart(2, '0')}
    </span>
    {user.profile_pic ? (
      <img
        src={proxyImage(user.profile_pic)}
        alt=""
        className="w-8 h-8 rounded-full object-cover border border-[#262626] shrink-0"
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    ) : (
      <div className="w-8 h-8 rounded-full bg-[#141414] border border-[#262626] flex items-center justify-center shrink-0">
        <span className="text-[#a1a1aa] font-mono text-xs">{(user.username || '?').charAt(0).toUpperCase()}</span>
      </div>
    )}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-sm font-medium text-white truncate">@{user.username}</span>
        {user.is_verified && <ShieldCheck className="w-3 h-3 text-white shrink-0" strokeWidth={2} />}
        {user.is_private && <Lock className="w-2.5 h-2.5 text-[#737373] shrink-0" />}
      </div>
      {user.full_name && <div className="text-xs text-[#737373] truncate">{user.full_name}</div>}
    </div>
    {highlight === 'new' && (
      <span className="text-[10px] font-mono text-[#22c55e] uppercase tracking-wide">new</span>
    )}
  </a>
);


const UserCard = ({ user, highlight }) => (
  <a
    href={`https://www.instagram.com/${user.username}/`}
    target="_blank"
    rel="noopener noreferrer"
    className={`flex items-center gap-3 p-2.5 border rounded-md hover:border-[#333] transition-colors ${
      highlight === 'new' ? 'bg-[#0a0a0a] border-white/15' : 'bg-transparent border-[#1a1a1a]'
    }`}
  >
    {user.profile_pic ? (
      <img
        src={proxyImage(user.profile_pic)}
        alt=""
        className="w-8 h-8 rounded-full object-cover border border-[#262626]"
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    ) : (
      <div className="w-8 h-8 rounded-full bg-[#141414] border border-[#262626] flex items-center justify-center shrink-0">
        <span className="text-[#a1a1aa] font-mono text-xs">{(user.username || '?').charAt(0).toUpperCase()}</span>
      </div>
    )}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1">
        <div className="font-mono text-xs font-medium text-white truncate">@{user.username}</div>
        {user.is_verified && <ShieldCheck className="w-3 h-3 text-white shrink-0" strokeWidth={2} />}
        {user.is_private && <Lock className="w-2.5 h-2.5 text-[#737373] shrink-0" />}
      </div>
      {user.full_name && <div className="text-[11px] text-[#737373] truncate">{user.full_name}</div>}
    </div>
  </a>
);


const QuotaExhausted = ({ type }) => (
  <div className="card-modern rounded-lg p-12 text-center border-l-2 border-l-[#f59e0b]/70">
    <div className="text-lg font-semibold text-[#f59e0b] mb-2">Apify quota reached</div>
    <p className="text-sm text-[#a1a1aa] max-w-md mx-auto">
      Free tier caps {type} lists at ~200/day per user. Try again after 00:00 UTC or upgrade your plan.
    </p>
  </div>
);


const CommentsView = ({ comments }) => {
  if (!comments || comments.length === 0) {
    return (
      <div className="card-modern rounded-lg p-12 text-center text-[#a1a1aa]">
        No comments found on recent posts.
      </div>
    );
  }
  return (
    <div className="card-modern rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Recent comments ({comments.length})</h3>
        <span className="text-xs text-[#737373]">Sorted by likes</span>
      </div>
      <div className="space-y-2">
        {comments.map((c, idx) => (
          <div key={c.id || idx} data-testid={`comment-${idx}`} className="flex items-start gap-3 p-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-md hover:border-[#333] transition-colors">
            {c.post_thumbnail && (
              <a href={c.post_url} target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-md overflow-hidden border border-[#262626] shrink-0">
                <img src={proxyImage(c.post_thumbnail)} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
              </a>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {c.author_pic && (
                  <img src={proxyImage(c.author_pic)} alt="" className="w-4 h-4 rounded-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                )}
                <a href={`https://www.instagram.com/${c.author}/`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs font-medium text-white hover:text-[#e5e5e5]">
                  @{c.author}
                </a>
                <span className="text-[10px] text-[#525252]">{formatDate(c.timestamp)}</span>
              </div>
              <p className="text-sm text-[#d4d4d8] leading-relaxed">{c.text}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-[#525252]">
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3" />
                  <span className="font-mono">{c.likes}</span>
                </span>
                {c.replies_count > 0 && (
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    <span className="font-mono">{c.replies_count}</span>
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
