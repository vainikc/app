import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus } from 'lucide-react';
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
  const [selected, setSelected] = useState('');

  useEffect(() => {
    fetchTrackedAccounts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTrackedAccounts = async (preferred = '') => {
    try {
      const res = await axios.get(`${API}/accounts`);
      setTrackedAccounts(res.data);
      setSelected((current) => {
        if (preferred && res.data.some((a) => a.username === preferred)) return preferred;
        if (res.data.some((a) => a.username === current)) return current;
        return res.data[0]?.username || '';
      });
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
      await fetchTrackedAccounts(res.data.profile.username);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error adding account');
    }
    setAdding(false);
  };

  const handleRemove = async (u) => {
    try {
      await axios.delete(`${API}/accounts/${u}`);
      toast.success(`Removed @${u}`);
      await fetchTrackedAccounts();
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

      </div>

      {trackedAccounts.length > 0 && (
        <div className="mt-6">
          <Connections
            embedded
            accounts={trackedAccounts}
            selectedAccount={selected}
            onSelectedAccountChange={setSelected}
            onRemoveAccount={handleRemove}
          />
        </div>
      )}
    </div>
  );
};

export default ProfileTracker;
