'use client';
import { AgentEvent } from '@/app/page';

interface Props {
  events: AgentEvent[];
}

export function ActivityFeed({ events }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Activity Feed</h2>
      {events.length === 0 ? (
        <p className="text-zinc-500">No events yet. Activity will appear here as agents work.</p>
      ) : (
        <div className="space-y-2">
          {events.slice(-50).reverse().map((event, i) => (
            <div key={i} className="text-sm border-l-2 border-zinc-700 pl-4 py-1">
              <span className="text-zinc-500">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>{' '}
              <span className="text-zinc-300">{event.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
