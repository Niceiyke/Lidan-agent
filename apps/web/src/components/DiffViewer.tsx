'use client';
import { useState, useEffect, useMemo } from 'react';

interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header';
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

interface DiffProps {
  diff: string;
  oldPath?: string;
  newPath?: string;
}

export function DiffViewer({ diff, oldPath, newPath }: DiffProps) {
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('unified');
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());

  const parsedDiff = useMemo(() => parseDiff(diff), [diff]);

  const toggleSection = (index: number) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(index)) {
      newCollapsed.delete(index);
    } else {
      newCollapsed.add(index);
    }
    setCollapsedSections(newCollapsed);
  };

  if (!diff || diff.trim() === '') {
    return (
      <div className="p-8 text-center text-zinc-500">
        No changes to display
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-4 text-sm">
          {oldPath && (
            <span className="text-zinc-400">
              <span className="text-red-400">-</span> {oldPath}
            </span>
          )}
          {newPath && (
            <span className="text-zinc-400">
              <span className="text-green-400">+</span> {newPath}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('unified')}
            className={`px-2 py-1 text-xs rounded ${
              viewMode === 'unified' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Unified
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`px-2 py-1 text-xs rounded ${
              viewMode === 'split' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Split
          </button>
        </div>
      </div>

      {/* Diff Content */}
      <div className="flex-1 overflow-auto font-mono text-sm">
        {viewMode === 'unified' ? (
          <UnifiedDiffView 
            lines={parsedDiff} 
            collapsedSections={collapsedSections}
            onToggleSection={toggleSection}
          />
        ) : (
          <SplitDiffView 
            lines={parsedDiff}
            oldPath={oldPath}
            newPath={newPath}
          />
        )}
      </div>

      {/* Stats Footer */}
      <div className="px-4 py-2 bg-zinc-900 border-t border-zinc-800 flex items-center gap-4 text-xs text-zinc-500">
        <span className="text-green-400">
          +{parsedDiff.filter(l => l.type === 'add').length} additions
        </span>
        <span className="text-red-400">
          -{parsedDiff.filter(l => l.type === 'remove').length} deletions
        </span>
      </div>
    </div>
  );
}

function UnifiedDiffView({ 
  lines, 
  collapsedSections, 
  onToggleSection 
}: { 
  lines: DiffLine[]; 
  collapsedSections: Set<number>;
  onToggleSection: (index: number) => void;
}) {
  let contextStart = 0;
  const sections: { start: number; end: number; collapsed: boolean }[] = [];

  // Group context lines
  lines.forEach((line, i) => {
    if (line.type === 'add' || line.type === 'remove') {
      if (contextStart < i) {
        sections.push({ start: contextStart, end: i, collapsed: collapsedSections.has(contextStart) });
      }
      contextStart = i + 1;
    }
  });

  return (
    <div className="p-2">
      {lines.map((line, i) => {
        const lineClass = {
          add: 'bg-green-900/30 text-green-300',
          remove: 'bg-red-900/30 text-red-300',
          context: 'text-zinc-400',
          header: 'text-zinc-500 bg-zinc-800/50',
        }[line.type];

        const prefix = {
          add: '+',
          remove: '-',
          context: ' ',
          header: '',
        }[line.type];

        return (
          <div key={i} className={`flex ${lineClass}`}>
            <span className="w-12 text-right pr-4 text-zinc-600 select-none">
              {line.oldLineNum || ''}
            </span>
            <span className="w-12 text-right pr-4 text-zinc-600 select-none">
              {line.newLineNum || ''}
            </span>
            <span className="w-4 text-center select-none">{prefix}</span>
            <span className="flex-1 whitespace-pre-wrap break-all">{line.content}</span>
          </div>
        );
      })}
    </div>
  );
}

function SplitDiffView({ 
  lines, 
  oldPath, 
  newPath 
}: { 
  lines: DiffLine[];
  oldPath?: string;
  newPath?: string;
}) {
  const leftLines: DiffLine[] = [];
  const rightLines: DiffLine[] = [];
  let leftNum = 1;
  let rightNum = 1;

  lines.forEach(line => {
    if (line.type === 'header') {
      leftLines.push(line);
      rightLines.push(line);
    } else if (line.type === 'remove') {
      leftLines.push({ ...line, oldLineNum: leftNum++ });
      rightLines.push({ type: 'context', content: '', newLineNum: undefined });
    } else if (line.type === 'add') {
      leftLines.push({ type: 'context', content: '', oldLineNum: undefined });
      rightLines.push({ ...line, newLineNum: rightNum++ });
    } else {
      leftLines.push({ ...line, oldLineNum: leftNum++ });
      rightLines.push({ ...line, newLineNum: rightNum++ });
    }
  });

  return (
    <div className="flex h-full">
      {/* Left (old) */}
      <div className="flex-1 border-r border-zinc-800">
        <div className="px-2 py-1 bg-zinc-800/50 text-xs text-zinc-500 border-b border-zinc-800">
          {oldPath || 'old'}
        </div>
        <div className="p-2">
          {leftLines.map((line, i) => {
            const lineClass = {
              add: '',
              remove: 'bg-red-900/30 text-red-300',
              context: 'text-zinc-400',
              header: 'text-zinc-500 bg-zinc-800/50',
            }[line.type];

            return (
              <div key={i} className={`flex ${lineClass} ${line.type === 'remove' ? 'bg-red-900/30' : ''}`}>
                <span className="w-8 text-right pr-2 text-zinc-600 select-none">
                  {line.oldLineNum || ''}
                </span>
                <span className="flex-1 whitespace-pre-wrap">{line.content}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right (new) */}
      <div className="flex-1">
        <div className="px-2 py-1 bg-zinc-800/50 text-xs text-zinc-500 border-b border-zinc-800">
          {newPath || 'new'}
        </div>
        <div className="p-2">
          {rightLines.map((line, i) => {
            const lineClass = {
              add: 'bg-green-900/30 text-green-300',
              remove: '',
              context: 'text-zinc-400',
              header: 'text-zinc-500 bg-zinc-800/50',
            }[line.type];

            return (
              <div key={i} className={`flex ${lineClass} ${line.type === 'add' ? 'bg-green-900/30' : ''}`}>
                <span className="w-8 text-right pr-2 text-zinc-600 select-none">
                  {line.newLineNum || ''}
                </span>
                <span className="flex-1 whitespace-pre-wrap">{line.content}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Diff Parser
// ============================================

function parseDiff(diff: string): DiffLine[] {
  const lines: DiffLine[] = [];
  const diffLines = diff.split('\n');
  
  let oldLineNum = 0;
  let newLineNum = 0;
  let inHeader = true;
  let headerContent = '';

  for (const line of diffLines) {
    if (line.startsWith('@@')) {
      inHeader = false;
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
      if (match) {
        oldLineNum = parseInt(match[1], 10);
        newLineNum = parseInt(match[2], 10);
      }
      lines.push({ type: 'header', content: line });
    } else if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ') || line.startsWith('index ')) {
      headerContent += line + '\n';
      lines.push({ type: 'header', content: line });
    } else if (line.startsWith('+')) {
      lines.push({ type: 'add', content: line.slice(1), newLineNum: newLineNum++ });
    } else if (line.startsWith('-')) {
      lines.push({ type: 'remove', content: line.slice(1), oldLineNum: oldLineNum++ });
    } else if (line.startsWith(' ')) {
      lines.push({ type: 'context', content: line.slice(1), oldLineNum: oldLineNum++, newLineNum: newLineNum++ });
    } else if (line.trim() === '') {
      lines.push({ type: 'context', content: '', oldLineNum: oldLineNum++, newLineNum: newLineNum++ });
    }
  }

  return lines;
}
