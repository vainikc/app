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
      <div className="mb-10">
        <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#d4a656] mb-3">
          Reconnaissance
        </div>
        <h1 className="font-heading text-5xl sm:text-6xl font-semibold tracking-tight text-[#e8e6e1] mb-2">
          Search
        </h1>
        <p className="text-[#8a857e]">Preview any public Instagram profile before committing to observation.</p>
        <div className="divider-ornate mt-6 max-w-md"></div>
      </div>

      <div className="card-detective rounded-md p-6 mb-8">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6660]" />
            <Input
              data-testid="search-input"
              type="text"
              placeholder="Enter Instagram username (e.g., cristiano, natgeo)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-11 bg-[#0f0f0f] border-[#1f1f1f] focus:border-[#d4a656] focus:ring-[#d4a656] text-[#e8e6e1] font-mono h-11"
            />
          </div>
          <Button
            data-testid="search-btn"
            onClick={handleSearch}
            disabled={loading}
            className="bg-[#d4a656] hover:bg-[#c48f3e] text-[#0a0a0a] h-11 px-6 font-medium"
          >
            {loading ? 'Searching...' : 'Investigate'}
          </Button>
        </div>
      </div>

      {loading && (
        <div className="card-detective rounded-md p-12 text-center text-[#6b6660]">
          Fetching live profile data from Instagram...
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="card-detective rounded-md p-12 text-center">
          <div className="font-heading text-2xl text-[#8a857e]">No trace found.</div>
          <p className="text-sm text-[#6b6660] mt-2">Try an exact Instagram username.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {results.map((profile) => (
          <div
            key={profile.username}
            data-testid={`search-result-${profile.username}`}
            className="card-detective rounded-md p-6 animate-fade-in-up"
          >
            <div className="flex items-start gap-4 mb-5">
              {profile.profile_pic ? (
                <img
                  src={proxyImage(profile.profile_pic)}
                  alt={profile.username}
                  className="w-16 h-16 rounded-full border-2 border-[#d4a656]/60 object-cover"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#1a1613] border-2 border-[#d4a656]/40 flex items-center justify-center">
                  <span className="text-[#d4a656] font-mono text-xl">
                    {profile.username.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-mono text-lg font-semibold text-[#e8e6e1]">@{profile.username}</h3>
                  {profile.is_verified && <ShieldCheck className="w-4 h-4 text-[#d4a656]" strokeWidth={2} />}
                  {profile.is_private && <Lock className="w-3.5 h-3.5 text-[#8a857e]" />}
                  {profile.is_business && <Briefcase className="w-3.5 h-3.5 text-[#d4a656]" />}
                </div>
                <p className="font-heading text-lg text-[#c9c5be]">{profile.full_name}</p>
                {profile.bio && (
                  <p className="text-xs text-[#8a857e] mt-1 line-clamp-2 whitespace-pre-wrap">{profile.bio}</p>
                )}
                {profile.external_url && (
                  <a
                    href={profile.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[#d4a656] hover:text-[#e6d09e] mt-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Website
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 py-4 border-y border-[#1f1f1f] mb-5">
              <div className="text-center">
                <div className="font-mono text-lg font-bold text-[#e8e6e1]">
                  {profile.posts?.toLocaleString()}
                </div>
                <div className="text-[10px] uppercase font-mono text-[#6b6660] tracking-wider">Posts</div>
              </div>
              <div className="text-center border-x border-[#1f1f1f]">
                <div className="font-mono text-lg font-bold text-[#d4a656]">
                  {profile.followers?.toLocaleString()}
                </div>
                <div className="text-[10px] uppercase font-mono text-[#6b6660] tracking-wider">Followers</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-lg font-bold text-[#e8e6e1]">
                  {profile.following?.toLocaleString()}
                </div>
                <div className="text-[10px] uppercase font-mono text-[#6b6660] tracking-wider">Following</div>
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
                    className="aspect-square rounded-sm overflow-hidden border border-[#1f1f1f] hover:border-[#d4a656]"
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
              className="w-full bg-[#1a1613] hover:bg-[#221c17] border border-[#d4a656]/40 hover:border-[#d4a656] text-[#d4a656]"
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
