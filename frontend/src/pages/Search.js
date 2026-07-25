import { useState } from 'react';
import axios from 'axios';
import { Search as SearchIcon, Plus, ShieldCheck, Lock, Briefcase, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { proxyImage } from '@/lib/imageProxy';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Search = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [tracking, setTracking] = useState({});

  const handleSearch = async () => {
    const cleaned = query.trim().replace(/^@/, '');
    if (!cleaned) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await axios.get(`${API}/search?q=${cleaned}`);
      setResults(res.data);
      if (res.data.length === 0) {
        toast.error(`No profile found for @${cleaned}`);
      }
    } catch (error) {
      toast.error('Search failed');
      setResults([]);
    }
    setLoading(false);
  };

  const handleTrack = async (username) => {
    setTracking((t) => ({ ...t, [username]: true }));
    try {
      await axios.post(`${API}/accounts?username=${username}`);
      toast.success(`Now tracking @${username}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to track');
    }
    setTracking((t) => ({ ...t, [username]: false }));
  };

  return (
    <div className="p-10 max-w-[1600px]">
      <div className="mb-10 pl-8 hero-crosshair">
        <div className="inline-block text-[10px] font-mono uppercase tracking-[0.3em] text-[#a3e635] mb-3 inline-block">
          Reconnaissance
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold font-semibold tracking-tight text-[#fafafa] mb-2">
          Search
        </h1>
        <p className="text-[#a1a1aa]">Preview any public Instagram profile before committing to observation.</p>
        <div className="divider mt-6 max-w-md"></div>
      </div>

      <div className="card-modern rounded-md p-6 mb-8">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
            <Input
              data-testid="search-input"
              type="text"
              placeholder="Enter Instagram username (e.g., cristiano, natgeo)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-11 bg-[#000000] border-[#1a1a1a] focus:border-[#ffffff] focus:ring-[#ffffff] text-[#fafafa] font-mono h-11"
            />
          </div>
          <Button
            data-testid="search-btn"
            onClick={handleSearch}
            disabled={loading}
            className="bg-[#ffffff] hover:bg-[#e5e5e5] text-[#000000] h-11 px-6 font-medium"
          >
            {loading ? 'Searching...' : 'Investigate'}
          </Button>
        </div>
      </div>

      {loading && (
        <div className="card-modern rounded-md p-12 text-center text-[#737373]">
          Fetching live profile data from Instagram...
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="card-modern rounded-md p-12 text-center">
          <div className="font-body text-2xl text-[#a1a1aa]">No trace found.</div>
          <p className="text-sm text-[#737373] mt-2">Try an exact Instagram username.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {results.map((profile) => (
          <div
            key={profile.username}
            data-testid={`search-result-${profile.username}`}
            className="card-modern rounded-md p-6 animate-fade-in-up"
          >
            <div className="flex items-start gap-4 mb-5">
              {profile.profile_pic ? (
                <img
                  src={proxyImage(profile.profile_pic)}
                  alt={profile.username}
                  className="w-16 h-16 rounded-full border-2 border-[#ffffff]/60 object-cover"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#0f0f0f] border-2 border-[#ffffff]/40 flex items-center justify-center">
                  <span className="text-[#ffffff] font-mono text-xl">
                    {profile.username.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-mono text-lg font-semibold text-[#fafafa]">@{profile.username}</h3>
                  {profile.is_verified && <ShieldCheck className="w-4 h-4 text-[#ffffff]" strokeWidth={2} />}
                  {profile.is_private && <Lock className="w-3.5 h-3.5 text-[#a1a1aa]" />}
                  {profile.is_business && <Briefcase className="w-3.5 h-3.5 text-[#ffffff]" />}
                </div>
                <p className="font-body text-lg text-[#d4d4d8]">{profile.full_name}</p>
                {profile.bio && (
                  <p className="text-xs text-[#a1a1aa] mt-1 line-clamp-2 whitespace-pre-wrap">{profile.bio}</p>
                )}
                {profile.external_url && (
                  <a
                    href={profile.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[#ffffff] hover:text-[#f5f5f5] mt-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Website
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 py-4 border-y border-[#1a1a1a] mb-5">
              <div className="text-center">
                <div className="font-mono text-lg font-bold text-[#fafafa]">
                  {profile.posts?.toLocaleString()}
                </div>
                <div className="text-[10px] uppercase font-mono text-[#737373] tracking-wider">Posts</div>
              </div>
              <div className="text-center border-x border-[#1a1a1a]">
                <div className="font-mono text-lg font-bold text-[#ffffff]">
                  {profile.followers?.toLocaleString()}
                </div>
                <div className="text-[10px] uppercase font-mono text-[#737373] tracking-wider">Followers</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-lg font-bold text-[#fafafa]">
                  {profile.following?.toLocaleString()}
                </div>
                <div className="text-[10px] uppercase font-mono text-[#737373] tracking-wider">Following</div>
              </div>
            </div>

            {profile.recent_posts && profile.recent_posts.length > 0 && (
              <div className="grid grid-cols-4 gap-1.5 mb-4">
                {profile.recent_posts.slice(0, 4).map((p) => (
                  <a
                    key={p.id}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="aspect-square rounded-sm overflow-hidden border border-[#1a1a1a] hover:border-[#ffffff]"
                  >
                    {p.display_url && (
                      <img
                        src={proxyImage(p.display_url)}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                  </a>
                ))}
              </div>
            )}

            <Button
              data-testid={`track-btn-${profile.username}`}
              onClick={() => handleTrack(profile.username)}
              disabled={tracking[profile.username]}
              className="w-full bg-[#0f0f0f] hover:bg-[#1a1a1a] border border-[#ffffff]/40 hover:border-[#ffffff] text-[#ffffff]"
            >
              <Plus className="w-4 h-4 mr-2" />
              {tracking[profile.username] ? 'Adding...' : 'Track This Profile'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Search;
