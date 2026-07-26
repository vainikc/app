import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Connections from '@/pages/Connections';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ProfileTracker = () => {
  const [trackedAccounts, setTrackedAccounts] = useState([]);
  const [username, setUsername] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchTrackedAccounts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTrackedAccounts = async () => {
    try {
      const res = await axios.get(`${API}/accounts`);
      setTrackedAccounts(res.data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleAddAccount = async () => {
    const cleaned = username.trim().replace(/^@/, '');
    if (!cleaned) { toast.error('Enter an Instagram username'); return; }
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

  const handleRemove = async (u) => {
    try {
      await axios.delete(`${API}/accounts/${u}`);
      toast.success(`Removed @${u}`);
      fetchTrackedAccounts();
    } catch {
      toast.error('Error removing account');
    }
  };

  return (
    <div className="p-10 max-w-[1600px]">
      <div className="mb-10 pl-8 hero-crosshair">
        <div className="inline-block text-[10px] font-mono uppercase tracking-[0.3em] text-[#a3e635] mb-3">
          Investigations
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-[#fafafa] mb-2">
          Investigate
        </h1>
        <p className="text-[#a1a1aa]">Open a new case, then dig into the connections below.</p>
        <div className="divider mt-6 max-w-md"></div>
      </div>

      <div className="card-modern rounded-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4 text-[#a3e635]" strokeWidth={2} />
          <span className="text-base font-semibold text-white">Open New Investigation</span>
        </div>
        <div className="flex gap-2">
          <Input
            data-testid="username-input"
            placeholder="@ cristiano, natgeo, humansofny..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !adding && handleAddAccount()}
            className="flex-1 font-mono text-sm bg-[#0a0a0a] border-[#1f1f1f] text-white placeholder-[#525252] focus-visible:border-[#a3e635]/40"
          />
          <Button
            onClick={handleAddAccount}
            disabled={adding}
            data-testid="add-account-btn"
            className="bg-[#a3e635] text-black hover:bg-[#bef264] shadow-[0_0_20px_-6px_rgba(163,230,53,0.5)] font-semibold"
          >
            {adding ? 'Tracking...' : 'Track'}
          </Button>
        </div>
        <p className="text-xs text-[#525252] mt-2">Live data via Apify. Fetch may take 10–30 seconds on first request.</p>

        {trackedAccounts.length > 0 && (
          <div className="mt-5 pt-5 border-t border-[#141414]">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#525252] mb-2">
              Active cases ({trackedAccounts.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {trackedAccounts.map((a) => (
                <div
                  key={a.id}
                  data-testid={`case-chip-${a.username}`}
                  className="group flex items-center gap-2 bg-[#0f0f0f] border border-[#1f1f1f] rounded-full pl-3 pr-1 py-1"
                >
                  <span className="font-mono text-xs text-white">@{a.username}</span>
                  <button
                    onClick={() => handleRemove(a.username)}
                    data-testid={`remove-case-${a.username}`}
                    title={`Stop tracking @${a.username}`}
                    className="w-5 h-5 rounded-full text-[#525252] hover:text-[#dc2626] hover:bg-[#1a0a0a] flex items-center justify-center transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {trackedAccounts.length > 0 && (
        <div className="mt-6">
          <Connections embedded />
        </div>
      )}
    </div>
  );
};

export default ProfileTracker;
