import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Home' },
  { to: '/discover', label: 'Find Targets' },
  { to: '/outreach', label: 'Draft Outreach' },
  { to: '/batch', label: 'Batch Outreach' },
  { to: '/pipeline', label: 'My Pipeline' },
  { to: '/settings', label: 'Settings' },
];

export default function Sidebar() {
  return (
    <aside className="w-52 bg-neutral-900 border-r border-neutral-800 flex flex-col select-none">
      {/* Spacer for Electron traffic lights */}
      <div className="h-12 flex-shrink-0 draggable" />
      <div className="px-4 pb-4">
        <h1 className="text-sm font-semibold text-neutral-200 tracking-tight">BDR Copilot</h1>
        <p className="text-[11px] text-neutral-500">C3 AI</p>
      </div>
      <nav className="flex-1 px-2 space-y-0.5">
        {links.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) =>
              `block px-3 py-1.5 text-[13px] rounded transition-colors ${
                isActive
                  ? 'bg-neutral-800 text-neutral-100 font-medium'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-3 text-[11px] text-neutral-600">
        v0.2.0
      </div>
    </aside>
  );
}
