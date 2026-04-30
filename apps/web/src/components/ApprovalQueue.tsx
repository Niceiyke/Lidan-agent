'use client';
import { useState, useEffect } from 'react';
import { X, AlertTriangle, AlertCircle, Info, CheckCircle, XCircle, Clock } from 'lucide-react';
import { ApprovalRequest } from '@agentic-os/types';

interface ApprovalModalProps {
  approval: ApprovalRequest;
  onApprove: (id: string, reason?: string) => Promise<void>;
  onReject: (id: string, reason?: string) => Promise<void>;
  onClose: () => void;
}

export function ApprovalModal({ 
  approval, 
  onApprove, 
  onReject, 
  onClose 
}: ApprovalModalProps) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [expanded, setExpanded] = useState(false);

  const severityIcon = {
    critical: <AlertTriangle className="text-red-500" size={20} />,
    high: <AlertCircle className="text-orange-500" size={20} />,
    medium: <Info className="text-yellow-500" size={20} />,
    low: <Info className="text-blue-500" size={20} />,
  };

  const handleApprove = async () => {
    setLoading('approve');
    try {
      await onApprove(approval.id, reason);
      onClose();
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    setLoading('reject');
    try {
      await onReject(approval.id, reason);
      onClose();
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-zinc-900 rounded-xl border border-zinc-800 shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            {severityIcon.critical}
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">Approval Required</h2>
              <p className="text-sm text-zinc-500">{approval.action.replace(/_/g, ' ')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-auto">
          {/* Description */}
          <div>
            <h3 className="text-sm font-medium text-zinc-400 mb-2">Description</h3>
            <p className="text-zinc-200">{approval.description}</p>
          </div>

          {/* Timestamp */}
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Clock size={14} />
            <span>Requested {formatTimeAgo(new Date(approval.createdAt))}</span>
          </div>

          {/* Payload (expandable) */}
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-300"
            >
              <span>{expanded ? '▼' : '▶'}</span>
              <span>Details</span>
            </button>
            {expanded && (
              <div className="mt-2 p-3 bg-zinc-950 rounded-lg font-mono text-xs">
                <pre className="whitespace-pre-wrap break-all text-zinc-400">
                  {JSON.stringify(approval.payload, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Reason Input */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Add a note for the agent..."
              className="w-full h-20 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-950/50">
          <button
            onClick={handleReject}
            disabled={loading !== null}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 transition-colors"
          >
            {loading === 'reject' ? (
              <span className="animate-spin">⟳</span>
            ) : (
              <XCircle size={16} />
            )}
            Reject
          </button>
          <button
            onClick={handleApprove}
            disabled={loading !== null}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-500 disabled:opacity-50 transition-colors"
          >
            {loading === 'approve' ? (
              <span className="animate-spin">⟳</span>
            ) : (
              <CheckCircle size={16} />
            )}
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Approval Queue Card
// ============================================

interface ApprovalQueueProps {
  approvals: ApprovalRequest[];
  onApprove: (id: string, reason?: string) => Promise<void>;
  onReject: (id: string, reason?: string) => Promise<void>;
}

export function ApprovalQueue({ approvals, onApprove, onReject }: ApprovalQueueProps) {
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('all');

  const filteredApprovals = approvals.filter(a => {
    if (filter === 'pending') return a.status === 'pending';
    if (filter === 'resolved') return a.status !== 'pending';
    return true;
  });

  if (approvals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
        <CheckCircle size={48} className="mb-4 opacity-50" />
        <p className="text-lg">No pending approvals</p>
        <p className="text-sm">All clear!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-zinc-100">Approvals</h2>
        <div className="flex items-center gap-2">
          {(['all', 'pending', 'resolved'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-sm rounded ${
                filter === f ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="grid gap-4">
        {filteredApprovals.map(approval => (
          <div 
            key={approval.id}
            onClick={() => setSelectedApproval(approval)}
            className={`bg-zinc-900 rounded-lg p-4 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors ${
              approval.status === 'pending' ? 'border-l-4 border-l-yellow-500' : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    approval.status === 'pending' ? 'bg-yellow-900/50 text-yellow-300' :
                    approval.status === 'approved' ? 'bg-green-900/50 text-green-300' :
                    'bg-red-900/50 text-red-300'
                  }`}>
                    {approval.status}
                  </span>
                  <span className="text-sm text-zinc-300">{approval.action}</span>
                </div>
                <p className="mt-1 text-sm text-zinc-400">{approval.description}</p>
                <p className="mt-1 text-xs text-zinc-600">
                  {formatTimeAgo(new Date(approval.createdAt))}
                </p>
              </div>
              {approval.status === 'pending' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onApprove(approval.id);
                    }}
                    className="p-2 text-green-500 hover:bg-green-900/30 rounded-lg"
                    title="Approve"
                  >
                    <CheckCircle size={18} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onReject(approval.id);
                    }}
                    className="p-2 text-red-500 hover:bg-red-900/30 rounded-lg"
                    title="Reject"
                  >
                    <XCircle size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {selectedApproval && selectedApproval.status === 'pending' && (
        <ApprovalModal
          approval={selectedApproval}
          onApprove={onApprove}
          onReject={onReject}
          onClose={() => setSelectedApproval(null)}
        />
      )}
    </div>
  );
}

// ============================================
// Utility
// ============================================

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
