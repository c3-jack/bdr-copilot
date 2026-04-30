import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Discover from './pages/Discover';
import Outreach from './pages/Outreach';
import Pipeline from './pages/Pipeline';
import Settings from './pages/Settings';
import Batch from './pages/Batch';
import Home from './pages/Home';

export default function App() {
  return (
    <div className="flex h-screen overflow-hidden bg-neutral-950">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="h-12 flex-shrink-0 draggable" />
        <div className="px-8 pb-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/outreach" element={<Outreach />} />
            <Route path="/batch" element={<Batch />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
