'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Task, Project, GitStatus, Execution } from '@agentic-os/types';
import { 
  File, 
  Folder, 
  FolderOpen, 
  GitBranch, 
  Terminal as TerminalIcon,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  ExternalLink,
  GitMerge,
  Trash2,
  Plus,
  Copy
} from 'lucide-react';

interface ProjectWorkspaceProps {
  projectId: string;
}

interface FileNode {
  name: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  path: string;
}

type TabType = 'files' | 'git' | 'terminal' | 'tasks' | 'executions';

export function ProjectWorkspace({ projectId }: ProjectWorkspaceProps) {
  const [project, setProject] = useState<any>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [terminal, setTerminal] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('files');
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [gitLoading, setGitLoading] = useState(false);
  const [worktrees, setWorktrees] = useState<any[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);
  const fileWatcherRef = useRef<EventSource | null>(null);

  const fetchProjectData = useCallback(async () => {
    setLoading(true);
    try {
      const [projectRes, gitRes, filesRes, worktreesRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`).then(r => r.json()),
        fetch(`/api/projects/${projectId}/git`).then(r => r.json()),
        fetch(`/api/files/tree/${projectId}?depth=3`).then(r => r.json()),
        fetch(`/api/projects/${projectId}/worktrees`).catch(() => ({ worktrees: [] })),
      ]);

      setProject(projectRes.project);
      setGitStatus(gitRes.gitStatus);
      setFiles(filesRes.files || []);
      setWorktrees(worktreesRes.worktrees || []);
    } catch (error) {
      console.error('Failed to fetch project data:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProjectData();
    
    // Start file watching
    fetch(`/api/files/watch/${projectId}`, { method: 'POST' }).catch(console.error);
    
    // Subscribe to file events via SSE
    fileWatcherRef.current = new EventSource('/events/stream');
    fileWatcherRef.current.addEventListener('file:event', (e) => {
      const data = JSON.parse(e.data);
      setTerminal(prev => [...prev, `[file] ${data.action}: ${data.path}`]);
    });
    fileWatcherRef.current.addEventListener('execution:output', (e) => {
      const data = JSON.parse(e.data);
      setTerminal(prev => [...prev, data]);
    });

    return () => {
      fileWatcherRef.current?.close();
      // Stop file watching
      fetch(`/api/files/watch/${projectId}`, { method: 'DELETE' }).catch(console.error);
    };
  }, [projectId, fetchProjectData]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminal]);

  const handleFileSelect = async (path: string) => {
    setSelectedFile(path);
    try {
      const res = await fetch(`/api/files/content?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      setFileContent(data.content || '// Unable to load file');
    } catch {
      setFileContent('// Unable to load file');
    }
  };

  const toggleDir = (path: string) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedDirs(newExpanded);
  };

  const runCommand = async (command: string) => {
    const prefixedCommand = `$ ${command}`;
    setTerminal(prev => [...prev, prefixedCommand]);

    try {
      // Get container for this project
      const projectRes = await fetch(`/api/projects/${projectId}`).then(r => r.json());
      const container = projectRes.project?.containers?.[0];
      
      if (!container) {
        setTerminal(prev => [...prev, 'Error: No container available']);
        return;
      }

      const res = await fetch('/api/executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          containerId: container.id,
          type: 'execute',
          command,
          timeout: 60,
        }),
      });

      const data = await res.json();
      
      if (data.execution?.output) {
        setTerminal(prev => [...prev, data.execution.output]);
      } else {
        setTerminal(prev => [...prev, 'Command completed']);
      }
    } catch (error) {
      setTerminal(prev => [...prev, `Error: ${error}`]);
    }
  };

  const mergeWorktree = async (taskId: string) => {
    setGitLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/merge`, { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        setTerminal(prev => [...prev, `Merged task worktree into main`]);
        fetchProjectData();
      } else {
        setTerminal(prev => [...prev, `Error: ${data.error}`]);
      }
    } catch (error) {
      setTerminal(prev => [...prev, `Error: ${error}`]);
    } finally {
      setGitLoading(false);
    }
  };

  const renderFileTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map(node => (
      <div key={node.path}>
        <div 
          className="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-zinc-800 text-sm"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
            if (node.type === 'directory') {
              toggleDir(node.path);
            } else {
              handleFileSelect(node.path);
            }
          }}
        >
          {node.type === 'directory' ? (
            <>
              {expandedDirs.has(node.path) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {expandedDirs.has(node.path) ? <FolderOpen size={16} className="text-yellow-500" /> : <Folder size={16} className="text-yellow-500" />}
            </>
          ) : (
            <>
              <span className="w-[14px]" />
              <File size={16} className="text-zinc-400" />
            </>
          )}
          <span className="truncate text-zinc-300">{node.name}</span>
        </div>
        {node.type === 'directory' && expandedDirs.has(node.path) && node.children && (
          renderFileTree(node.children, depth + 1)
        )}
      </div>
    ));
  };

  const renderGitPanel = () => {
    if (!gitStatus) {
      return <div className="p-4 text-zinc-500">Git status unavailable</div>;
    }

    return (
      <div className="p-4 space-y-4">
        {/* Branch & Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch size={16} className="text-zinc-400" />
            <span className="font-medium text-zinc-100">{gitStatus.branch}</span>
            {gitStatus.ahead > 0 && (
              <span className="text-xs text-green-500 bg-green-900/30 px-2 py-0.5 rounded">↑{gitStatus.ahead}</span>
            )}
            {gitStatus.behind > 0 && (
              <span className="text-xs text-yellow-500 bg-yellow-900/30 px-2 py-0.5 rounded">↓{gitStatus.behind}</span>
            )}
          </div>
          <button
            onClick={() => fetchProjectData()}
            className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Changed Files */}
        {gitStatus.files.length === 0 ? (
          <div className="text-sm text-zinc-500 py-8 text-center">
            <GitBranch size={32} className="mx-auto mb-2 opacity-50" />
            <p>No changes</p>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-xs text-zinc-500 uppercase mb-2">{gitStatus.files.length} changed</div>
            {gitStatus.files.slice(0, 20).map((file, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className={`w-5 text-center ${
                  file.status === 'M' ? 'text-yellow-500' :
                  file.status === 'A' ? 'text-green-500' :
                  file.status === 'D' ? 'text-red-500' :
                  file.status === 'R' ? 'text-blue-500' :
                  'text-zinc-500'
                }`}>
                  {file.status}
                </span>
                <span 
                  className="text-zinc-300 truncate cursor-pointer hover:text-zinc-100"
                  onClick={() => handleFileSelect(file.path)}
                >
                  {file.path}
                </span>
              </div>
            ))}
            {gitStatus.files.length > 20 && (
              <div className="text-xs text-zinc-600 text-center pt-2">
                +{gitStatus.files.length - 20} more files
              </div>
            )}
          </div>
        )}

        {/* Worktrees */}
        {worktrees.length > 0 && (
          <div className="pt-4 border-t border-zinc-800">
            <div className="text-xs text-zinc-500 uppercase mb-2">Worktrees</div>
            <div className="space-y-2">
              {worktrees.map((wt: any) => (
                <div key={wt.branch} className="flex items-center justify-between p-2 bg-zinc-800/50 rounded">
                  <div className="flex items-center gap-2">
                    <GitBranch size={14} className="text-zinc-500" />
                    <span className="text-sm text-zinc-300">{wt.branch}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {wt.isMain ? (
                      <span className="text-xs text-zinc-500">main</span>
                    ) : (
                      <button
                        onClick={() => mergeWorktree(wt.taskId)}
                        disabled={gitLoading}
                        className="p-1 text-zinc-500 hover:text-green-400 hover:bg-zinc-700 rounded"
                        title="Merge to main"
                      >
                        <GitMerge size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        <RefreshCw size={24} className="animate-spin mr-2" />
        Loading project...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        Project not found
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left Panel - Tabs */}
      <div className="w-72 border-r border-zinc-800 flex flex-col">
        {/* Project Header */}
        <div className="p-4 border-b border-zinc-800">
          <h2 className="font-medium text-zinc-100 truncate">{project.name}</h2>
          <div className="flex items-center gap-2 mt-1 text-xs">
            <GitBranch size={12} className="text-zinc-500" />
            <span className="text-zinc-500">{gitStatus?.branch || 'main'}</span>
            <span className={`px-1.5 py-0.5 rounded ${
              project.status === 'done' ? 'bg-emerald-900/50 text-emerald-300' :
              project.status === 'building' ? 'bg-blue-900/50 text-blue-300' :
              'bg-zinc-800 text-zinc-400'
            }`}>
              {project.status}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800">
          {(['files', 'git', 'terminal', 'tasks'] as TabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-2 py-2 text-xs capitalize transition-colors ${
                activeTab === tab
                  ? 'bg-zinc-800 text-zinc-100 border-b-2 border-zinc-500'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab === 'git' ? 'git' : tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'files' && (
            <div className="py-2">
              {files.length > 0 ? renderFileTree(files) : (
                <div className="text-zinc-500 text-sm p-4">
                  <Folder size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No files yet</p>
                  <p className="text-xs mt-1">Tasks are still running...</p>
                </div>
              )}
            </div>
          )}
          {activeTab === 'git' && renderGitPanel()}
          {activeTab === 'terminal' && (
            <div className="flex flex-col h-full">
              <div className="flex-1 p-2 font-mono text-xs bg-zinc-950 overflow-auto" ref={terminalRef}>
                {terminal.length === 0 ? (
                  <div className="text-zinc-600 p-2">
                    Terminal output will appear here when agents run commands...
                  </div>
                ) : (
                  terminal.map((line, i) => (
                    <div key={i} className="text-zinc-300 whitespace-pre-wrap">{line}</div>
                  ))
                )}
              </div>
              <TerminalInput onCommand={runCommand} />
            </div>
          )}
          {activeTab === 'tasks' && (
            <div className="p-4">
              {project.plans?.[0]?.tasks?.map((task: Task) => (
                <div 
                  key={task.id}
                  className={`flex items-center gap-2 p-2 rounded mb-2 ${
                    task.status === 'done' ? 'bg-emerald-900/30' :
                    task.status === 'failed' ? 'bg-red-900/30' :
                    task.status === 'running' ? 'bg-blue-900/30 animate-pulse' :
                    'bg-zinc-800'
                  }`}
                >
                  {task.status === 'done' ? <CheckCircle size={14} className="text-emerald-500" /> :
                   task.status === 'failed' ? <XCircle size={14} className="text-red-500" /> :
                   task.status === 'running' ? <Clock size={14} className="text-blue-500" /> :
                   <Clock size={14} className="text-zinc-500" />}
                  <span className="text-sm text-zinc-300 truncate">{task.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {selectedFile ? (
          <>
            <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <File size={14} className="text-zinc-500" />
                <span className="text-sm text-zinc-300">{selectedFile.split('/').pop()}</span>
                <span className="text-xs text-zinc-600">{selectedFile}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(fileContent)}
                  className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded"
                  title="Copy"
                >
                  <Copy size={14} />
                </button>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded"
                  title="Close"
                >
                  ×
                </button>
              </div>
            </div>
            <textarea
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              className="flex-1 bg-zinc-950 text-zinc-100 font-mono p-4 resize-none focus:outline-none text-sm leading-relaxed"
              spellCheck={false}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-600">
            <div className="text-center">
              <File size={48} className="mx-auto mb-4 opacity-50" />
              <p>Select a file from the tree to view its contents</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Terminal Input Component
function TerminalInput({ onCommand }: { onCommand: (cmd: string) => void }) {
  const [command, setCommand] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim()) {
      onCommand(command.trim());
      setCommand('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-2 border-t border-zinc-800 bg-zinc-900">
      <div className="flex items-center gap-2">
        <span className="text-zinc-500 font-mono">$</span>
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Enter command..."
          className="flex-1 bg-transparent text-zinc-100 font-mono text-sm focus:outline-none"
        />
      </div>
    </form>
  );
}
