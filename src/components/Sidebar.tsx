import { NavLink } from 'react-router-dom';

const links = [
  { to: '/discover', label: 'Find Targets', icon: '🔍' },
  { to: '/outreach', label: 'Draft Outreach', icon: '✉️' },
  { to: '/pipeline', label: 'My Pipeline', icon: '📊' },
];

export default function Sidebar() {
  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-lg font-bold text-white tracking-tight">BDR Copilot</h1>
        <p className="text-xs text-gray-500 mt-0.5">C3 AI Prospecting</p>
      </div>
      <nav className="flex-1 py-4">
        {links.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400 border-r-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`
            }
          >
            <span>{link.icon}</span>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-800 text-xs text-gray-600">
        v0.1.0
      </div>
    </aside>
  );
}
