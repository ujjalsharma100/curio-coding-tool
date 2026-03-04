import { createHash } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { FileMemory, MemoryManager } from "curio-agent-sdk";
import { MemoryFileManager } from "./memory-file.js";
import { detectMemoriesInMessage, shouldForget } from "./auto-memory.js";

const BASE_MEMORY_DIR = path.join(os.homedir(), ".curio-code", "projects");

function projectMemoryDir(projectPath: string): string {
  const hash = createHash("sha256")
    .update(path.resolve(projectPath))
    .digest("hex")
    .slice(0, 16);
  return path.join(BASE_MEMORY_DIR, hash, "memory");
}

export interface CurioMemorySystem {
  memoryManager: MemoryManager;
  memoryFile: MemoryFileManager;
  fileMemory: FileMemory;
}

export async function buildMemorySystem(
  projectPath: string,
): Promise<CurioMemorySystem> {
  const memDir = projectMemoryDir(projectPath);

  const fileMemory = new FileMemory({
    memoryDir: memDir,
    namespace: "entries",
  });
  await fileMemory.startup();

  const memoryManager = new MemoryManager({
    memory: fileMemory,
    namespace: "curio-code",
  });
  await memoryManager.startup();

  const memoryFile = new MemoryFileManager(memDir);
  await memoryFile.ensureDir();

  return { memoryManager, memoryFile, fileMemory };
}

export async function processAutoMemory(
  userMessage: string,
  memoryFile: MemoryFileManager,
): Promise<string[]> {
  const saved: string[] = [];

  const forgetTopic = shouldForget(userMessage);
  if (forgetTopic) {
    const removed = await memoryFile.removeEntry(forgetTopic);
    if (removed) {
      saved.push(`Forgot: "${forgetTopic}"`);
    }
    return saved;
  }

  const detected = detectMemoriesInMessage(userMessage);
  for (const memory of detected) {
    await memoryFile.appendToMainMemory(
      `- **${memory.category}**: ${memory.content}`,
    );
    saved.push(`Remembered: ${memory.content}`);
  }

  return saved;
}

export async function getMemoryForPrompt(
  memoryFile: MemoryFileManager,
): Promise<string> {
  const content = await memoryFile.readMainMemory();
  if (!content || content.trim().length === 0) {
    return "No persistent memories stored yet. The agent will auto-detect patterns worth remembering.";
  }
  return content;
}
