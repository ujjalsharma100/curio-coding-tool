import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  FileSessionStore,
  SessionManager,
  type Session,
  type Message,
} from "curio-agent-sdk";

export interface SessionMeta {
  id: string;
  projectPath: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  summary?: string;
  totalCost?: number;
}

const SESSIONS_DIR = path.join(os.homedir(), ".curio-code", "sessions");

function projectHash(projectPath: string): string {
  return createHash("sha256").update(path.resolve(projectPath)).digest("hex").slice(0, 12);
}

export class CurioSessionManager {
  private readonly sdkManager: SessionManager;
  private readonly store: FileSessionStore;
  private readonly agentId = "curio-code";

  constructor(sessionsDir: string = SESSIONS_DIR) {
    this.store = new FileSessionStore(sessionsDir);
    this.sdkManager = new SessionManager(this.store);
  }

  getSDKManager(): SessionManager {
    return this.sdkManager;
  }

  async createSession(
    projectPath: string,
    model: string,
  ): Promise<{ session: Session; meta: SessionMeta }> {
    const session = await this.sdkManager.create(this.agentId, {
      projectPath: path.resolve(projectPath),
      projectHash: projectHash(projectPath),
      model,
      messageCount: 0,
    });

    const meta: SessionMeta = {
      id: session.id,
      projectPath: path.resolve(projectPath),
      model,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      messageCount: 0,
    };

    return { session, meta };
  }

  async findLatestForProject(projectPath: string): Promise<Session | null> {
    const sessions = await this.sdkManager.listSessions(this.agentId, 100);
    const resolved = path.resolve(projectPath);

    for (const session of sessions) {
      if (session.metadata.projectPath === resolved) {
        return session;
      }
    }
    return null;
  }

  async resumeSession(sessionId: string): Promise<{
    session: Session;
    messages: Message[];
  }> {
    const session = await this.sdkManager.get(sessionId);
    const messages = await this.sdkManager.getMessages(sessionId, 200);
    return { session, messages };
  }

  async saveMessage(sessionId: string, message: Message): Promise<void> {
    await this.sdkManager.addMessage(sessionId, message);
  }

  async listSessions(limit = 20): Promise<Session[]> {
    return this.sdkManager.listSessions(this.agentId, limit);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.sdkManager.delete(sessionId);
  }

  async exportAsMarkdown(sessionId: string): Promise<string> {
    const session = await this.sdkManager.get(sessionId);
    const messages = await this.sdkManager.getMessages(sessionId, 500);

    const lines: string[] = [
      `# Curio Code Session: ${session.id}`,
      "",
      `- **Project**: ${session.metadata.projectPath ?? "unknown"}`,
      `- **Model**: ${session.metadata.model ?? "unknown"}`,
      `- **Created**: ${session.createdAt.toISOString()}`,
      `- **Messages**: ${messages.length}`,
      "",
      "---",
      "",
    ];

    for (const msg of messages) {
      const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
      const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      lines.push(`### ${role}`, "", content, "", "---", "");
    }

    return lines.join("\n");
  }

  async getSessionMeta(sessionId: string): Promise<SessionMeta> {
    const session = await this.sdkManager.get(sessionId);
    const messages = await this.sdkManager.getMessages(sessionId, 1000);

    return {
      id: session.id,
      projectPath: (session.metadata.projectPath as string) ?? "unknown",
      model: (session.metadata.model as string) ?? "unknown",
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      messageCount: messages.length,
      summary: session.metadata.summary as string | undefined,
      totalCost: session.metadata.totalCost as number | undefined,
    };
  }

  formatSessionTimestamp(session: Session): string {
    const now = Date.now();
    const updated = session.updatedAt.getTime();
    const diffMs = now - updated;
    const diffMins = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  static async ensureSessionsDir(dir: string = SESSIONS_DIR): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
  }
}
