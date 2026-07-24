import { useEffect, useState } from 'react';
import axios from 'axios';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Papa from 'papaparse';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Reports = () => {
  const [trackedAccounts, setTrackedAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [followerData, setFollowerData] = useState([]);

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      fetchFollowerHistory(selectedAccount);
    }
  }, [selectedAccount]);

  const fetchAccounts = async () => {
    try {
      const res = await axios.get(`${API}/accounts`);
      setTrackedAccounts(res.data);
      if (res.data.length > 0) {
        setSelectedAccount(res.data[0].username);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchFollowerHistory = async (username) => {
    try {
      const res = await axios.get(`${API}/accounts/${username}/followers`);
      const formatted = res.data.map((item) => ({
        date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        followers: item.count,
      }));
      setFollowerData(formatted);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleExportCSV = () => {
    if (followerData.length === 0) return;
    const csv = Papa.unparse(followerData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedAccount}_follower_report.csv`;
    link.click();
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-[#F8FAFC] mb-2">
          Reports
        </h1>
        <p className="text-[#94A3B8]">Analytics and growth trends</p>
      </div>

      {trackedAccounts.length === 0 ? (
        <div className="bg-[#0B101E] border border-[#1E293B] rounded-md p-12 text-center">
          <p className="text-[#94A3B8]">No tracked accounts. Add accounts to view reports.</p>
        </div>
      ) : (
        <>
          <div className="bg-[#0B101E] border border-[#1E293B] rounded-md p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-[#F8FAFC]">Select Account</h2>
              <Button
                data-testid="export-csv-btn"
                onClick={handleExportCSV}
                className="bg-[#06B6D4] hover:bg-[#22D3EE] text-white"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger data-testid="account-select" className="w-full bg-[#111827] border-[#1E293B] text-[#F8FAFC]">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent className="bg-[#0B101E] border-[#1E293B]">
                {trackedAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.username} className="text-[#F8FAFC] focus:bg-[#111827]">
                    @{acc.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-[#0B101E] border border-[#1E293B] rounded-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-[#F8FAFC] mb-6">Follower Growth</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={followerData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="date" stroke="#94A3B8" style={{ fontFamily: 'JetBrains Mono' }} />
                <YAxis stroke="#94A3B8" style={{ fontFamily: 'JetBrains Mono' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B101E',
                    border: '1px solid #1E293B',
                    borderRadius: '8px',
                    color: '#F8FAFC',
                  }}
                />
                <Line type="monotone" dataKey="followers" stroke="#2563EB" strokeWidth={3} dot={{ fill: '#2563EB', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[#0B101E] border border-[#1E293B] rounded-md p-6">
            <h2 className="text-xl font-semibold text-[#F8FAFC] mb-6">Engagement Trends</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={[
                  { name: 'Mon', engagement: 45 },
                  { name: 'Tue', engagement: 52 },
                  { name: 'Wed', engagement: 38 },
                  { name: 'Thu', engagement: 67 },
                  { name: 'Fri', engagement: 81 },
                  { name: 'Sat', engagement: 94 },
                  { name: 'Sun', engagement: 72 },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="name" stroke="#94A3B8" style={{ fontFamily: 'JetBrains Mono' }} />
                <YAxis stroke="#94A3B8" style={{ fontFamily: 'JetBrains Mono' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B101E',
                    border: '1px solid #1E293B',
                    borderRadius: '8px',
                    color: '#F8FAFC',
                  }}
                />
                <Bar dataKey="engagement" fill="#06B6D4" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
};

export default Reports;