'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Agent, Task, ApprovalRequest, Project } from '@agentic-os/types';
import { GoalInput } from '@/components/GoalInput';
import { AgentDashboard } from '@/components/AgentDashboard';
import { TaskGraph } from '@/components/TaskGraph';
import { ApprovalQueue } from '@/components/ApprovalQueue';
import { ActivityFeed } from '@/components/ActivityFeed';
import { Sidebar } from '@/components/Sidebar';
import { ProjectWorkspace } from '@/components/ProjectWorkspace';
import { DiffViewer } from '@/components/DiffViewer';
import { ApprovalModal } from '@/components/ApprovalQueue';

export interface AgentEvent {
  type: string;
  agentId: string;
  taskId?: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

type ViewType = 'dashboard' | 'projects' | 'tasks' | 'approvals' | 'activity' | 'workspace' | 'diff';

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [sseStatus, setSseStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [diffData, setDiffData] = useState<{ diff: string; oldPath?: string; newPath?: string } | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);

  const connectSSE = useCallback(() => {
    const eventSource = new EventSource('/events/stream');
    
    eventSource.addEventListener('connected', () => {
      console.log('SSE connected');
      setSseStatus('connected');
    });

    // Agent events
    eventSource.addEventListener('agent:created', (e) => {
      const agent = JSON.parse(e.data);
      setAgents(prev => [...prev, agent]);
      addEvent({ type: 'agent:created', agentId: agent.id, data: agent });
    });

    eventSource.addEventListener('agent:updated', (e) => {
      const data = JSON.parse(e.data);
      setAgents(prev => prev.map(a => a.id === data.agentId ? { ...a, ...data } : a));
    });

    eventSource.addEventListener('agent:status', (e) => {
      const data = JSON.parse(e.data);
      setAgents(prev => prev.map(a => a.id === data.agentId ? { ...a, status: data.status } : a));
    });

    eventSource.addEventListener('agent:token', (e) => {
      const data = JSON.parse(e.data);
      addEvent({ type: 'token', agentId: data.agentId, data });
    });

    eventSource.addEventListener('agent:tool_start', (e) => {
      const data = JSON.parse(e.data);
      addEvent({ type: 'agent:tool_start', agentId: data.agentId, data });
    });

    eventSource.addEventListener('agent:tool_end', (e) => {
      const data = JSON.parse(e.data);
      addEvent({ type: 'agent:tool_end', agentId: data.agentId, data });
    });

    // Task events
    eventSource.addEventListener('task:created', (e) => {
      const data = JSON.parse(e.data);
      const task: Task = data.task || { id: data.taskId, type: data.type, title: '', description: '', status: 'pending', priority: 'medium' };
      setTasks(prev => [...prev.filter(t => t.id !== task.id), task]);
      addEvent({ type: 'task:created', agentId: '', taskId: data.taskId, data });
    });

    eventSource.addEventListener('task:updated', (e) => {
      const data = JSON.parse(e.data);
      setTasks(prev => prev.map(t => t.id === data.taskId ? { ...t, ...data } : t));
    });

    eventSource.addEventListener('task:queued', (e) => {
      const data = JSON.parse(e.data);
      setTasks(prev => prev.map(t => t.id === data.taskId ? { ...t, status: 'queued' as const } : t));
      addEvent({ type: 'task:queued', agentId: '', taskId: data.taskId, data });
    });

    eventSource.addEventListener('task:running', (e) => {
      const data = JSON.parse(e.data);
      setTasks(prev => prev.map(t => t.id === data.taskId ? { ...t, status: 'running' as const } : t));
      addEvent({ type: 'task:running', agentId: '', taskId: data.taskId, data });
    });

    eventSource.addEventListener('task:done', (e) => {
      const data = JSON.parse(e.data);
      setTasks(prev => prev.map(t => t.id === data.taskId ? { ...t, status: 'done' as const, result: data.result } : t));
      addEvent({ type: 'task:done', agentId: '', taskId: data.taskId, data });
      
      // If this was a coding task, show diff option
      const task = tasks.find(t => t.id === data.taskId);
      if (task?.type === 'coding') {
        setActiveView('workspace');
      }
    });

    eventSource.addEventListener('task:failed', (e) => {
      const data = JSON.parse(e.data);
      setTasks(prev => prev.map(t => t.id === data.taskId ? { ...t, status: 'failed' as const, result: { success: false, error: data.error } } : t));
      addEvent({ type: 'task:failed', agentId: '', taskId: data.taskId, data });
    });

    eventSource.addEventListener('task:blocked', (e) => {
      const data = JSON.parse(e.data);
      setTasks(prev => prev.map(t => t.id === data.taskId ? { ...t, status: 'blocked' as const } : t));
      addEvent({ type: 'task:blocked', agentId: '', taskId: data.taskId, data });
    });

    // Project events
    eventSource.addEventListener('project:created', (e) => {
      const data = JSON.parse(e.data);
      addEvent({ type: 'project:created', agentId: '', data });
      // Refresh projects
      fetchProjects();
    });

    eventSource.addEventListener('project:status', (e) => {
      const data = JSON.parse(e.data);
      setProjects(prev => prev.map(p => p.id === data.projectId ? { ...p, status: data.status } : p));
    });

    // Container & Worktree events
    eventSource.addEventListener('container:created', (e) => {
      const data = JSON.parse(e.data);
      addEvent({ type: 'container:created', agentId: '', data });
    });

    eventSource.addEventListener('worktree:created', (e) => {
      const data = JSON.parse(e.data);
      addEvent({ type: 'worktree:created', agentId: '', taskId: data.taskId, data });
    });

    // Execution events
    eventSource.addEventListener('execution:started', (e) => {
      const data = JSON.parse(e.data);
      addEvent({ type: 'execution:started', agentId: '', data });
    });

    eventSource.addEventListener('execution:completed', (e) => {
      const data = JSON.parse(e.data);
      addEvent({ type: 'execution:completed', agentId: '', data });
    });

    // Approval events
    eventSource.addEventListener('approval:requested', (e) => {
      const approval = JSON.parse(e.data);
      setApprovals(prev => [...prev, approval]);
      setPendingApprovals(prev => [...prev, approval]);
      addEvent({ type: 'approval:requested', agentId: approval.agentId, data: approval });
    });

    eventSource.addEventListener('approval:resolved', (e) => {
      const data = JSON.parse(e.data);
      setApprovals(prev => prev.map(a => a.id === data.id ? { ...a, status: data.status } : a));
      setPendingApprovals(prev => prev.filter(a => a.id !== data.id));
    });

    // File events
    eventSource.addEventListener('file:event', (e) => {
      const data = JSON.parse(e.data);
      addEvent({ type: 'file:event', agentId: '', data });
    });

    eventSource.onerror = () => {
      setSseStatus('disconnected');
      eventSource.close();
      setTimeout(connectSSE, 3000);
    };

    return eventSource;
  }, []);

  const addEvent = useCallback((event: AgentEvent) => {
    setEvents(prev => [{
      ...event,
      timestamp: new Date(),
    }, ...prev.slice(0, 999)]);
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  useEffect(() => {
    const eventSource = connectSSE();
    return () => eventSource.close();
  }, [connectSSE]);

  // Initial data fetch
  useEffect(() => {
    Promise.all([
      fetch('/api/agents').then(r => r.json()).then(data => setAgents(data.agents || [])),
      fetch('/api/tasks').then(r => r.json()).then(data => setTasks(data.tasks || [])),
      fetch('/api/approvals').then(r => r.json()).then(data => {
        setApprovals(data.approvals || []);
        setPendingApprovals(data.approvals?.filter((a: ApprovalRequest) => a.status === 'pending') || []);
      }),
      fetchProjects(),
    ]).catch(console.error);
  }, []);

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setActiveView('workspace');
  };

  const handleGoalCreated = (data: { projectId: string }) => {
    setSelectedProjectId(data.projectId);
    setActiveView('workspace');
  };

  const handleApprove = async (id: string, reason?: string) => {
    await fetch(`/api/approvals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', reason }),
    });
  };

  const handleReject = async (id: string, reason?: string) => {
    await fetch(`/api/approvals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', reason }),
    });
  };

  const viewDiff = async (projectId: string, taskId?: string) => {
    try {
      const params = new URLSearchParams({ projectId });
      if (taskId) params.append('taskId', taskId);
      
      const res = await fetch(`/api/files/diff/${projectId}?${params}`);
      const data = await res.json();
      
      if (data.diff) {
        setDiffData({ diff: data.diff });
        setActiveView('diff');
      }
    } catch (error) {
      console.error('Failed to fetch diff:', error);
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar 
        activeView={activeView} 
        setActiveView={setActiveView}
        projects={projects}
        onSelectProject={handleSelectProject}
        sseStatus={sseStatus}
      />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="border-b border-zinc-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">Agentic OS</h1>
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <div className={`w-2 h-2 rounded-full ${sseStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`} />
              <span>{sseStatus === 'connected' ? 'Live' : 'Reconnecting...'}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            {pendingApprovals.length > 0 && (
              <button
                onClick={() => setActiveView('approvals')}
                className="flex items-center gap-1 px-2 py-1 bg-yellow-900/30 text-yellow-300 rounded hover:bg-yellow-900/50"
              >
                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                {pendingApprovals.length} pending
              </button>
            )}
            <span>{agents.length} agents</span>
            <span>{tasks.filter(t => t.status === 'running').length} running</span>
            <span>{tasks.filter(t => t.status === 'pending').length} pending</span>
          </div>
        </header>
        
        <div className="flex-1 overflow-auto p-6">
          {activeView === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GoalInput onGoalCreated={handleGoalCreated} />
              <AgentDashboard agents={agents} />
              <div className="lg:col-span-2">
                <TaskGraph tasks={tasks} onSelectTask={(taskId) => {
                  const task = tasks.find(t => t.id === taskId);
                  if (task) {
                    setSelectedTaskId(taskId);
                  }
                }} onViewDiff={(taskId, projectId) => viewDiff(projectId, taskId)} />
              </div>
            </div>
          )}
          
          {activeView === 'projects' && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Projects</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map(project => (
                  <div 
                    key={project.id}
                    onClick={() => handleSelectProject(project.id)}
                    className="bg-zinc-900 rounded-lg p-4 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors"
                  >
                    <h3 className="font-medium text-zinc-100">{project.name}</h3>
                    <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{project.goal}</p>
                    <div className="flex items-center justify-between mt-3 text-xs">
                      <span className={`px-2 py-1 rounded ${
                        project.status === 'done' ? 'bg-emerald-900/50 text-emerald-300' :
                        project.status === 'building' ? 'bg-blue-900/50 text-blue-300' :
                        'bg-zinc-800 text-zinc-400'
                      }`}>
                        {project.status}
                      </span>
                      <span className="text-zinc-600">
                        {new Date(project.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {activeView === 'tasks' && <TaskGraph tasks={tasks} onSelectTask={(taskId) => setSelectedTaskId(taskId)} />}
          {activeView === 'approvals' && <ApprovalQueue approvals={approvals} onApprove={handleApprove} onReject={handleReject} />}
          {activeView === 'activity' && <ActivityFeed events={events} />}
          
          {activeView === 'workspace' && selectedProjectId && (
            <ProjectWorkspace projectId={selectedProjectId} />
          )}
          
          {activeView === 'diff' && diffData && (
            <DiffViewer 
              diff={diffData.diff}
              oldPath={diffData.oldPath}
              newPath={diffData.newPath}
            />
          )}
        </div>
      </main>
      
      {/* Approval Modal */}
      {selectedApproval && (
        <ApprovalModal
          approval={selectedApproval}
          onApprove={handleApprove}
          onReject={handleReject}
          onClose={() => setSelectedApproval(null)}
        />
      )}
    </div>
  );
}
