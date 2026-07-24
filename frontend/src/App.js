import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import ProfileTracker from '@/pages/ProfileTracker';
import ActivityFeed from '@/pages/ActivityFeed';
import RelationshipMap from '@/pages/RelationshipMap';
import Reports from '@/pages/Reports';
import Search from '@/pages/Search';
import { Toaster } from '@/components/ui/sonner';
import '@/App.css';

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="tracker" element={<ProfileTracker />} />
            <Route path="activity" element={<ActivityFeed />} />
            <Route path="map" element={<RelationshipMap />} />
            <Route path="reports" element={<Reports />} />
            <Route path="search" element={<Search />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </>
  );
}

export default App;