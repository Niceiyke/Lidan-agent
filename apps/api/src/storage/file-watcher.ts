import { watch, FSWatcher, WatchEventType } from 'fs';
import { promises as fs } from 'fs';
import { join, basename, dirname } from 'path';
import { EventEmitter } from 'events';
import type { FileEvent, FileNode } from '@agentic-os/types';

export interface WatchOptions {
  ignorePatterns?: RegExp[];
  debounceMs?: number;
}

const DEFAULT_IGNORE = [
  /node_modules/,
  /\.git/,
  /\.next/,
  /\.turbo/,
  /\.nuxt/,
  /dist/,
  /build/,
  /\.cache/,
  /\.tmp/,
  /\.temp/,
  /\.log/,
  /\.DS_Store/,
];

export class FileWatcher extends EventEmitter {
  private watchers: Map<string, FSWatcher> = new Map();
  private fileEvents: Map<string, FileEvent> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private debounceMs: number;
  private ignorePatterns: RegExp[];
  private sse: any; // SSEBroadcaster

  constructor(options: WatchOptions = {}) {
    super();
    this.debounceMs = options.debounceMs ?? 100;
    this.ignorePatterns = options.ignorePatterns ?? DEFAULT_IGNORE;
  }

  /**
   * Set SSE broadcaster for real-time events
   */
  setSSE(sse: any): void {
    this.sse = sse;
  }

  /**
   * Start watching a directory
   */
  async watchDirectory(dirPath: string): Promise<void> {
    if (this.watchers.has(dirPath)) return;

    try {
      const watcher = watch(dirPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        this.handleEvent(dirPath, eventType as WatchEventType, filename);
      });

      watcher.on('error', (error) => {
        console.error(`Watcher error for ${dirPath}:`, error);
      });

      this.watchers.set(dirPath, watcher);
      console.log(`Watching directory: ${dirPath}`);
    } catch (error) {
      console.error(`Failed to watch ${dirPath}:`, error);
    }
  }

  /**
   * Stop watching a directory
   */
  stopWatching(dirPath: string): void {
    const watcher = this.watchers.get(dirPath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(dirPath);
      console.log(`Stopped watching: ${dirPath}`);
    }
  }

  /**
   * Stop all watchers
   */
  stopAll(): void {
    for (const [path, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
  }

  /**
   * Build file tree for a directory
   */
  async buildFileTree(dirPath: string, maxDepth = 10): Promise<FileNode[]> {
    const nodes: FileNode[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (this.shouldIgnore(entry.name)) continue;

        const fullPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
          const children = maxDepth > 1 
            ? await this.buildFileTree(fullPath, maxDepth - 1)
            : [];

          nodes.push({
            name: entry.name,
            type: 'directory',
            path: fullPath,
            children,
          });
        } else {
          nodes.push({
            name: entry.name,
            type: 'file',
            path: fullPath,
          });
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dirPath}:`, error);
    }

    // Sort: directories first, then files, alphabetically
    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Get file content
   */
  async readFileContent(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Write file content
   */
  async writeFileContent(filePath: string, content: string): Promise<boolean> {
    try {
      // Ensure directory exists
      const dir = dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(filePath, content, 'utf-8');
      return true;
    } catch (error) {
      console.error(`Error writing file ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Handle file system event with debouncing
   */
  private handleEvent(basePath: string, eventType: WatchEventType, filename: string): void {
    if (this.shouldIgnore(filename)) return;

    const fullPath = join(basePath, filename);
    const eventKey = fullPath;

    // Debounce events for the same file
    const existingTimer = this.debounceTimers.get(eventKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(eventKey);
      this.emitFileEvent(fullPath, eventType);
    }, this.debounceMs);

    this.debounceTimers.set(eventKey, timer);
  }

  /**
   * Emit file event
   */
  private emitFileEvent(filePath: string, eventType: WatchEventType): void {
    let action: FileEvent['action'];
    let stat;

    try {
      stat = require('fs').statSync(filePath);
    } catch {
      // File might have been deleted
    }

    switch (eventType) {
      case 'rename':
        action = stat ? 'created' : 'deleted';
        break;
      case 'change':
        action = 'modified';
        break;
      default:
        action = 'modified';
    }

    const event: FileEvent = {
      path: filePath,
      action,
    };

    this.emit('file:event', event);

    // Broadcast via SSE if available
    if (this.sse) {
      this.sse.broadcast('file:event', event);
    }
  }

  /**
   * Check if file should be ignored
   */
  private shouldIgnore(name: string): boolean {
    for (const pattern of this.ignorePatterns) {
      if (pattern.test(name)) return true;
    }
    return false;
  }

  /**
   * Get active watchers
   */
  getWatchedPaths(): string[] {
    return Array.from(this.watchers.keys());
  }
}

// Singleton instance
let fileWatcher: FileWatcher | null = null;

export function getFileWatcher(): FileWatcher {
  if (!fileWatcher) {
    fileWatcher = new FileWatcher();
  }
  return fileWatcher;
}

export function createFileWatcher(options?: WatchOptions): FileWatcher {
  fileWatcher = new FileWatcher(options);
  return fileWatcher;
}
