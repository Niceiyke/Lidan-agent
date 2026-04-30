'use client';
import { useState, useMemo } from 'react';
import { Task } from '@agentic-os/types';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Play,
  GitBranch,
  MoreVertical,
  ChevronDown,
  Filter
} from 'lucide-react';

interface TaskGraphProps {
  tasks: Task[];
  onSelectTask: (taskId: string) => void;
  onViewDiff?: (taskId: string, projectId: string) => void;
}

export function TaskGraph({ tasks, onSelectTask, onViewDiff }: TaskGraphProps) {
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [showOnlyRunning, setShowOnlyRunning] = useState(false);
  const [expandedDeps, setExpandedDeps] = useState<Set<string>>(new Set());

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (filterType && task.type !== filterType) return false;
      if (filterStatus && task.status !== filterStatus) return false;
      if (showOnlyRunning && task.status !== 'running') return false;
      return true;
    });
  }, [tasks, filterType, filterStatus, showOnlyRunning]);

  const taskCounts = useMemo(() => ({
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    running: tasks.filter(t => t.status === 'running').length,
    done: tasks.filter(t => t.status === 'done').length,
    failed: tasks.filter(t => t.status === 'failed').length,
  }), [tasks]);

  const statusIcon = (status: Task['status']) => {
    switch (status) {
      case 'pending':
        return <Clock size={14} className="text-zinc-500" />;
      case 'queued':
        return <Play size={14} className="text-blue-500" />;
      case 'running':
        return <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'done':
        return <CheckCircle size={14} className="text-emerald-500" />;
      case 'failed':
        return <XCircle size={14} className="text-red-500" />;
      case 'blocked':
        return <AlertCircle size={14} className="text-orange-500" />;
      default:
        return <Clock size={14} className="text-zinc-500" />;
    }
  };

  const statusColor = (status: Task['status']) => {
    switch (status) {
      case 'pending': return 'text-zinc-400 bg-zinc-800';
      case 'queued': return 'text-blue-400 bg-blue-900/30';
      case 'running': return 'text-blue-400 bg-blue-900/30';
      case 'done': return 'text-emerald-400 bg-emerald-900/30';
      case 'failed': return 'text-red-400 bg-red-900/30';
      case 'blocked': return 'text-orange-400 bg-orange-900/30';
      default: return 'text-zinc-400 bg-zinc-800';
    }
  };

  const priorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'critical': return 'text-red-400';
      case 'high': return 'text-orange-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-zinc-500';
      default: return 'text-zinc-500';
    }
  };

  const typeLabel = (type: Task['type']) => {
    switch (type) {
      case 'planning': return '📋 Planning';
      case 'coding': return '💻 Coding';
      case 'review': return '👀 Review';
      case 'testing': return '🧪 Testing';
      case 'debugging': return '🔧 Debug';
      default: return type;
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
        <GitBranch size={48} className="mb-4 opacity-50" />
        <p className="text-lg">No tasks yet</p>
        <p className="text-sm">Create a project to start planning</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-zinc-100">Tasks</h2>
          <div className="flex items-center gap-3 mt-1 text-xs">
            <span className="text-zinc-500">{taskCounts.total} total</span>
            <span className="text-zinc-400">{taskCounts.pending} pending</span>
            <span className="text-blue-400">{taskCounts.running} running</span>
            <span className="text-emerald-400">{taskCounts.done} done</span>
            {taskCounts.failed > 0 && <span className="text-red-400">{taskCounts.failed} failed</span>}
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOnlyRunning(!showOnlyRunning)}
            className={`px-3 py-1 text-sm rounded ${
              showOnlyRunning ? 'bg-blue-900/50 text-blue-300' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300'
            }`}
          >
            <Filter size={14} className="inline mr-1" />
            Running
          </button>
          
          <select
            value={filterType || ''}
            onChange={(e) => setFilterType(e.target.value || null)}
            className="px-2 py-1 bg-zinc-800 text-zinc-400 text-sm rounded border border-zinc-700 focus:outline-none focus:border-zinc-600"
          >
            <option value="">All types</option>
            <option value="planning">Planning</option>
            <option value="coding">Coding</option>
            <option value="review">Review</option>
            <option value="testing">Testing</option>
            <option value="debugging">Debugging</option>
          </select>
          
          <select
            value={filterStatus || ''}
            onChange={(e) => setFilterStatus(e.target.value || null)}
            className="px-2 py-1 bg-zinc-800 text-zinc-400 text-sm rounded border border-zinc-700 focus:outline-none focus:border-zinc-600"
          >
            <option value="">All status</option>
            <option value="pending">Pending</option>
            <option value="queued">Queued</option>
            <option value="running">Running</option>
            <option value="done">Done</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {filteredTasks.map(task => (
          <div 
            key={task.id}
            onClick={() => onSelectTask(task.id)}
            className={`bg-zinc-900 rounded-lg p-4 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-all ${
              task.status === 'running' ? 'border-l-4 border-l-blue-500' : ''
            } ${task.status === 'failed' ? 'border-l-4 border-l-red-500' : ''
            } ${task.status === 'done' ? 'border-l-4 border-l-emerald-500' : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                {/* Type & Title */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">{typeLabel(task.type)}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(task.status)}`}>
                    {task.status}
                  </span>
                  {task.branchName && (
                    <span className="flex items-center gap-1 text-xs text-zinc-500">
                      <GitBranch size={12} />
                      {task.branchName}
                    </span>
                  )}
                </div>
                
                <h3 className="mt-1 font-medium text-zinc-200 truncate">{task.title}</h3>
                
                {task.description && (
                  <p className="mt-1 text-sm text-zinc-500 line-clamp-2">{task.description}</p>
                )}
                
                {/* Meta */}
                <div className="flex items-center gap-3 mt-2 text-xs text-zinc-600">
                  <span className={priorityColor(task.priority)}>
                    {task.priority}
                  </span>
                  {task.duration && (
                    <span>{(task.duration / 1000).toFixed(1)}s</span>
                  )}
                  {task.assignedAgentId && (
                    <span>Assigned</span>
                  )}
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-2 ml-4">
                {statusIcon(task.status)}
                
                {task.status === 'done' && onViewDiff && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDiff(task.id, '');
                    }}
                    className="p-1 text-zinc-500 hover:text-zinc-300"
                    title="View diff"
                  >
                    <GitBranch size={14} />
                  </button>
                )}
              </div>
            </div>
            
            {/* Dependencies Preview */}
            {task.dependencies && task.dependencies.length > 0 && (
              <div className="mt-2 pt-2 border-t border-zinc-800">
                <div className="flex items-center gap-2 text-xs text-zinc-600">
                  <span>Depends on:</span>
                  {task.dependencies.slice(0, 3).map((dep, i) => (
                    <span key={i} className="px-1.5 py-0.5 bg-zinc-800 rounded">
                      {typeof dep === 'string' ? dep.slice(0, 8) : `task-${i}`}
                    </span>
                  ))}
                  {task.dependencies.length > 3 && (
                    <span>+{task.dependencies.length - 3} more</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination hint */}
      {filteredTasks.length < tasks.length && (
        <div className="text-center text-sm text-zinc-500">
          Showing {filteredTasks.length} of {tasks.length} tasks
        </div>
      )}
    </div>
  );
}
