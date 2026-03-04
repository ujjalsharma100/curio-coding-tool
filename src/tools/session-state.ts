import path from "node:path";
import { randomUUID } from "node:crypto";

interface BackgroundTaskSnapshot {
  id: string;
  command: string;
  cwd: string;
  startedAt: number;
  running: boolean;
  exitCode: number | null;
  output: string;
}

class ToolSessionState {
  private readonly readFiles = new Set<string>();
  private bashCwd = process.cwd();
  private readonly backgroundTasks = new Map<string, BackgroundTaskSnapshot>();

  markFileRead(filePath: string): void {
    this.readFiles.add(path.resolve(filePath));
  }

  hasReadFile(filePath: string): boolean {
    return this.readFiles.has(path.resolve(filePath));
  }

  getBashCwd(): string {
    return this.bashCwd;
  }

  setBashCwd(nextCwd: string): void {
    this.bashCwd = path.resolve(nextCwd);
  }

  createBackgroundTask(command: string, cwd: string): string {
    const id = randomUUID();
    this.backgroundTasks.set(id, {
      id,
      command,
      cwd,
      startedAt: Date.now(),
      running: true,
      exitCode: null,
      output: "",
    });
    return id;
  }

  appendBackgroundTaskOutput(taskId: string, chunk: string): void {
    const task = this.backgroundTasks.get(taskId);
    if (!task) {
      return;
    }
    task.output += chunk;
  }

  finishBackgroundTask(taskId: string, exitCode: number | null): void {
    const task = this.backgroundTasks.get(taskId);
    if (!task) {
      return;
    }
    task.running = false;
    task.exitCode = exitCode;
  }

  getBackgroundTask(taskId: string): BackgroundTaskSnapshot | undefined {
    return this.backgroundTasks.get(taskId);
  }
}

export const toolSessionState = new ToolSessionState();
