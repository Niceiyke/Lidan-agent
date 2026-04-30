'use client';
import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface GoalInputProps {
  onGoalCreated?: (data: { projectId: string; planId: string; taskId: string }) => void;
}

export function GoalInput({ onGoalCreated }: GoalInputProps) {
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create goal');
      }
      
      const data = await response.json();
      setGoal('');
      
      onGoalCreated?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
      <h2 className="text-lg font-medium mb-4 text-zinc-100">Create New Project</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Describe the app you want to build... (e.g., 'A todo app with user authentication, React frontend, Express backend')"
            className="w-full h-32 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none"
            disabled={loading}
          />
          
          <div className="mt-2 text-xs text-zinc-500">
            Be specific about features, tech stack, and any requirements.
          </div>
        </div>
        
        {error && (
          <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-300">
            {error}
          </div>
        )}
        
        <button
          type="submit"
          disabled={loading || !goal.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg font-medium hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Planning...
            </>
          ) : (
            <>
              <Send size={16} />
              Start Building
            </>
          )}
        </button>
      </form>
      
      {/* Quick Examples */}
      <div className="mt-6 pt-4 border-t border-zinc-800">
        <div className="text-xs text-zinc-500 mb-2">Quick examples:</div>
        <div className="flex flex-wrap gap-2">
          {[
            'React todo app with auth',
            'REST API with Express',
            'Landing page with contact form',
          ].map((example) => (
            <button
              key={example}
              onClick={() => setGoal(example)}
              disabled={loading}
              className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded hover:bg-zinc-700 hover:text-zinc-300 transition-colors disabled:opacity-50"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
