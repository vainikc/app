import { useEffect, useState } from 'react';
import axios from 'axios';
import { Heart, MessageCircle, Image as ImageIcon, ExternalLink, Film } from 'lucide-react';
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
  } catch {
    return '';
  }
};

const ActivityFeed = () => {
  const [trackedAccounts, setTrackedAccounts] = useState([]);
  const [activities, setActivities] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const res = await axios.get(`${API}/accounts`);
      setTrackedAccounts(res.data);
      setLoading(false);
      res.data.forEach((acc) => fetchActivity(acc.username));
    } catch (error) {
      console.error('Error:', error);
      setLoading(false);
    }
  };

  const fetchActivity = async (username) => {
    try {
      const res = await axios.get(`${API}/profile/${username}/activity`);
      setActivities((prev) => ({ ...prev, [username]: res.data }));
    } catch (error) {
      console.error(`Activity error for ${username}:`, error);
    }
  };

  // Flatten all activities with username tag
  const allActivities = [];
  Object.entries(activities).forEach(([username, items]) => {
    (items || []).forEach((item) => {
      allActivities.push({ ...item, username });
    });
  });
  allActivities.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

  return (
    <div className="p-10 max-w-[1600px]">
      <div className="mb-10">
        <div className="inline-block text-[10px] font-mono uppercase tracking-[0.3em] text-[#ffffff] mb-3 inline-block pl-6">
          Surveillance Log
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold font-semibold tracking-tight text-[#fafafa] mb-2">
          Activity Feed
        </h1>
        <p className="text-[#a1a1aa]">Recent movements from tracked profiles, unified.</p>
        <div className="divider mt-6 max-w-md"></div>
      </div>

      {loading ? (
        <div className="card-modern rounded-md p-12 text-center text-[#737373]">
          Loading activity...
        </div>
      ) : trackedAccounts.length === 0 ? (
        <div className="card-modern rounded-md p-12 text-center">
          <div className="font-body text-2xl text-[#a1a1aa]">Nothing to observe.</div>
          <p className="text-sm text-[#737373] mt-2">Track a profile to see activity here.</p>
        </div>
      ) : allActivities.length === 0 ? (
        <div className="card-modern rounded-md p-12 text-center text-[#737373]">
          Fetching recent posts from tracked profiles...
        </div>
      ) : (
        <div className="space-y-3">
          {allActivities.map((activity, idx) => (
            <a
              key={`${activity.username}-${idx}`}
              href={activity.post_url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`activity-item-${idx}`}
              className="card-modern rounded-md p-5 flex items-start gap-4 group"
              style={{ animation: `fadeInUp 0.4s ease-out ${Math.min(idx, 10) * 0.03}s backwards` }}
            >
              {activity.media_url ? (
                <img
                  src={proxyImage(activity.media_url)}
                  alt=""
                  className="w-20 h-20 rounded-sm object-cover border border-[#1a1a1a]"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className="w-20 h-20 rounded-sm bg-[#0f0f0f] border border-[#262626] flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-[#ffffff]" strokeWidth={1.5} />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono text-sm font-semibold text-[#fafafa]">@{activity.username}</span>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#ffffff]">
                    {activity.post_type}
                  </span>
                  {activity.post_type === 'Video' && (
                    <Film className="w-3 h-3 text-[#ffffff]" />
                  )}
                  <span className="text-xs text-[#737373] ml-auto">{formatDate(activity.timestamp)}</span>
                </div>
                <p className="text-sm text-[#d4d4d8] line-clamp-2 mb-3">
                  {activity.content || 'New post'}
                </p>
                <div className="flex items-center gap-5 text-xs">
                  <div className="flex items-center gap-1.5 text-[#dc2626]">
                    <Heart className="w-3.5 h-3.5" strokeWidth={2} />
                    <span className="font-mono">{formatNumber(activity.likes)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#a1a1aa]">
                    <MessageCircle className="w-3.5 h-3.5" strokeWidth={2} />
                    <span className="font-mono">{formatNumber(activity.comments)}</span>
                  </div>
                  <div className="ml-auto text-[#737373] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <span className="text-[10px] font-mono uppercase">View post</span>
                    <ExternalLink className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActivityFeed;
