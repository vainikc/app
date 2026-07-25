import { useEffect, useState } from 'react';
import axios from 'axios';
import { Heart, MessageCircle, ExternalLink, Film, Images, ShieldCheck, Lock, X, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [openPost, setOpenPost] = useState(null); // { post, username, profile }

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const res = await axios.get(`${API}/accounts`);
      setTrackedAccounts(res.data);
      setLoading(false);
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

  const visible = selectedFilter === 'all'
    ? trackedAccounts
    : trackedAccounts.filter(a => a.username === selectedFilter);

  return (
    <div className="p-10 max-w-[1600px]">
      <div className="mb-8 pl-8 hero-crosshair">
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-white mb-3">
          Activity
        </h1>
        <p className="text-[15px] text-[#a1a1aa] max-w-2xl leading-relaxed">
          Each tracked profile as a mini Instagram page. Click any post for likes and comments.
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
          <div className="flex gap-2 mb-8 flex-wrap">
            <button
              onClick={() => setSelectedFilter('all')}
              data-testid="filter-all"
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

          <div className="space-y-16">
            {visible.map((account) => {
              const profile = profiles[account.username];
              const posts = activities[account.username];
              return (
                <MiniProfile
                  key={account.id}
                  account={account}
                  profile={profile}
                  posts={posts}
                  onPostClick={(post) => setOpenPost({ post, username: account.username, profile })}
                />
              );
            })}
          </div>
        </>
      )}

      <PostDialog
        open={!!openPost}
        onClose={() => setOpenPost(null)}
        post={openPost?.post}
        username={openPost?.username}
        profile={openPost?.profile}
      />
    </div>
  );
};


const MiniProfile = ({ account, profile, posts, onPostClick }) => {
  return (
    <section data-testid={`activity-section-${account.username}`}>
      {/* IG-style header */}
      <div className="flex items-center gap-8 md:gap-12 pb-6 border-b border-[#1a1a1a]">
        {profile?.profile_pic ? (
          <img
            src={proxyImage(profile.profile_pic)}
            alt={account.username}
            className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border border-[#262626] shrink-0"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-[#141414] border border-[#262626] flex items-center justify-center shrink-0">
            <span className="text-[#a1a1aa] font-mono text-2xl">
              {account.username.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <a
              href={`https://www.instagram.com/${account.username}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xl md:text-2xl font-medium text-white hover:text-[#e5e5e5]"
            >
              @{account.username}
            </a>
            {profile?.is_verified && <ShieldCheck className="w-4 h-4 text-white" strokeWidth={2} />}
            {profile?.is_private && <Lock className="w-3.5 h-3.5 text-[#737373]" />}
          </div>
          <div className="flex items-center gap-6 md:gap-8 mb-3 flex-wrap">
            <Stat label="posts" value={formatNumber(profile?.posts ?? 0)} />
            <Stat label="followers" value={formatNumber(profile?.followers ?? 0)} />
            <Stat label="following" value={formatNumber(profile?.following ?? 0)} />
          </div>
          {profile?.full_name && (
            <div className="text-sm font-medium text-white mb-0.5">{profile.full_name}</div>
          )}
          {profile?.bio && (
            <div className="text-xs text-[#a1a1aa] whitespace-pre-line leading-relaxed max-w-xl">
              {profile.bio}
            </div>
          )}
        </div>
      </div>

      {/* Post grid */}
      <div className="mt-6">
        {!posts ? (
          <div className="text-xs text-[#737373] py-8 text-center">Loading posts…</div>
        ) : posts.length === 0 ? (
          <div className="text-xs text-[#737373] py-8 text-center">No recent posts.</div>
        ) : (
          <div className="grid grid-cols-3 gap-1 md:gap-2">
            {posts.map((post, idx) => (
              <PostTile
                key={`${account.username}-${idx}`}
                post={post}
                testId={`post-tile-${account.username}-${idx}`}
                onClick={() => onPostClick(post)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

const Stat = ({ label, value }) => (
  <div className="flex items-baseline gap-1.5">
    <span className="font-mono text-lg md:text-xl font-semibold text-white">{value}</span>
    <span className="text-xs text-[#a1a1aa]">{label}</span>
  </div>
);

const PostTile = ({ post, onClick, testId }) => {
  const isMulti = post.post_type === 'Sidecar';
  const isVideo = post.post_type === 'Video';
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="relative aspect-square overflow-hidden bg-[#0a0a0a] border border-[#141414] hover:border-[#333] group cursor-pointer"
    >
      {post.media_url ? (
        <img
          src={proxyImage(post.media_url)}
          alt=""
          className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Images className="w-8 h-8 text-[#333]" strokeWidth={1.25} />
        </div>
      )}
      {(isMulti || isVideo) && (
        <div className="absolute top-2 right-2">
          {isMulti && <Images className="w-4 h-4 text-white drop-shadow-md" strokeWidth={2} />}
          {isVideo && <Film className="w-4 h-4 text-white drop-shadow-md" strokeWidth={2} />}
        </div>
      )}
      {/* Hover overlay with stats */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6 text-white">
        <div className="flex items-center gap-1.5">
          <Heart className="w-4 h-4 fill-white" strokeWidth={2} />
          <span className="font-mono text-sm font-semibold">{formatNumber(post.likes)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MessageCircle className="w-4 h-4 fill-white" strokeWidth={2} />
          <span className="font-mono text-sm font-semibold">{formatNumber(post.comments)}</span>
        </div>
      </div>
    </button>
  );
};


const PostDialog = ({ open, onClose, post, username, profile }) => {
  const [comments, setComments] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !post?.post_url) return;
    setComments(null);
    setError(null);
    setLoading(true);
    axios.get(`${API}/post-comments`, { params: { post_url: post.post_url, limit: 30 } })
      .then((res) => {
        setComments(res.data || []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.response?.data?.detail || 'Failed to load comments');
        setLoading(false);
      });
  }, [open, post?.post_url]);

  if (!post) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] glass-strong border border-[#1f1f1f] p-0 overflow-hidden">
        <DialogTitle className="sr-only">Post by @{username}</DialogTitle>
        <DialogDescription className="sr-only">
          Instagram post with {post.likes} likes and {post.comments} comments
        </DialogDescription>
        <div className="grid grid-cols-1 md:grid-cols-2 max-h-[85vh]">
          {/* Media */}
          <div className="bg-black flex items-center justify-center relative aspect-square md:aspect-auto md:min-h-[500px]">
            {post.media_url ? (
              <img
                src={proxyImage(post.media_url)}
                alt=""
                className="w-full h-full object-contain"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="text-[#525252]">No preview</div>
            )}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 md:hidden bg-black/60 rounded-full p-1.5 text-white"
              aria-label="Close"
              data-testid="post-dialog-close-mobile"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Details + comments */}
          <div className="flex flex-col min-h-0">
            {/* Header */}
            <div className="p-4 border-b border-[#1a1a1a] flex items-center gap-3 shrink-0">
              {profile?.profile_pic ? (
                <img
                  src={proxyImage(profile.profile_pic)}
                  alt=""
                  className="w-9 h-9 rounded-full object-cover border border-[#262626]"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#141414] border border-[#262626]" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-sm font-medium text-white truncate">@{username}</span>
                  {profile?.is_verified && <ShieldCheck className="w-3 h-3 text-white shrink-0" strokeWidth={2} />}
                </div>
                <div className="text-[10px] text-[#525252]">{formatDate(post.timestamp)}</div>
              </div>
              <a
                href={post.post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono uppercase text-white hover:text-[#e5e5e5] flex items-center gap-1"
                data-testid="post-dialog-ig-link"
              >
                Open <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Caption + comments scroll */}
            <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
              {post.content && (
                <div className="flex gap-3">
                  {profile?.profile_pic && (
                    <img
                      src={proxyImage(profile.profile_pic)}
                      alt=""
                      className="w-6 h-6 rounded-full object-cover border border-[#262626] shrink-0"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <div className="text-xs text-[#d4d4d8] leading-relaxed">
                    <span className="font-mono font-medium text-white mr-1.5">@{username}</span>
                    <span className="whitespace-pre-line">{post.content}</span>
                  </div>
                </div>
              )}

              <div className="text-[10px] font-mono uppercase text-[#525252] tracking-wide pt-2 border-t border-[#141414]">
                Comments {comments ? `(${comments.length})` : ''}
              </div>

              {loading && (
                <div className="flex items-center gap-2 text-xs text-[#737373] py-4" data-testid="post-comments-loading">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading comments…
                </div>
              )}
              {error && (
                <div className="text-xs text-[#dc2626] py-2">{error}</div>
              )}
              {comments && comments.length === 0 && !loading && (
                <div className="text-xs text-[#737373] py-2">No public comments to show.</div>
              )}
              {comments && comments.length > 0 && (
                <div className="space-y-3">
                  {comments.map((c, idx) => (
                    <div key={c.id || idx} data-testid={`post-comment-${idx}`} className="flex gap-3">
                      {c.author_pic ? (
                        <img
                          src={proxyImage(c.author_pic)}
                          alt=""
                          className="w-6 h-6 rounded-full object-cover border border-[#262626] shrink-0"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-[#141414] border border-[#262626] shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-[#d4d4d8] leading-relaxed">
                          <a
                            href={`https://www.instagram.com/${c.author}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono font-medium text-white mr-1.5 hover:text-[#e5e5e5]"
                          >
                            @{c.author}
                          </a>
                          <span>{c.text}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-[#525252] font-mono">
                          <span>{formatDate(c.timestamp)}</span>
                          {c.likes > 0 && <span>{c.likes} {c.likes === 1 ? 'like' : 'likes'}</span>}
                          {c.replies_count > 0 && (
                            <span>{c.replies_count} {c.replies_count === 1 ? 'reply' : 'replies'}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer stats */}
            <div className="p-4 border-t border-[#1a1a1a] shrink-0 flex items-center gap-6">
              <div className="flex items-center gap-1.5 text-white">
                <Heart className="w-4 h-4 fill-white" strokeWidth={2} />
                <span className="font-mono text-sm font-semibold" data-testid="post-dialog-likes">
                  {formatNumber(post.likes)}
                </span>
                <span className="text-xs text-[#a1a1aa]">likes</span>
              </div>
              <div className="flex items-center gap-1.5 text-white">
                <MessageCircle className="w-4 h-4" strokeWidth={2} />
                <span className="font-mono text-sm font-semibold" data-testid="post-dialog-comments">
                  {formatNumber(post.comments)}
                </span>
                <span className="text-xs text-[#a1a1aa]">comments</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ActivityFeed;
