import { useEffect, useState } from 'react';
import axios from 'axios';
import { Users, TrendingUp, FileImage, ArrowUpRight, ArrowRight, Waypoints, Sparkles, GitCompareArrows, Loader2, X, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
  const [summaries, setSummaries] = useState(null); // null | [{username, summary, ...}]
  const [summariesLoading, setSummariesLoading] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareData, setCompareData] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState(null);

  useEffect(() => {
    fetchDashboard();
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

  const fetchSummaries = async () => {
    setSummariesLoading(true);
    try {
      const res = await axios.get(`${API}/insights/dashboard/summaries`);
      setSummaries(res.data.summaries || []);
    } catch (e) {
      console.error('Summaries error:', e);
      setSummaries([]);
    }
    setSummariesLoading(false);
  };

  const openCompare = async () => {
    setCompareOpen(true);
    if (compareData) return;
    setCompareLoading(true);
    setCompareError(null);
    try {
      const res = await axios.get(`${API}/insights/compare`);
      setCompareData(res.data);
    } catch (e) {
      setCompareError(e.response?.data?.detail || 'Comparison failed');
    }
    setCompareLoading(false);
  };

  const totals = data.totals || {};
  const stats = [
    { label: 'Tracked', value: totals.tracked || 0, icon: Users },
    { label: 'Followers', value: formatNumber(totals.followers || 0), icon: TrendingUp },
    { label: 'Following', value: formatNumber(totals.following || 0), icon: Waypoints },
    { label: 'Posts', value: formatNumber(totals.posts || 0), icon: FileImage },
  ];

  return (
    <div className="p-10 max-w-[1600px]">
      <div className="mb-10 flex items-start justify-between gap-6">
        <div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              data-testid={`stat-card-${stat.label.toLowerCase()}`}
              className="card-modern rounded-lg p-5 group"
              style={{ animation: `fadeInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.04}s backwards` }}
            >
              <div className="flex items-center justify-between mb-6">
                <Icon className="w-4 h-4 text-[#737373]" strokeWidth={1.75} />
                <ArrowUpRight className="w-3.5 h-3.5 text-[#404040] group-hover:text-white transition-colors" strokeWidth={1.75} />
              </div>
              <div className="text-3xl font-bold text-white tracking-tight mb-1">
                {stat.value}
              </div>
              <div className="text-xs text-[#737373]">
                {stat.label}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Active investigations</h2>
        <div className="flex items-center gap-3">
          {data.accounts.length >= 2 && (
            <button
              onClick={openCompare}
              data-testid="compare-accounts-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-[#1f1f1f] text-[#a1a1aa] hover:text-white hover:border-[#333] transition-colors"
            >
              <GitCompareArrows className="w-3.5 h-3.5" strokeWidth={1.75} />
              Compare with AI
            </button>
          )}
          <span className="text-xs text-[#737373]">{data.accounts.length} {data.accounts.length === 1 ? 'case' : 'cases'}</span>
        </div>
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

      {/* AI Snapshot section — per-account one-liner summaries */}
      {data.accounts.length > 0 && !loading && (
        <AiSnapshotSection
          accounts={data.accounts}
          summaries={summaries}
          loading={summariesLoading}
          onGenerate={fetchSummaries}
        />
      )}

      <CompareDialog
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        data={compareData}
        loading={compareLoading}
        error={compareError}
      />
    </div>
  );
};


const AiSnapshotSection = ({ accounts, summaries, loading, onGenerate }) => {
  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-white" strokeWidth={1.75} />
          <h2 className="text-xl font-semibold text-white">AI snapshot</h2>
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#525252] bg-[#0f0f0f] border border-[#1f1f1f] px-2 py-0.5 rounded">
            GPT-5.4
          </span>
        </div>
        <button
          onClick={onGenerate}
          disabled={loading}
          data-testid="ai-snapshot-generate-btn"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-[#1f1f1f] text-[#a1a1aa] hover:text-white hover:border-[#333] transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {summaries ? 'Refresh' : 'Generate'}
        </button>
      </div>

      {!summaries && !loading && (
        <div className="card-modern rounded-lg p-8 text-center">
          <div className="text-sm text-[#a1a1aa] max-w-md mx-auto">
            Get a one-sentence read on each tracked account — engagement, growth, momentum — powered by GPT-5.4.
          </div>
        </div>
      )}

      {loading && (
        <div className="card-modern rounded-lg p-8 flex items-center justify-center gap-2 text-sm text-[#a1a1aa]">
          <Loader2 className="w-4 h-4 animate-spin" /> Analysing {accounts.length} account{accounts.length === 1 ? '' : 's'}…
        </div>
      )}

      {summaries && summaries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {summaries.map((s) => (
            <div
              key={s.username}
              data-testid={`ai-summary-${s.username}`}
              className="card-modern rounded-lg p-5 border-l-2 border-l-white/30"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="font-mono text-sm font-medium text-white">@{s.username}</span>
                <div className="ml-auto flex items-center gap-3 text-[10px] font-mono text-[#525252]">
                  <span>{s.engagement_rate}% eng</span>
                  {s.follower_change_7d != null && (
                    <span className={s.follower_change_7d > 0 ? 'text-[#22c55e]' : s.follower_change_7d < 0 ? 'text-[#dc2626]' : 'text-[#525252]'}>
                      {s.follower_change_7d > 0 ? '+' : ''}{s.follower_change_7d}f
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-[#d4d4d8] leading-relaxed">{s.summary}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


const CompareDialog = ({ open, onClose, data, loading, error }) => {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl w-[95vw] bg-[#0a0a0a] border border-[#1f1f1f] p-0 overflow-hidden">
        <DialogTitle className="sr-only">AI account comparison</DialogTitle>
        <DialogDescription className="sr-only">
          Head-to-head comparison of tracked Instagram accounts
        </DialogDescription>
        <div className="flex flex-col max-h-[85vh]">
          <div className="p-5 border-b border-[#1a1a1a] flex items-center gap-3 shrink-0">
            <GitCompareArrows className="w-4 h-4 text-white" strokeWidth={1.75} />
            <div className="flex-1">
              <div className="text-base font-semibold text-white">Head-to-head comparison</div>
              <div className="text-[11px] text-[#737373] font-mono">GPT-5.4 · cached 1h</div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              data-testid="compare-close-btn"
              className="text-[#737373] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 min-h-0">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-[#a1a1aa] py-6" data-testid="compare-loading">
                <Loader2 className="w-4 h-4 animate-spin" /> Comparing accounts…
              </div>
            )}
            {error && <div className="text-sm text-[#dc2626]">{error}</div>}
            {data && (
              <>
                {/* Metrics rail */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
                  {data.accounts.map((a) => (
                    <div key={a.username} className="p-3 bg-[#0f0f0f] border border-[#1a1a1a] rounded-md">
                      <div className="font-mono text-xs font-medium text-white mb-2 truncate">@{a.username}</div>
                      <div className="text-[10px] text-[#525252] font-mono">Followers</div>
                      <div className="font-mono text-sm text-white mb-1">{a.followers.toLocaleString()}</div>
                      <div className="text-[10px] text-[#525252] font-mono">Engagement</div>
                      <div className="font-mono text-sm text-white">{a.engagement_rate}%</div>
                    </div>
                  ))}
                </div>

                <div
                  data-testid="compare-content"
                  className="text-sm text-[#d4d4d8] leading-relaxed space-y-3"
                  dangerouslySetInnerHTML={{
                    __html: (data.comparison || '').replace(
                      /\*\*(.*?)\*\*/g,
                      '<span class="block font-mono text-white uppercase tracking-wide text-[11px] mt-4 mb-1">$1</span>'
                    )
                  }}
                />
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Dashboard;
