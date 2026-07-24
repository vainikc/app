import { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, UserMinus, Users, UserCheck, ShieldCheck, Lock, RefreshCw, Info, MessageSquare, Heart } from 'lucide-react';
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

const Connections = () => {
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState('');
  const [tab, setTab] = useState('followers'); // followers | following | comments
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
        const res = await axios.get(`${API}/profile/${selected}/followers-list?limit=100`);
        setFollowersData(res.data);
        toast.success(`Loaded ${res.data.current.length} followers`);
      } else if (tab === 'following') {
        const res = await axios.get(`${API}/profile/${selected}/following-list?limit=100`);
        setFollowingData(res.data);
        toast.success(`Loaded ${res.data.current.length} following`);
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
    { id: 'followers', label: 'Followers', icon: Users, num: '01' },
    { id: 'following', label: 'Following', icon: UserCheck, num: '02' },
    { id: 'comments', label: 'Comments on Posts', icon: MessageSquare, num: '03' },
  ];

  const currentData = tab === 'followers' ? followersData : tab === 'following' ? followingData : commentsData;

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
          Who follows them, who they follow, and what people are saying on their posts.
          Track changes over time.
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
          {/* Account selector */}
          <div className="card-vintage rounded-md p-6 mb-6">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#6b6660] mb-2">Investigate Case</div>
            <div className="flex gap-3 items-end flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <Select value={selected} onValueChange={setSelected}>
                  <SelectTrigger
                    data-testid="connections-account-select"
                    className="bg-[#0f0f0f] border-[#1f1f1f] text-[#e8e6e1] font-mono"
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
            <p className="text-xs text-[#6b6660] mt-3 flex items-start gap-2">
              <Info className="w-3 h-3 mt-0.5 shrink-0 text-[#d4a656]" />
              Fetch may take 30-90 seconds. Data cached for 6h. Each fetch snapshots the list so we can detect additions/removals over time.
            </p>
          </div>

          {/* Tab bar */}
          <div className="flex gap-2 mb-4">
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

          {/* Not-available disclaimer for missing IG features */}
          <div className="card-vintage rounded-md p-4 mb-6 border-l-2 border-l-[#c15147]/40">
            <div className="flex items-start gap-3">
              <Info className="w-4 h-4 text-[#c15147]/70 mt-0.5 shrink-0" />
              <div className="text-xs text-[#8a857e]">
                <strong className="text-[#c9c5be]">Note:</strong> Instagram does <em>not</em> publicly expose two things: (1) comments this user has made on <em>other</em> people's posts, and (2) posts this user has liked. That data is private on Meta's side and no scraping method retrieves it reliably. Everything shown below is real, live, and public.
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
          ) : tab === 'followers' || tab === 'following' ? (
            <ConnectionListView data={currentData} type={tab} />
          ) : (
            <CommentsView comments={currentData} />
          )}
        </>
      )}
    </div>
  );
};


const ConnectionListView = ({ data, type }) => {
  const isFollowers = type === 'followers';
  return (
    <>
      {/* Diff summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card-vintage rounded-md p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-md bg-[#1a1613] border border-[#2a2622] flex items-center justify-center">
              <Users className="w-4 h-4 text-[#d4a656]" strokeWidth={1.5} />
            </div>
          </div>
          <div className="font-mono text-3xl font-bold text-[#e8e6e1]">{data.total_count}</div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-[#6b6660] mt-1">
            Current {isFollowers ? 'Followers' : 'Following'}
          </div>
        </div>
        <div className="card-vintage rounded-md p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-md bg-[#0f2211] border border-[#1e3e21] flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-[#7d9c60]" strokeWidth={1.5} />
            </div>
          </div>
          <div className="font-mono text-3xl font-bold text-[#7d9c60]">
            +{data.added_details?.length || 0}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-[#6b6660] mt-1">
            {isFollowers ? 'New Followers' : 'Recently Followed'}
          </div>
        </div>
        <div className="card-vintage rounded-md p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-md bg-[#221010] border border-[#3e1e1e] flex items-center justify-center">
              <UserMinus className="w-4 h-4 text-[#c15147]" strokeWidth={1.5} />
            </div>
          </div>
          <div className="font-mono text-3xl font-bold text-[#c15147]">
            -{data.removed_usernames?.length || 0}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-[#6b6660] mt-1">
            {isFollowers ? 'Lost Followers' : 'Unfollowed'}
          </div>
        </div>
      </div>

      {/* Recently added highlight */}
      {data.added_details && data.added_details.length > 0 && (
        <div className="card-vintage rounded-md p-6 mb-6 border-l-2 border-l-[#7d9c60]">
          <h3 className="font-heading text-xl font-semibold text-[#e8e6e1] mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#7d9c60]" />
            {isFollowers ? 'New Followers Since Last Check' : 'Recently Followed'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.added_details.map((u) => (
              <UserCard key={u.username} user={u} highlight="new" />
            ))}
          </div>
        </div>
      )}

      {/* Removed users */}
      {data.removed_usernames && data.removed_usernames.length > 0 && (
        <div className="card-vintage rounded-md p-6 mb-6 border-l-2 border-l-[#c15147]/50">
          <h3 className="font-heading text-xl font-semibold text-[#e8e6e1] mb-4 flex items-center gap-2">
            <UserMinus className="w-5 h-5 text-[#c15147]" />
            {isFollowers ? 'Lost Followers' : 'Unfollowed'}
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

      {/* Full current list */}
      <div className="card-vintage rounded-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-heading text-xl font-semibold text-[#e8e6e1]">
            All {isFollowers ? 'Followers' : 'Following'} ({data.current.length})
          </h3>
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#6b6660]">
            Public sample
          </span>
        </div>
        {data.current.length === 0 ? (
          <p className="text-sm text-[#6b6660]">No data returned. Try again in a few moments.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-2">
            {data.current.map((u) => (
              <UserCard key={u.username} user={u} />
            ))}
          </div>
        )}
      </div>
    </>
  );
};


const UserCard = ({ user, highlight }) => {
  return (
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
          alt={user.username}
          className="w-10 h-10 rounded-full object-cover border border-[#2a2622]"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-[#1a1613] border border-[#2a2622] flex items-center justify-center shrink-0">
          <span className="text-[#d4a656] font-mono text-sm">
            {(user.username || '?').charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <div className="font-mono text-xs font-semibold text-[#e8e6e1] truncate">
            @{user.username}
          </div>
          {user.is_verified && <ShieldCheck className="w-3 h-3 text-[#d4a656] shrink-0" strokeWidth={2} />}
          {user.is_private && <Lock className="w-2.5 h-2.5 text-[#8a857e] shrink-0" />}
        </div>
        {user.full_name && (
          <div className="text-[11px] text-[#8a857e] truncate">{user.full_name}</div>
        )}
      </div>
    </a>
  );
};


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
        <span className="text-[10px] font-mono uppercase tracking-widest text-[#6b6660]">
          Sorted by likes
        </span>
      </div>
      <div className="space-y-3">
        {comments.map((c, idx) => (
          <div
            key={c.id || idx}
            data-testid={`comment-${idx}`}
            className="flex items-start gap-4 p-4 bg-[#111111] border border-[#1f1f1f] rounded-md hover:border-[#d4a656]/40 transition-colors"
          >
            {c.post_thumbnail && (
              <a
                href={c.post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-16 h-16 rounded-sm overflow-hidden border border-[#2a2622] shrink-0"
              >
                <img
                  src={proxyImage(c.post_thumbnail)}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </a>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {c.author_pic && (
                  <img
                    src={proxyImage(c.author_pic)}
                    alt=""
                    className="w-5 h-5 rounded-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
                <a
                  href={`https://www.instagram.com/${c.author}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm font-semibold text-[#e8e6e1] hover:text-[#d4a656]"
                >
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
