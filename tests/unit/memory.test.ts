import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { MemoryFileManager } from "../../src/memory/memory-file.js";
import {
  detectMemoriesInMessage,
  shouldForget,
} from "../../src/memory/auto-memory.js";
import { processAutoMemory, getMemoryForPrompt } from "../../src/memory/memory-store.js";
import { InputHistory } from "../../src/cli/history.js";
import {
  isSlashCommand,
  handleSlashCommand,
} from "../../src/cli/commands/slash-commands.js";
import { CurioSessionManager } from "../../src/sessions/manager.js";

describe("Phase 6 Memory File Manager", () => {
  let tmpDir: string;
  let memFile: MemoryFileManager;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `curio-test-memory-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
    memFile = new MemoryFileManager(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // cleanup best-effort
    }
  });

  it("reads empty main memory when no file exists", async () => {
    const content = await memFile.readMainMemory();
    expect(content).toBe("");
  });

  it("writes and reads main memory", async () => {
    await memFile.writeMainMemory("# Memory\n\n- Use bun always");
    const content = await memFile.readMainMemory();
    expect(content).toContain("Use bun always");
  });

  it("appends to main memory", async () => {
    await memFile.appendToMainMemory("- First entry");
    await memFile.appendToMainMemory("- Second entry");

    const content = await memFile.readMainMemory();
    expect(content).toContain("First entry");
    expect(content).toContain("Second entry");
    expect(content).toContain("# Project Memory");
  });

  it("truncates main memory at 200 lines", async () => {
    const longContent = Array.from({ length: 250 }, (_, i) => `Line ${i + 1}`).join("\n");
    await memFile.writeMainMemory(longContent);

    const content = await memFile.readMainMemory();
    const lines = content.split("\n");
    expect(lines.length).toBeLessThanOrEqual(203); // 200 + truncation comment
    expect(content).toContain("Truncated at 200 lines");
  });

  it("writes and reads topic memory", async () => {
    await memFile.writeTopicMemory("debugging", "# Debugging Notes\n\nUse --inspect flag");
    const content = await memFile.readTopicMemory("debugging");
    expect(content).toContain("--inspect flag");
  });

  it("lists topics", async () => {
    await memFile.writeTopicMemory("debugging", "notes");
    await memFile.writeTopicMemory("patterns", "notes");

    const topics = await memFile.listTopics();
    expect(topics).toContain("debugging");
    expect(topics).toContain("patterns");
  });

  it("removes entry by keyword", async () => {
    await memFile.writeMainMemory("# Memory\n\n- Use bun always\n- Prefer tabs");

    const removed = await memFile.removeEntry("bun");
    expect(removed).toBe(true);

    const content = await memFile.readMainMemory();
    expect(content).not.toContain("bun");
    expect(content).toContain("tabs");
  });

  it("returns false when no matching entry found for removal", async () => {
    await memFile.writeMainMemory("# Memory\n\n- Use bun always");

    const removed = await memFile.removeEntry("nonexistent-thing");
    expect(removed).toBe(false);
  });
});

describe("Phase 6 Auto-Memory Detection", () => {
  it("detects user preferences", () => {
    const memories = detectMemoriesInMessage("always use bun instead of npm");
    expect(memories.length).toBeGreaterThan(0);
    expect(memories[0]!.category).toBe("preference");
  });

  it("detects explicit 'remember' commands", () => {
    const memories = detectMemoriesInMessage(
      "remember that we use PostgreSQL for the database",
    );
    expect(memories.length).toBe(1);
    expect(memories[0]!.category).toBe("explicit");
    expect(memories[0]!.content).toContain("PostgreSQL");
  });

  it("detects architecture patterns", () => {
    const memories = detectMemoriesInMessage(
      "we use microservices architecture for the backend",
    );
    expect(memories.length).toBeGreaterThan(0);
    const arch = memories.find((m) => m.category === "architecture");
    expect(arch).toBeDefined();
  });

  it("returns empty array for regular messages", () => {
    const memories = detectMemoriesInMessage("can you fix this bug?");
    expect(memories).toEqual([]);
  });

  it("detects 'forget' keyword", () => {
    const topic = shouldForget("forget about the tabs preference");
    expect(topic).toBe("the tabs preference");
  });

  it("returns null when no forget detected", () => {
    const topic = shouldForget("fix the styling issue");
    expect(topic).toBeNull();
  });
});

describe("Phase 6 processAutoMemory", () => {
  let tmpDir: string;
  let memFile: MemoryFileManager;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `curio-test-automem-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
    memFile = new MemoryFileManager(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // cleanup
    }
  });

  it("auto-saves detected preferences", async () => {
    const saved = await processAutoMemory("always use bun", memFile);
    expect(saved.length).toBeGreaterThan(0);
    expect(saved[0]).toContain("Remembered");

    const content = await memFile.readMainMemory();
    expect(content).toContain("preference");
  });

  it("handles forget command", async () => {
    await memFile.appendToMainMemory("- Use bun for everything");
    const saved = await processAutoMemory("forget about bun", memFile);
    expect(saved.length).toBe(1);
    expect(saved[0]).toContain("Forgot");

    const content = await memFile.readMainMemory();
    expect(content).not.toContain("bun");
  });

  it("returns empty for regular messages", async () => {
    const saved = await processAutoMemory("fix the bug please", memFile);
    expect(saved).toEqual([]);
  });
});

describe("Phase 6 getMemoryForPrompt", () => {
  let tmpDir: string;
  let memFile: MemoryFileManager;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `curio-test-prompt-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
    memFile = new MemoryFileManager(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // cleanup
    }
  });

  it("returns default message when no memories exist", async () => {
    const content = await getMemoryForPrompt(memFile);
    expect(content).toContain("No persistent memories");
  });

  it("returns memory content when memories exist", async () => {
    await memFile.writeMainMemory("# Memory\n\n- Use bun");
    const content = await getMemoryForPrompt(memFile);
    expect(content).toContain("Use bun");
  });
});

describe("Phase 6 Input History", () => {
  let tmpDir: string;
  let historyPath: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `curio-test-history-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
    historyPath = path.join(tmpDir, "history");
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // cleanup
    }
  });

  it("loads empty history when no file exists", async () => {
    const history = new InputHistory({ historyPath });
    const entries = await history.load();
    expect(entries).toEqual([]);
  });

  it("adds and persists entries", async () => {
    const history = new InputHistory({ historyPath });
    await history.load();

    await history.add("first command");
    await history.add("second command");

    expect(history.getCount()).toBe(2);
    expect(history.getEntries()).toEqual(["first command", "second command"]);

    const history2 = new InputHistory({ historyPath });
    const entries = await history2.load();
    expect(entries).toEqual(["first command", "second command"]);
  });

  it("deduplicates consecutive entries", async () => {
    const history = new InputHistory({ historyPath });
    await history.load();

    await history.add("same command");
    await history.add("same command");

    expect(history.getCount()).toBe(1);
  });

  it("respects max entries limit", async () => {
    const history = new InputHistory({ historyPath, maxEntries: 3 });
    await history.load();

    await history.add("one");
    await history.add("two");
    await history.add("three");
    await history.add("four");

    expect(history.getCount()).toBe(3);
    expect(history.getEntries()).toEqual(["two", "three", "four"]);
  });

  it("searches entries by keyword", async () => {
    const history = new InputHistory({ historyPath });
    await history.load();

    await history.add("fix the bug");
    await history.add("add tests");
    await history.add("fix the linter");

    const results = history.search("fix");
    expect(results.length).toBe(2);
    expect(results[0]).toBe("fix the linter");
  });

  it("ignores empty entries", async () => {
    const history = new InputHistory({ historyPath });
    await history.load();

    await history.add("");
    await history.add("   ");

    expect(history.getCount()).toBe(0);
  });
});

describe("Phase 6 Slash Commands", () => {
  it("isSlashCommand returns true for slash-prefixed input", () => {
    expect(isSlashCommand("/help")).toBe(true);
    expect(isSlashCommand("/sessions")).toBe(true);
    expect(isSlashCommand("help")).toBe(false);
    expect(isSlashCommand("")).toBe(false);
  });

  it("/help returns available commands", async () => {
    const result = await handleSlashCommand("/help", {});
    expect(result.handled).toBe(true);
    expect(result.output).toContain("/help");
    expect(result.output).toContain("/sessions");
    expect(result.output).toContain("/memory");
    expect(result.output).toContain("/compact");
    expect(result.output).toContain("/forget");
  });

  it("/clear returns __CLEAR__ sentinel", async () => {
    const result = await handleSlashCommand("/clear", {});
    expect(result.handled).toBe(true);
    expect(result.output).toBe("__CLEAR__");
  });

  it("/sessions returns error when no manager", async () => {
    const result = await handleSlashCommand("/sessions", {});
    expect(result.handled).toBe(true);
    expect(result.error).toContain("not available");
  });

  it("/memory returns error when no memory file", async () => {
    const result = await handleSlashCommand("/memory", {});
    expect(result.handled).toBe(true);
    expect(result.error).toContain("not available");
  });

  it("/forget returns error when no memory file", async () => {
    const result = await handleSlashCommand("/forget tabs", {});
    expect(result.handled).toBe(true);
    expect(result.error).toContain("not available");
  });

  it("/compact returns compression message", async () => {
    const result = await handleSlashCommand("/compact", {});
    expect(result.handled).toBe(true);
    expect(result.output).toContain("context compressed");
  });

  it("unknown command returns error", async () => {
    const result = await handleSlashCommand("/foo", {});
    expect(result.handled).toBe(false);
    expect(result.error).toContain("Unknown command");
  });

  describe("with session manager", () => {
    let tmpDir: string;
    let sessionManager: CurioSessionManager;

    beforeEach(async () => {
      tmpDir = path.join(os.tmpdir(), `curio-test-slash-${Date.now()}`);
      await fs.mkdir(tmpDir, { recursive: true });
      sessionManager = new CurioSessionManager(tmpDir);
    });

    afterEach(async () => {
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch {
        // cleanup
      }
    });

    it("/sessions lists sessions", async () => {
      await sessionManager.createSession("/tmp/proj", "sonnet");

      const result = await handleSlashCommand("/sessions", { sessionManager });
      expect(result.handled).toBe(true);
      expect(result.output).toContain("Recent sessions");
    });

    it("/sessions shows empty message when no sessions", async () => {
      const result = await handleSlashCommand("/sessions", { sessionManager });
      expect(result.handled).toBe(true);
      expect(result.output).toContain("No sessions found");
    });

    it("/session delete removes a session", async () => {
      const { session } = await sessionManager.createSession("/tmp/proj", "sonnet");
      const shortId = session.id.slice(0, 8);

      const result = await handleSlashCommand(`/session delete ${shortId}`, { sessionManager });
      expect(result.handled).toBe(true);
      expect(result.output).toContain("Deleted session");

      const sessions = await sessionManager.listSessions();
      expect(sessions.length).toBe(0);
    });

    it("/session export returns markdown", async () => {
      const { session } = await sessionManager.createSession("/tmp/proj", "sonnet");
      await sessionManager.saveMessage(session.id, { role: "user", content: "hello" });
      const shortId = session.id.slice(0, 8);

      const result = await handleSlashCommand(`/session export ${shortId}`, { sessionManager });
      expect(result.handled).toBe(true);
      expect(result.output).toContain("# Curio Code Session");
      expect(result.output).toContain("hello");
    });
  });

  describe("with memory file", () => {
    let tmpDir: string;
    let memoryFile: MemoryFileManager;

    beforeEach(async () => {
      tmpDir = path.join(os.tmpdir(), `curio-test-memcmd-${Date.now()}`);
      await fs.mkdir(tmpDir, { recursive: true });
      memoryFile = new MemoryFileManager(tmpDir);
    });

    afterEach(async () => {
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch {
        // cleanup
      }
    });

    it("/memory shows memory contents", async () => {
      await memoryFile.writeMainMemory("# Memory\n\n- Use bun");

      const result = await handleSlashCommand("/memory", { memoryFile });
      expect(result.handled).toBe(true);
      expect(result.output).toContain("Use bun");
    });

    it("/memory shows empty message when no memory", async () => {
      const result = await handleSlashCommand("/memory", { memoryFile });
      expect(result.handled).toBe(true);
      expect(result.output).toContain("No memories stored");
    });

    it("/forget removes matching entries", async () => {
      await memoryFile.writeMainMemory("# Memory\n\n- Use bun\n- Prefer tabs");

      const result = await handleSlashCommand("/forget bun", { memoryFile });
      expect(result.handled).toBe(true);
      expect(result.output).toContain("Removed memories");
    });

    it("/forget shows message when no match", async () => {
      await memoryFile.writeMainMemory("# Memory\n\n- Use bun");

      const result = await handleSlashCommand("/forget xyz", { memoryFile });
      expect(result.handled).toBe(true);
      expect(result.output).toContain("No memories found");
    });
  });
});
