import { useEffect, useState } from 'react';
import axios from 'axios';
import { Users, TrendingUp, Activity, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const navigate = useNavigate();
  const [trackedAccounts, setTrackedAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrackedAccounts();
  }, []);

  const fetchTrackedAccounts = async () => {
    try {
      const res = await axios.get(`${API}/accounts`);
      setTrackedAccounts(res.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      setLoading(false);
    }
  };

  const stats = [
    { label: 'Tracked Accounts', value: trackedAccounts.length, icon: Users, color: '#2563EB' },
    { label: 'Total Followers', value: '324K', icon: TrendingUp, color: '#06B6D4' },
    { label: 'Active Today', value: trackedAccounts.length, icon: Activity, color: '#10B981' },
    { label: 'Insights Generated', value: '12', icon: Eye, color: '#8B5CF6' },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-[#F8FAFC] mb-2">
          Dashboard
        </h1>
        <p className="text-[#94A3B8]">Intelligence overview for tracked accounts</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              data-testid={`stat-card-${stat.label.toLowerCase().replace(/ /g, '-')}`}
              className="metric-card bg-[#0B101E] border border-[#1E293B] rounded-md p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className="w-12 h-12 rounded-md flex items-center justify-center"
                  style={{ backgroundColor: `${stat.color}20` }}
                >
                  <Icon className="w-6 h-6" style={{ color: stat.color }} strokeWidth={1.5} />
                </div>
              </div>
              <div className="text-3xl sm:text-4xl font-mono font-bold tracking-tight text-[#F8FAFC] mb-1">
                {stat.value}
              </div>
              <div className="text-xs font-mono uppercase tracking-[0.2em] text-[#475569]">
                {stat.label}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-[#0B101E] border border-[#1E293B] rounded-md p-6">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F8FAFC] mb-6">
          Tracked Accounts
        </h2>

        {loading ? (
          <p className="text-[#94A3B8]">Loading...</p>
        ) : trackedAccounts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#94A3B8] mb-4">No accounts tracked yet</p>
            <button
              onClick={() => navigate('/tracker')}
              data-testid="add-first-account-btn"
              className="px-6 py-3 bg-[#2563EB] hover:bg-[#3B82F6] text-white rounded-md font-medium transition-colors duration-200"
            >
              Track Your First Account
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trackedAccounts.map((account) => (
              <div
                key={account.id}
                data-testid={`account-card-${account.username}`}
                className="bg-[#111827] border border-[#1E293B] rounded-md p-4 hover:border-[#2563EB] transition-colors duration-200"
              >
                <div className="font-mono font-semibold text-[#F8FAFC] mb-1">@{account.username}</div>
                <div className="text-sm text-[#94A3B8]">
                  Tracking since {new Date(account.tracking_since).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;