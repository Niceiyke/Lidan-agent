'use client';
import { useState } from 'react';
import { Agent, Task, ApprovalRequest, Project } from '@agentic-os/types';
import { 
  LayoutDashboard, 
  Folder, 
  ListTodo, 
  CheckCircle, 
  Activity,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Plus
} from 'lucide-react';

type ViewType = 'dashboard' | 'projects' | 'tasks' | 'approvals' | 'activity' | 'workspace';

interface SidebarProps {
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
  projects: Project[];
  onSelectProject: (projectId: string) => void;
  sseStatus: 'connected' | 'disconnected';
}

const navItems = [
  { id: 'dashboard' as ViewType, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'projects' as ViewType, label: 'Projects', icon: Folder },
  { id: 'tasks' as ViewType, label: 'Tasks', icon: ListTodo },
  { id: 'approvals' as ViewType, label: 'Approvals', icon: CheckCircle },
  { id: 'activity' as ViewType, label: 'Activity', icon: Activity },
];

export function Sidebar({ 
  activeView, 
  setActiveView, 
  projects, 
  onSelectProject,
  sseStatus 
}: SidebarProps) {
  const [projectsExpanded, setProjectsExpanded] = useState(true);

  return (
    <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center">
            <span className="text-zinc-900 font-bold text-sm">AO</span>
          </div>
          <div>
            <h1 className="font-semibold text-zinc-100">Agentic OS</h1>
            <div className={`w-2 h-2 rounded-full ${sseStatus === 'connected' ? 'bg-green-500' : 'bg-zinc-600'}`} />
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 overflow-auto">
        <ul className="space-y-1">
          {navItems.map(item => (
            <li key={item.id}>
              <button
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeView === item.id
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            </li>
          ))}
        </ul>

        {/* Projects List */}
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <button
            onClick={() => setProjectsExpanded(!projectsExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-zinc-500 uppercase tracking-wider hover:text-zinc-400"
          >
            <span>Recent Projects</span>
            {projectsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          
          {projectsExpanded && (
            <ul className="mt-1 space-y-1">
              {projects.length === 0 ? (
                <li className="px-3 py-2 text-sm text-zinc-600 italic">
                  No projects yet
                </li>
              ) : (
                projects.slice(0, 10).map(project => (
                  <li key={project.id}>
                    <button
                      onClick={() => onSelectProject(project.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeView === 'workspace'
                          ? 'bg-zinc-800 text-zinc-100'
                          : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'
                      }`}
                    >
                      <FolderOpen size={16} />
                      <span className="truncate">{project.name}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </nav>

      {/* Create New */}
      <div className="p-4 border-t border-zinc-800">
        <button
          onClick={() => setActiveView('dashboard')}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors"
        >
          <Plus size={16} />
          New Project
        </button>
      </div>
    </aside>
  );
}
