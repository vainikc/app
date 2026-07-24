import { useState, useEffect } from 'react';
import axios from 'axios';
import DOMPurify from 'dompurify';
import { Plus, Trash2, Sparkles, ExternalLink, ShieldCheck, Lock, Briefcase, Heart, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { proxyImage } from '@/lib/imageProxy';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const formatNumber = (n) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n ?? 0);
};

const ProfileTracker = () => {
  const [username, setUsername] = useState('');
  const [trackedAccounts, setTrackedAccounts] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [insights, setInsights] = useState({});
  const [loading, setLoading] = useState({});
  const [loadingInsights, setLoadingInsights] = useState({});
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchTrackedAccounts();
  }, []);

  const fetchTrackedAccounts = async () => {
    try {
      const res = await axios.get(`${API}/accounts`);
      setTrackedAccounts(res.data);
      res.data.forEach((acc) => fetchProfile(acc.username));
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchProfile = async (username) => {
    setLoading((prev) => ({ ...prev, [username]: true }));
    try {
      const res = await axios.get(`${API}/profile/${username}`);
      setProfiles((prev) => ({ ...prev, [username]: res.data }));
    } catch (error) {
      console.error(`Error fetching ${username}:`, error);
      toast.error(`Failed to load @${username}: ${error.response?.data?.detail || 'Unknown error'}`);
    }
    setLoading((prev) => ({ ...prev, [username]: false }));
  };

  const fetchInsights = async (username) => {
    setLoadingInsights((prev) => ({ ...prev, [username]: true }));
    try {
      const res = await axios.get(`${API}/insights/${username}`);
      setInsights((prev) => ({ ...prev, [username]: res.data }));
    } catch (error) {
      toast.error('Failed to generate insights');
    }
    setLoadingInsights((prev) => ({ ...prev, [username]: false }));
  };

  const handleAddAccount = async () => {
    const cleaned = username.trim().replace(/^@/, '');
    if (!cleaned) {
      toast.error('Enter an Instagram username');
      return;
    }
    setAdding(true);
    try {
      const res = await axios.post(`${API}/accounts?username=${cleaned}`);
      toast.success(`Now tracking @${res.data.profile.username}`);
      setUsername('');
      fetchTrackedAccounts();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error adding account');
    }
    setAdding(false);
  };

  const handleRemove = async (username) => {
    try {
      await axios.delete(`${API}/accounts/${username}`);
      toast.success(`Removed @${username}`);
      fetchTrackedAccounts();
      const { [username]: _, ...rest } = profiles;
      setProfiles(rest);
    } catch (error) {
      toast.error('Error removing account');
    }
  };

  return (
    <div className="p-10 max-w-[1600px]">
      <div className="mb-10">
        <div className="inline-block text-[10px] font-mono uppercase tracking-[0.3em] text-[#ffffff] mb-3 inline-block pl-6">
          Investigations
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold font-semibold tracking-tight text-[#fafafa] mb-2">
          Profile Tracker
        </h1>
        <p className="text-[#a1a1aa]">Add any public Instagram username. We'll do the observing.</p>
        <div className="divider mt-6 max-w-md"></div>
      </div>

      <div className="card-modern rounded-md p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-md bg-[#0f0f0f] border border-[#262626] flex items-center justify-center">
            <Plus className="w-4 h-4 text-[#ffffff]" strokeWidth={2} />
          </div>
          <h2 className="font-body text-xl font-semibold text-[#fafafa]">Open New Investigation</h2>
        </div>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#737373] font-mono">@</span>
            <Input
              data-testid="username-input"
              type="text"
              placeholder="cristiano, natgeo, humansofny..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddAccount()}
              className="pl-9 bg-[#000000] border-[#1a1a1a] focus:border-[#ffffff] focus:ring-[#ffffff] text-[#fafafa] font-mono h-11"
            />
          </div>
          <Button
            data-testid="add-account-btn"
            onClick={handleAddAccount}
            disabled={adding}
            className="bg-[#ffffff] hover:bg-[#e5e5e5] text-[#000000] h-11 px-6 font-medium"
          >
            {adding ? 'Fetching...' : 'Track'}
          </Button>
        </div>
        <p className="text-xs text-[#737373] mt-3">Live data via Apify. Fetch may take 10-30 seconds on first request.</p>
      </div>

      <div className="space-y-5">
        {trackedAccounts.length === 0 && (
          <div className="card-modern rounded-md p-12 text-center">
            <div className="font-body text-2xl text-[#a1a1aa]">No profiles under observation yet.</div>
            <p className="text-sm text-[#737373] mt-2">Enter a username above to begin.</p>
          </div>
        )}

        {trackedAccounts.map((account, idx) => {
          const profile = profiles[account.username];
          const insight = insights[account.username];
          return (
            <div
              key={account.id}
              data-testid={`profile-card-${account.username}`}
              className="card-modern rounded-md p-6"
              style={{ animation: `fadeInUp 0.4s ease-out ${idx * 0.05}s backwards` }}
            >
              {loading[account.username] && !profile ? (
                <div className="py-8 text-center text-[#737373] text-sm">Loading @{account.username}...</div>
              ) : profile ? (
                <>
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-start gap-4 flex-1">
                      {profile.profile_pic ? (
                        <img
                          src={proxyImage(profile.profile_pic)}
                          alt={profile.username}
                          className="w-20 h-20 rounded-full border-2 border-[#ffffff]/60 object-cover"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-[#0f0f0f] border-2 border-[#ffffff]/40 flex items-center justify-center">
                          <span className="text-[#ffffff] font-mono text-2xl">
                            {profile.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-mono text-xl font-semibold text-[#fafafa]">
                            @{profile.username}
                          </h3>
                          {profile.is_verified && (
                            <ShieldCheck className="w-5 h-5 text-[#ffffff]" strokeWidth={2} />
                          )}
                          {profile.is_private && (
                            <Lock className="w-4 h-4 text-[#a1a1aa]" strokeWidth={1.5} />
                          )}
                          {profile.is_business && (
                            <Briefcase className="w-4 h-4 text-[#ffffff]" strokeWidth={1.5} />
                          )}
                        </div>
                        <p className="font-body text-lg text-[#d4d4d8] mb-2">{profile.full_name}</p>
                        {profile.bio && (
                          <p className="text-sm text-[#a1a1aa] whitespace-pre-wrap max-w-2xl">{profile.bio}</p>
                        )}
                        {profile.external_url && (
                          <a
                            href={profile.external_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-[#ffffff] hover:text-[#f5f5f5] mt-2"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {profile.external_url}
                          </a>
                        )}
                      </div>
                    </div>
                    <Button
                      data-testid={`remove-btn-${account.username}`}
                      onClick={() => handleRemove(account.username)}
                      variant="ghost"
                      size="sm"
                      className="text-[#737373] hover:text-[#dc2626] hover:bg-transparent"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-4 py-5 border-y border-[#1a1a1a] mb-6">
                    <div className="text-center">
                      <div className="font-mono text-3xl font-bold text-[#fafafa]">
                        {profile.posts?.toLocaleString()}
                      </div>
                      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#737373] mt-1">Posts</div>
                    </div>
                    <div className="text-center border-x border-[#1a1a1a]">
                      <div className="font-mono text-3xl font-bold text-[#ffffff]">
                        {profile.followers?.toLocaleString()}
                      </div>
                      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#737373] mt-1">Followers</div>
                    </div>
                    <div className="text-center">
                      <div className="font-mono text-3xl font-bold text-[#fafafa]">
                        {profile.following?.toLocaleString()}
                      </div>
                      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#737373] mt-1">Following</div>
                    </div>
                  </div>

                  {profile.recent_posts && profile.recent_posts.length > 0 && (
                    <div className="mb-6">
                      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#737373] mb-3">
                        Recent Evidence
                      </div>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                        {profile.recent_posts.slice(0, 6).map((post) => (
                          <a
                            key={post.id}
                            href={post.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative aspect-square rounded-sm overflow-hidden border border-[#1a1a1a] hover:border-[#ffffff] group"
                          >
                            {post.display_url && (
                              <img
                                src={proxyImage(post.display_url)}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            )}
                            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white text-xs">
                              <div className="flex items-center gap-1">
                                <Heart className="w-3 h-3" />
                                <span>{formatNumber(post.likes)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <MessageCircle className="w-3 h-3" />
                                <span>{formatNumber(post.comments)}</span>
                              </div>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    data-testid={`insights-btn-${account.username}`}
                    onClick={() => fetchInsights(account.username)}
                    disabled={loadingInsights[account.username]}
                    className="w-full bg-[#0f0f0f] hover:bg-[#1a1a1a] border border-[#ffffff]/40 hover:border-[#ffffff] text-[#ffffff]"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {loadingInsights[account.username] ? 'Analysing...' : insight ? 'Regenerate AI Insight' : 'Generate AI Insight'}
                  </Button>

                  {insight && (
                    <div
                      data-testid={`insight-content-${account.username}`}
                      className="mt-4 p-5 bg-[#000000] border border-[#ffffff]/20 rounded-md"
                    >
                      {insight.metrics && (
                        <div className="flex gap-6 mb-4 pb-4 border-b border-[#1a1a1a] flex-wrap">
                          <div>
                            <div className="text-[10px] font-mono uppercase text-[#737373]">Engagement</div>
                            <div className="font-mono text-lg text-[#ffffff]">{insight.metrics.engagement_rate}%</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-mono uppercase text-[#737373]">Posts Analyzed</div>
                            <div className="font-mono text-lg text-[#fafafa]">{insight.metrics.posts_analyzed}</div>
                          </div>
                          {insight.metrics.follower_change_7d != null && (
                            <div>
                              <div className="text-[10px] font-mono uppercase text-[#737373]">Δ Followers 7d</div>
                              <div className={`font-mono text-lg ${insight.metrics.follower_change_7d > 0 ? 'text-[#22c55e]' : insight.metrics.follower_change_7d < 0 ? 'text-[#dc2626]' : 'text-[#fafafa]'}`}>
                                {insight.metrics.follower_change_7d > 0 ? '+' : ''}{insight.metrics.follower_change_7d}
                              </div>
                            </div>
                          )}
                          {insight.metrics.following_change_7d != null && (
                            <div>
                              <div className="text-[10px] font-mono uppercase text-[#737373]">Δ Following 7d</div>
                              <div className={`font-mono text-lg ${insight.metrics.following_change_7d > 0 ? 'text-[#22c55e]' : insight.metrics.following_change_7d < 0 ? 'text-[#dc2626]' : 'text-[#fafafa]'}`}>
                                {insight.metrics.following_change_7d > 0 ? '+' : ''}{insight.metrics.following_change_7d}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <div
                        className="text-sm text-[#d4d4d8] leading-relaxed whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(
                            (insight.insights || '').replace(/\*\*(.*?)\*\*/g, '<span class="font-mono text-[#ffffff] uppercase tracking-wide text-xs">$1</span>'),
                            { ALLOWED_TAGS: ['span', 'strong', 'em', 'br'], ALLOWED_ATTR: ['class'] }
                          )
                        }}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[#737373] text-sm">
                  @{account.username} — data unavailable. Click refresh below.
                  <Button
                    onClick={() => fetchProfile(account.username)}
                    className="ml-3"
                    size="sm"
                    variant="outline"
                  >
                    Retry
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProfileTracker;
