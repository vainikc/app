import { useEffect, useState } from 'react';
import axios from 'axios';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Papa from 'papaparse';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Reports = () => {
  const [trackedAccounts, setTrackedAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [history, setHistory] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      fetchData(selectedAccount);
    }
  }, [selectedAccount]);

  const fetchAccounts = async () => {
    try {
      const res = await axios.get(`${API}/accounts`);
      setTrackedAccounts(res.data);
      if (res.data.length > 0) {
        setSelectedAccount(res.data[0].username);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchData = async (username) => {
    setLoading(true);
    try {
      const [histRes, profRes] = await Promise.all([
        axios.get(`${API}/profile/${username}/history`),
        axios.get(`${API}/profile/${username}`)
      ]);
      setProfile(profRes.data);
      const chartData = histRes.data.map((h) => ({
        date: new Date(h.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' }),
        followers: h.followers,
        following: h.following,
        posts: h.posts,
      }));
      setHistory(chartData);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleExportCSV = () => {
    if (!history || history.length === 0) return;
    const csv = Papa.unparse(history);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedAccount}_report_${Date.now()}.csv`;
    a.click();
  };

  const engagementData = profile?.recent_posts?.slice(0, 10).reverse().map((p, i) => ({
    idx: `Post ${i + 1}`,
    engagement: (p.likes || 0) + (p.comments || 0),
    likes: p.likes || 0,
    comments: p.comments || 0,
  })) || [];

  return (
    <div className="p-10 max-w-[1600px]">
      <div className="mb-10">
        <div className="corner-ornament text-[10px] font-mono uppercase tracking-[0.3em] text-[#d4a656] mb-3 inline-block pl-6">
          Case Reports
        </div>
        <h1 className="font-heading text-5xl sm:text-6xl font-semibold tracking-tight text-[#e8e6e1] mb-2">
          Reports
        </h1>
        <p className="text-[#8a857e]">Historical patterns, engagement, and export-ready evidence.</p>
        <div className="divider-ornate mt-6 max-w-md"></div>
      </div>

      {trackedAccounts.length === 0 ? (
        <div className="card-vintage rounded-md p-12 text-center">
          <div className="font-heading text-2xl text-[#8a857e]">No cases to report on.</div>
          <p className="text-sm text-[#6b6660] mt-2">Track profiles to generate reports.</p>
        </div>
      ) : (
        <>
          <div className="card-vintage rounded-md p-6 mb-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#6b6660] mb-2">Select Case</div>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger
                    data-testid="account-select"
                    className="w-full max-w-md bg-[#0f0f0f] border-[#1f1f1f] text-[#e8e6e1] font-mono"
                  >
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141414] border-[#1f1f1f]">
                    {trackedAccounts.map((acc) => (
                      <SelectItem
                        key={acc.id}
                        value={acc.username}
                        className="text-[#e8e6e1] focus:bg-[#1a1613] focus:text-[#d4a656] font-mono"
                      >
                        @{acc.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                data-testid="export-csv-btn"
                onClick={handleExportCSV}
                disabled={history.length === 0}
                className="bg-[#d4a656] hover:bg-[#c48f3e] text-[#0a0a0a] font-medium"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          {profile && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Followers', value: profile.followers?.toLocaleString() },
                { label: 'Following', value: profile.following?.toLocaleString() },
                { label: 'Posts', value: profile.posts?.toLocaleString() },
                { label: 'Data Points', value: history.length },
              ].map((s, i) => (
                <div key={i} className="card-vintage rounded-md p-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#6b6660]">{s.label}</div>
                  <div className="font-mono text-2xl font-bold text-[#e8e6e1] mt-2">{s.value}</div>
                </div>
              ))}
            </div>
          )}

          <div className="card-vintage rounded-md p-6 mb-6">
            <h2 className="font-heading text-2xl font-semibold text-[#e8e6e1] mb-6">Follower Growth</h2>
            {loading ? (
              <div className="text-[#6b6660] text-center py-12">Loading...</div>
            ) : history.length < 2 ? (
              <div className="text-[#6b6660] text-center py-12">
                <p>Not enough data yet.</p>
                <p className="text-xs mt-2">Snapshots are taken automatically when this profile is viewed. Come back later.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d4a656" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#d4a656" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                  <XAxis dataKey="date" stroke="#6b6660" style={{ fontFamily: 'JetBrains Mono', fontSize: 11 }} />
                  <YAxis stroke="#6b6660" style={{ fontFamily: 'JetBrains Mono', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f0f0f',
                      border: '1px solid #1f1f1f',
                      borderRadius: 4,
                      color: '#e8e6e1',
                      fontFamily: 'JetBrains Mono',
                    }}
                  />
                  <Area type="monotone" dataKey="followers" stroke="#d4a656" strokeWidth={2} fill="url(#amberGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card-vintage rounded-md p-6">
            <h2 className="font-heading text-2xl font-semibold text-[#e8e6e1] mb-6">Engagement Per Post</h2>
            {engagementData.length === 0 ? (
              <div className="text-[#6b6660] text-center py-12">No recent posts to analyze.</div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={engagementData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                  <XAxis dataKey="idx" stroke="#6b6660" style={{ fontFamily: 'JetBrains Mono', fontSize: 11 }} />
                  <YAxis stroke="#6b6660" style={{ fontFamily: 'JetBrains Mono', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f0f0f',
                      border: '1px solid #1f1f1f',
                      borderRadius: 4,
                      color: '#e8e6e1',
                      fontFamily: 'JetBrains Mono',
                    }}
                  />
                  <Bar dataKey="likes" stackId="a" fill="#d4a656" />
                  <Bar dataKey="comments" stackId="a" fill="#8b5f2b" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Reports;
