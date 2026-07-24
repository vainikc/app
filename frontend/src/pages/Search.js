import { useState } from 'react';
import axios from 'axios';
import { Search as SearchIcon, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Search = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/search?q=${query}`);
      setResults(res.data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error searching profiles');
    }
    setLoading(false);
  };

  const handleTrackProfile = async (username) => {
    try {
      await axios.post(`${API}/accounts?username=${username}`);
      toast.success(`Now tracking @${username}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error tracking account');
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-[#F8FAFC] mb-2">
          Search
        </h1>
        <p className="text-[#94A3B8]">Find and preview Instagram profiles</p>
      </div>

      <div className="bg-[#0B101E] border border-[#1E293B] rounded-md p-6 mb-8">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#475569]" />
            <Input
              data-testid="search-input"
              type="text"
              placeholder="Search Instagram profiles..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10 bg-[#0B101E] border-[#1E293B] text-[#F8FAFC]"
            />
          </div>
          <Button
            data-testid="search-btn"
            onClick={handleSearch}
            disabled={loading}
            className="bg-[#2563EB] hover:bg-[#3B82F6] text-white"
          >
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {results.map((profile) => (
          <div
            key={profile.username}
            data-testid={`search-result-${profile.username}`}
            className="bg-[#0B101E] border border-[#1E293B] rounded-md p-6 hover:border-[#2563EB] transition-colors duration-200"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <img
                  src={profile.profile_pic}
                  alt={profile.username}
                  className="w-12 h-12 rounded-full border-2 border-[#2563EB]"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-[#F8FAFC]">@{profile.username}</h3>
                    {profile.is_verified && (
                      <div className="w-4 h-4 bg-[#2563EB] rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-[#94A3B8]">{profile.full_name}</p>
                </div>
              </div>
            </div>

            <p className="text-[#94A3B8] text-sm mb-4 line-clamp-2">{profile.bio}</p>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="text-center">
                <div className="text-lg font-mono font-bold text-[#F8FAFC]">
                  {profile.posts?.toLocaleString()}
                </div>
                <div className="text-xs text-[#475569]">Posts</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-mono font-bold text-[#F8FAFC]">
                  {profile.followers?.toLocaleString()}
                </div>
                <div className="text-xs text-[#475569]">Followers</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-mono font-bold text-[#F8FAFC]">
                  {profile.following?.toLocaleString()}
                </div>
                <div className="text-xs text-[#475569]">Following</div>
              </div>
            </div>

            <Button
              data-testid={`track-btn-${profile.username}`}
              onClick={() => handleTrackProfile(profile.username)}
              className="w-full bg-[#2563EB] hover:bg-[#3B82F6] text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Track Account
            </Button>
          </div>
        ))}
      </div>

      {results.length === 0 && !loading && query && (
        <div className="text-center py-12">
          <p className="text-[#94A3B8]">No results found. Try searching for "fashionista" or "travel"</p>
        </div>
      )}
    </div>
  );
};

export default Search;