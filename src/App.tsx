import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Discover from './pages/Discover';
import Outreach from './pages/Outreach';
import Pipeline from './pages/Pipeline';

export default function App() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <Routes>
          <Route path="/discover" element={<Discover />} />
          <Route path="/outreach" element={<Outreach />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="*" element={<Navigate to="/discover" replace />} />
        </Routes>
      </main>
    </div>
  );
}
