import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { CurioSessionManager } from "../../src/sessions/manager.js";

describe("Phase 6 Session Management", () => {
  let tmpDir: string;
  let manager: CurioSessionManager;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `curio-test-sessions-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
    manager = new CurioSessionManager(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // cleanup best-effort
    }
  });

  it("creates a new session with metadata", async () => {
    const { session, meta } = await manager.createSession("/tmp/project", "anthropic:claude-sonnet-4-6");

    expect(session.id).toBeDefined();
    expect(session.id.length).toBeGreaterThan(0);
    expect(meta.projectPath).toBe("/tmp/project");
    expect(meta.model).toBe("anthropic:claude-sonnet-4-6");
    expect(meta.messageCount).toBe(0);
    expect(meta.createdAt).toBeDefined();
    expect(meta.updatedAt).toBeDefined();
  });

  it("lists sessions ordered by most recent", async () => {
    const { session: s1 } = await manager.createSession("/tmp/proj1", "sonnet");
    // Small delay so updatedAt timestamps differ
    await new Promise((r) => setTimeout(r, 20));
    const { session: s2 } = await manager.createSession("/tmp/proj2", "opus");

    const sessions = await manager.listSessions(20);
    expect(sessions.length).toBe(2);
    expect(sessions[0]!.id).toBe(s2.id);
    expect(sessions[1]!.id).toBe(s1.id);
  });

  it("finds latest session for a project", async () => {
    await manager.createSession("/tmp/proj-a", "sonnet");
    await new Promise((r) => setTimeout(r, 20));
    const { session: s2 } = await manager.createSession("/tmp/proj-a", "opus");
    await new Promise((r) => setTimeout(r, 20));
    await manager.createSession("/tmp/proj-b", "haiku");

    const found = await manager.findLatestForProject("/tmp/proj-a");
    expect(found).not.toBeNull();
    expect(found!.id).toBe(s2.id);
  });

  it("returns null when no session exists for a project", async () => {
    await manager.createSession("/tmp/other", "sonnet");

    const found = await manager.findLatestForProject("/tmp/missing");
    expect(found).toBeNull();
  });

  it("resumes a session and returns messages", async () => {
    const { session } = await manager.createSession("/tmp/proj", "sonnet");
    await manager.saveMessage(session.id, { role: "user", content: "hello" });
    await manager.saveMessage(session.id, { role: "assistant", content: "hi there" });

    const { session: resumed, messages } = await manager.resumeSession(session.id);
    expect(resumed.id).toBe(session.id);
    expect(messages.length).toBe(2);
    expect(messages[0]!.role).toBe("user");
    expect(messages[0]!.content).toBe("hello");
    expect(messages[1]!.role).toBe("assistant");
    expect(messages[1]!.content).toBe("hi there");
  });

  it("deletes a session", async () => {
    const { session } = await manager.createSession("/tmp/proj", "sonnet");
    await manager.deleteSession(session.id);

    const sessions = await manager.listSessions(20);
    expect(sessions.length).toBe(0);
  });

  it("exports session as markdown", async () => {
    const { session } = await manager.createSession("/tmp/proj", "sonnet");
    await manager.saveMessage(session.id, { role: "user", content: "explain this" });
    await manager.saveMessage(session.id, { role: "assistant", content: "Sure, here is..." });

    const md = await manager.exportAsMarkdown(session.id);
    expect(md).toContain("# Curio Code Session");
    expect(md).toContain("User");
    expect(md).toContain("explain this");
    expect(md).toContain("Assistant");
    expect(md).toContain("Sure, here is...");
  });

  it("getSessionMeta returns correct metadata", async () => {
    const { session } = await manager.createSession("/tmp/proj", "sonnet");
    await manager.saveMessage(session.id, { role: "user", content: "hello" });

    const meta = await manager.getSessionMeta(session.id);
    expect(meta.id).toBe(session.id);
    expect(meta.model).toBe("sonnet");
    expect(meta.messageCount).toBe(1);
  });

  it("formatSessionTimestamp returns human-readable relative time", () => {
    const session = {
      id: "test-id",
      agentId: "curio-code",
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(Date.now() - 120_000),
    };
    const result = manager.formatSessionTimestamp(session);
    expect(result).toBe("2m ago");
  });

  it("formatSessionTimestamp returns 'just now' for recent sessions", () => {
    const session = {
      id: "test-id",
      agentId: "curio-code",
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = manager.formatSessionTimestamp(session);
    expect(result).toBe("just now");
  });
});
