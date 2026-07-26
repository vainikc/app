import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import ProfileTracker from '@/pages/ProfileTracker';
import ActivityFeed from '@/pages/ActivityFeed';
import DeepDive from '@/pages/RelationshipMap';
import Reports from '@/pages/Reports';
import { Toaster } from '@/components/ui/sonner';
import axios from 'axios';
import '@/App.css';

axios.defaults.withCredentials = true;

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="tracker" element={<ProfileTracker />} />
            <Route path="activity" element={<ActivityFeed />} />
            <Route path="map" element={<DeepDive />} />
            <Route path="reports" element={<Reports />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </>
  );
}

export default App;
