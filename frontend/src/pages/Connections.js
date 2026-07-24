import { useState, useEffect } from 'react';
import axios from 'axios';
import { UserMinus, Users, UserCheck, ShieldCheck, Lock, RefreshCw, Info, Clock, Sparkles, AlertTriangle } from 'lucide-react';
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
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
      } else if (tab === 'following') {
        const res = await axios.get(`${API}/profile/${selected}/following-list?limit=100&since_days=${timeRange}`);
        setFollowingData(res.data);
        if (res.data.quota_exhausted) toast.error('Apify quota exhausted');
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to fetch');
    }
    setLoading(false);
  };

  const tabs = [
    { id: 'following', label: 'Recently followed', icon: UserCheck },
    { id: 'followers', label: 'New followers', icon: Users },
  ];

  const currentData = tab === 'followers' ? followersData : followingData;
  const showTimeRange = tab === 'followers' || tab === 'following';
  const periodLabel = TIME_RANGES.find(r => r.value === timeRange)?.label.toLowerCase() || 'past week';

  return (
    <div className="p-10 max-w-[1600px]">
      <div className="mb-8">
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-white mb-3">
          Connections
        </h1>
        <p className="text-[15px] text-[#a1a1aa] max-w-2xl leading-relaxed">
          Who joined or left in a chosen time window. Only accounts within the range are shown.
        </p>
      </div>

      {accounts.length === 0 ? (
        <div className="card-modern rounded-lg p-16 text-center">
          <div className="text-xl font-medium text-white mb-2">No cases to inspect</div>
          <p className="text-sm text-[#a1a1aa]">Track a profile first to explore its connections.</p>
        </div>
      ) : (
        <>
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
                Instagram returns following list newest-first · Fetch takes 30–90s
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

          <div className="card-modern rounded-lg p-3.5 mb-6 border-l-2 border-l-[#dc2626]/50">
            <div className="flex items-start gap-3">
              <Info className="w-3.5 h-3.5 text-[#dc2626]/80 mt-0.5 shrink-0" />
              <div className="text-xs text-[#a1a1aa]">
                Instagram doesn't publicly expose two things — no scraper on Earth can retrieve them:
                (1) posts a user has <em>liked</em> (removed by Meta in Oct 2019),
                (2) comments they've made on <em>other</em> people's posts (no reverse index).
                Everything below is real and public.
              </div>
            </div>
          </div>

          {loading ? (
            <div className="card-modern rounded-lg p-16 text-center text-[#a1a1aa]">
              <RefreshCw className="w-5 h-5 mx-auto mb-3 animate-spin" />
              Interrogating Instagram's public archive…
            </div>
          ) : !currentData ? (
            <div className="card-modern rounded-lg p-16 text-center">
              <div className="text-lg text-white mb-2">No data yet</div>
              <p className="text-sm text-[#a1a1aa]">
                Click <span className="text-white">Fetch live data</span> to inspect @{selected} for the {periodLabel}.
              </p>
            </div>
          ) : tab === 'following' ? (
            <FollowingView data={currentData} period={periodLabel} />
          ) : (
            <FollowersView data={currentData} period={periodLabel} />
          )}
        </>
      )}
    </div>
  );
};


const NoBaselinePanel = ({ period, netChange }) => (
  <div className="card-modern rounded-lg p-8 mb-6">
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-md bg-[#141414] border border-[#1f1f1f] flex items-center justify-center shrink-0">
        <Clock className="w-4 h-4 text-[#a1a1aa]" strokeWidth={1.75} />
      </div>
      <div className="flex-1">
        <h3 className="text-lg font-semibold text-white mb-2">Waiting on a baseline</h3>
        <p className="text-sm text-[#a1a1aa] leading-relaxed mb-3">
          Sherlock started tracking this account too recently to know who was followed exactly in the {period}.
          The scheduler snapshots the account every 6 hours — come back after {period} has elapsed for exact answers.
        </p>
        {netChange != null && (
          <div className="text-xs text-[#737373] font-mono">
            Numeric change since we started tracking: {netChange > 0 ? '+' : ''}{netChange}
          </div>
        )}
      </div>
    </div>
  </div>
);


const ApproximateWarning = ({ period, netChange, smartRecentCount }) => (
  <div className="card-modern rounded-lg p-3.5 mb-4 border-l-2 border-l-[#f59e0b]/70">
    <div className="flex items-start gap-3">
      <AlertTriangle className="w-3.5 h-3.5 text-[#f59e0b] mt-0.5 shrink-0" />
      <div className="text-xs text-[#d4d4d8]">
        <strong className="text-[#f59e0b]">Approximate — no full-list baseline yet.</strong>{' '}
        We know the count changed by {netChange > 0 ? '+' : ''}{netChange} in the {period}.
        Since Instagram returns the list newest-first, we're showing the {smartRecentCount} most recent as a best-effort proxy.
        Exact identification requires a full-list snapshot from that period (built automatically every 6h).
      </div>
    </div>
  </div>
);


const PartialBaselineWarning = ({ period, baselineTimestamp }) => {
  const ageHours = baselineTimestamp
    ? Math.max(1, Math.floor((Date.now() - new Date(baselineTimestamp).getTime()) / 3600000))
    : null;
  return (
    <div className="card-modern rounded-lg p-3.5 mb-4 border-l-2 border-l-[#f59e0b]/70">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-3.5 h-3.5 text-[#f59e0b] mt-0.5 shrink-0" />
        <div className="text-xs text-[#d4d4d8]">
          <strong className="text-[#f59e0b]">Partial baseline.</strong>{' '}
          We've only been tracking this account for ~{ageHours}h, so we can't cover the full {period} yet.
          Showing exact changes since we started tracking. Keep coming back — the picture will fill in.
        </div>
      </div>
    </div>
  );
};


const HeuristicWarning = ({ period, smartRecentCount }) => (
  <div className="card-modern rounded-lg p-3.5 mb-4 border-l-2 border-l-[#f59e0b]/70">
    <div className="flex items-start gap-3">
      <AlertTriangle className="w-3.5 h-3.5 text-[#f59e0b] mt-0.5 shrink-0" />
      <div className="text-xs text-[#d4d4d8]">
        <strong className="text-[#f59e0b]">Best-effort — no historical baseline.</strong>{' '}
        Instagram returns the list in reverse-chronological order (newest follows first).
        We're showing the top {smartRecentCount} entries as a proxy for "recently followed in the {period}".
        Exact diffs kick in automatically once we've been tracking for {period}.
      </div>
    </div>
  </div>
);


const FollowingView = ({ data, period }) => {
  if (data.quota_exhausted) return <QuotaExhausted type="following" />;

  const profileCount = data.profile_count ?? 0;
  const smartRecent = data.smart_recent || [];
  const removedUsernames = data.removed_usernames || [];
  const mode = data.smart_recent_mode; // "exact" | "partial" | "approximate" | "heuristic" | "none"
  const isExactish = mode === "exact" || mode === "partial";

  const followedCount = isExactish ? smartRecent.length : (data.net_change > 0 ? data.net_change : smartRecent.length);
  const unfollowedCount = isExactish
    ? removedUsernames.length
    : (data.net_change != null && data.net_change < 0 ? Math.abs(data.net_change) : 0);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <StatCard label="Total following" value={profileCount.toLocaleString()} />
        <StatCard label={`Followed in ${period}`} value={`+${followedCount}`} tone="pos" />
        <StatCard label={`Unfollowed in ${period}`} value={`-${unfollowedCount}`} tone="neg" />
      </div>

      {mode === "none" && (
        <NoBaselinePanel period={period} netChange={data.net_change} />
      )}
      {mode === "partial" && (
        <PartialBaselineWarning period={period} baselineTimestamp={data.baseline_timestamp} />
      )}
      {mode === "approximate" && smartRecent.length > 0 && (
        <ApproximateWarning period={period} netChange={data.net_change} smartRecentCount={smartRecent.length} />
      )}
      {mode === "heuristic" && smartRecent.length > 0 && (
        <HeuristicWarning period={period} smartRecentCount={smartRecent.length} />
      )}

      {smartRecent.length > 0 && (
        <div className="card-modern-hi rounded-lg p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-white" />
                {smartRecent.length} account{smartRecent.length === 1 ? '' : 's'} followed in the {period}
              </h3>
              <p className="text-xs text-[#737373] mt-0.5">
                {mode === "exact" && "Exact — from full-list diff"}
                {mode === "partial" && "Exact — but only since we started tracking"}
                {mode === "approximate" && "Best-effort — recency-ordered slice"}
                {mode === "heuristic" && "Best-effort — Instagram's newest-first ordering"}
              </p>
            </div>
            <span className="text-[10px] text-white bg-white/10 px-2 py-0.5 rounded font-mono uppercase tracking-wider">
              {mode}
            </span>
          </div>
          <div className="space-y-1.5">
            {smartRecent.map((u, idx) => (
              <UserRow key={u.username || idx} user={u} index={idx + 1} highlight="new" />
            ))}
          </div>
        </div>
      )}

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

      {isExactish && smartRecent.length === 0 && removedUsernames.length === 0 && (
        <div className="card-modern rounded-lg p-12 text-center">
          <div className="text-lg text-white mb-2">No changes in the {period}</div>
          <p className="text-sm text-[#a1a1aa]">@{data.username || 'this account'} hasn't followed or unfollowed anyone in this window.</p>
        </div>
      )}
    </>
  );
};


const FollowersView = ({ data, period }) => {
  if (data.quota_exhausted) return <QuotaExhausted type="followers" />;

  const profileCount = data.profile_count ?? 0;
  const smartRecent = data.smart_recent || [];
  const removedUsernames = data.removed_usernames || [];
  const mode = data.smart_recent_mode;
  const isExactish = mode === "exact" || mode === "partial";

  const gainedCount = isExactish ? smartRecent.length : (data.net_change > 0 ? data.net_change : smartRecent.length);
  const lostCount = isExactish
    ? removedUsernames.length
    : (data.net_change != null && data.net_change < 0 ? Math.abs(data.net_change) : 0);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <StatCard label="Total followers" value={profileCount.toLocaleString()} />
        <StatCard label={`New in ${period}`} value={`+${gainedCount}`} tone="pos" />
        <StatCard label={`Lost in ${period}`} value={`-${lostCount}`} tone="neg" />
      </div>

      {mode === "none" && (
        <NoBaselinePanel period={period} netChange={data.net_change} />
      )}
      {mode === "partial" && (
        <PartialBaselineWarning period={period} baselineTimestamp={data.baseline_timestamp} />
      )}
      {mode === "approximate" && smartRecent.length > 0 && (
        <ApproximateWarning period={period} netChange={data.net_change} smartRecentCount={smartRecent.length} />
      )}
      {mode === "heuristic" && smartRecent.length > 0 && (
        <HeuristicWarning period={period} smartRecentCount={smartRecent.length} />
      )}

      {smartRecent.length > 0 && (
        <div className="card-modern-hi rounded-lg p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {smartRecent.length} new follower{smartRecent.length === 1 ? '' : 's'} in the {period}
              </h3>
              <p className="text-xs text-[#737373] mt-0.5">
                {mode === "exact" && "Exact — from full-list diff"}
                {mode === "partial" && "Exact — but only since we started tracking"}
                {mode === "approximate" && "Best-effort — most recent slice"}
                {mode === "heuristic" && "Best-effort — Instagram's newest-first ordering"}
              </p>
            </div>
            <span className="text-[10px] text-white bg-white/10 px-2 py-0.5 rounded font-mono uppercase tracking-wider">
              {mode}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {smartRecent.map((u) => (
              <UserCard key={u.username} user={u} highlight="new" />
            ))}
          </div>
        </div>
      )}

      {removedUsernames.length > 0 && (
        <div className="card-modern rounded-lg p-6 mb-4 border-l-2 border-l-[#dc2626]/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <UserMinus className="w-4 h-4 text-[#dc2626]" />
            Lost in the {period}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {removedUsernames.map((u) => (
              <a key={u} href={`https://www.instagram.com/${u}/`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-[#dc2626] hover:text-[#f87171] px-2.5 py-1 bg-[#1a0a0a] border border-[#3a1010] rounded">
                @{u}
              </a>
            ))}
          </div>
        </div>
      )}

      {(mode === "exact" || mode === "partial") && smartRecent.length === 0 && removedUsernames.length === 0 && (
        <div className="card-modern rounded-lg p-12 text-center">
          <div className="text-lg text-white mb-2">No changes in the {period}</div>
          <p className="text-sm text-[#a1a1aa]">Followers stayed the same in this window.</p>
        </div>
      )}
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
    className={`flex items-center gap-3 px-3 py-2 rounded-md border transition-colors ${
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
      Free tier caps {type} lists at ~200/day per user. Try again after 00:00 UTC or upgrade your Apify plan.
    </p>
  </div>
);


export default Connections;
