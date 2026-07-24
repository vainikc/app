import { useEffect, useState } from 'react';
import axios from 'axios';
import { Heart, MessageCircle, Image as ImageIcon, Clock } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ActivityFeed = () => {
  const [trackedAccounts, setTrackedAccounts] = useState([]);
  const [activities, setActivities] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/accounts`);
      setTrackedAccounts(res.data);
      
      for (const account of res.data) {
        const actRes = await axios.get(`${API}/accounts/${account.username}/activity`);
        setActivities((prev) => ({ ...prev, [account.username]: actRes.data }));
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'like':
        return <Heart className="w-5 h-5 text-[#EF4444]" />;
      case 'comment':
        return <MessageCircle className="w-5 h-5 text-[#06B6D4]" />;
      case 'post':
        return <ImageIcon className="w-5 h-5 text-[#2563EB]" />;
      case 'story':
        return <Clock className="w-5 h-5 text-[#F59E0B]" />;
      default:
        return <Clock className="w-5 h-5 text-[#94A3B8]" />;
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-[#F8FAFC] mb-2">
          Activity Feed
        </h1>
        <p className="text-[#94A3B8]">Recent activity from tracked accounts</p>
      </div>

      {trackedAccounts.length === 0 ? (
        <div className="bg-[#0B101E] border border-[#1E293B] rounded-md p-12 text-center">
          <p className="text-[#94A3B8]">No tracked accounts. Add accounts to see their activity.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {trackedAccounts.map((account) => (
            <div
              key={account.id}
              data-testid={`activity-section-${account.username}`}
              className="bg-[#0B101E] border border-[#1E293B] rounded-md p-6"
            >
              <h2 className="text-xl font-bold text-[#F8FAFC] mb-4">@{account.username}</h2>
              
              {activities[account.username] ? (
                <div className="space-y-3">
                  {activities[account.username].map((activity, idx) => (
                    <div
                      key={idx}
                      data-testid={`activity-item-${idx}`}
                      className="flex items-start gap-4 p-4 bg-[#111827] rounded-md hover:bg-[#1E293B] transition-colors duration-200"
                    >
                      <div className="mt-1">{getActivityIcon(activity.type)}</div>
                      <div className="flex-1">
                        <p className="text-[#F8FAFC]">{activity.content}</p>
                        <p className="text-sm text-[#475569] mt-1">
                          {new Date(activity.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div
                        className="px-3 py-1 rounded-full text-xs font-mono uppercase"
                        style={{
                          backgroundColor: `${activity.type === 'like' ? '#EF4444' : activity.type === 'post' ? '#2563EB' : '#06B6D4'}20`,
                          color: activity.type === 'like' ? '#EF4444' : activity.type === 'post' ? '#2563EB' : '#06B6D4',
                        }}
                      >
                        {activity.type}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[#94A3B8]">Loading activity...</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActivityFeed;