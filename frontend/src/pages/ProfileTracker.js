import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ProfileTracker = () => {
  const [username, setUsername] = useState('');
  const [trackedAccounts, setTrackedAccounts] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loadingProfile, setLoadingProfile] = useState({});
  const [insights, setInsights] = useState({});
  const [loadingInsights, setLoadingInsights] = useState({});

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
    setLoadingProfile((prev) => ({ ...prev, [username]: true }));
    try {
      const res = await axios.get(`${API}/accounts/${username}/profile`);
      setProfiles((prev) => ({ ...prev, [username]: res.data }));
    } catch (error) {
      console.error('Error:', error);
    }
    setLoadingProfile((prev) => ({ ...prev, [username]: false }));
  };

  const fetchInsights = async (username) => {
    setLoadingInsights((prev) => ({ ...prev, [username]: true }));
    try {
      const res = await axios.get(`${API}/insights/${username}`, {
        responseType: 'text',
      });
      
      if (res.data.startsWith('data:')) {
        let fullInsight = '';
        const lines = res.data.split('\n');
        lines.forEach((line) => {
          if (line.startsWith('data:')) {
            try {
              const json = JSON.parse(line.replace('data: ', ''));
              if (json.content) fullInsight += json.content;
            } catch (e) {}
          }
        });
        setInsights((prev) => ({ ...prev, [username]: fullInsight }));
      } else if (res.data.insights) {
        setInsights((prev) => ({ ...prev, [username]: res.data.insights }));
      }
    } catch (error) {
      console.error('Error:', error);
      setInsights((prev) => ({ ...prev, [username]: 'Error loading insights' }));
    }
    setLoadingInsights((prev) => ({ ...prev, [username]: false }));
  };

  const handleAddAccount = async () => {
    if (!username.trim()) {
      toast.error('Please enter a username');
      return;
    }
    try {
      await axios.post(`${API}/accounts?username=${username}`);
      toast.success('Account added successfully');
      setUsername('');
      fetchTrackedAccounts();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error adding account');
    }
  };

  const handleRemoveAccount = async (username) => {
    try {
      await axios.delete(`${API}/accounts/${username}`);
      toast.success('Account removed');
      fetchTrackedAccounts();
    } catch (error) {
      toast.error('Error removing account');
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-[#F8FAFC] mb-2">
          Profile Tracker
        </h1>
        <p className="text-[#94A3B8]">Add and monitor Instagram accounts</p>
      </div>

      <div className="bg-[#0B101E] border border-[#1E293B] rounded-md p-6 mb-8">
        <h2 className="text-xl font-semibold text-[#F8FAFC] mb-4">Add New Account</h2>
        <div className="flex gap-3">
          <Input
            data-testid="username-input"
            type="text"
            placeholder="Enter Instagram username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddAccount()}
            className="flex-1 bg-[#0B101E] border-[#1E293B] text-[#F8FAFC]"
          />
          <Button
            data-testid="add-account-btn"
            onClick={handleAddAccount}
            className="bg-[#2563EB] hover:bg-[#3B82F6] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Track Account
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {trackedAccounts.map((account) => {
          const profile = profiles[account.username];
          const insight = insights[account.username];
          return (
            <div
              key={account.id}
              data-testid={`profile-card-${account.username}`}
              className="bg-[#0B101E] border border-[#1E293B] rounded-md p-6"
            >
              {loadingProfile[account.username] ? (
                <p className="text-[#94A3B8]">Loading profile...</p>
              ) : profile ? (
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <img
                        src={profile.profile_pic}
                        alt={profile.username}
                        className="w-16 h-16 rounded-full border-2 border-[#2563EB]"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-bold text-[#F8FAFC]">@{profile.username}</h3>
                          {profile.is_verified && (
                            <div className="w-5 h-5 bg-[#2563EB] rounded-full flex items-center justify-center">
                              <span className="text-white text-xs">✓</span>
                            </div>
                          )}
                        </div>
                        <p className="text-[#94A3B8]">{profile.full_name}</p>
                      </div>
                    </div>
                    <Button
                      data-testid={`remove-btn-${account.username}`}
                      onClick={() => handleRemoveAccount(account.username)}
                      variant="destructive"
                      size="sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <p className="text-[#94A3B8] mb-4">{profile.bio}</p>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-mono font-bold text-[#F8FAFC]">
                        {profile.posts?.toLocaleString()}
                      </div>
                      <div className="text-xs font-mono uppercase text-[#475569]">Posts</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-mono font-bold text-[#F8FAFC]">
                        {profile.followers?.toLocaleString()}
                      </div>
                      <div className="text-xs font-mono uppercase text-[#475569]">Followers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-mono font-bold text-[#F8FAFC]">
                        {profile.following?.toLocaleString()}
                      </div>
                      <div className="text-xs font-mono uppercase text-[#475569]">Following</div>
                    </div>
                  </div>

                  <Button
                    data-testid={`insights-btn-${account.username}`}
                    onClick={() => fetchInsights(account.username)}
                    className="w-full bg-gradient-to-r from-[#2563EB] to-[#06B6D4] hover:opacity-90 text-white"
                    disabled={loadingInsights[account.username]}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {loadingInsights[account.username] ? 'Generating...' : 'Generate AI Insights'}
                  </Button>

                  {insight && (
                    <div className="mt-4 p-4 bg-[#111827] border border-[#2563EB]/30 rounded-md">
                      <p className="text-[#F8FAFC] text-sm leading-relaxed">{insight}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[#94A3B8]">@{account.username}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProfileTracker;