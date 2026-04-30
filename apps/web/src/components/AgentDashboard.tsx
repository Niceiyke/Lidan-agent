'use client';
import { Agent } from '@agentic-os/types';
import { Cpu, CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface Props {
  agents: Agent[];
}

const statusColors: Record<string, string> = {
  idle: 'text-zinc-500',
  planning: 'text-blue-400',
  executing: 'text-green-400',
  waiting_approval: 'text-yellow-400',
  done: 'text-green-500',
  failed: 'text-red-400'
};

const statusIcons: Record<string, React.ReactNode> = {
  idle: <Clock size={14} />,
  planning: <Cpu size={14} />,
  executing: <Cpu size={14} className="animate-pulse" />,
  waiting_approval: <AlertCircle size={14} />,
  done: <CheckCircle size={14} />,
  failed: <AlertCircle size={14} />
};

export function AgentDashboard({ agents }: Props) {
  return (
    <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
      <h2 className="text-lg font-medium mb-4">Active Agents</h2>
      {agents.length === 0 ? (
        <p className="text-zinc-500 text-sm">No agents running. Start a project to spawn agents.</p>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => (
            <div key={agent.id} className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
              <div>
                <p className="font-medium text-sm">{agent.name}</p>
                <p className="text-xs text-zinc-500 capitalize">{agent.role}</p>
              </div>
              <div className={`flex items-center gap-2 ${statusColors[agent.status]}`}>
                {statusIcons[agent.status]}
                <span className="text-sm capitalize">{agent.status.replace('_', ' ')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
