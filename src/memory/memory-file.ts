import fs from "node:fs/promises";
import path from "node:path";

const MAX_MEMORY_LINES = 200;

export class MemoryFileManager {
  private readonly memoryDir: string;

  constructor(memoryDir: string) {
    this.memoryDir = memoryDir;
  }

  private get mainFilePath(): string {
    return path.join(this.memoryDir, "MEMORY.md");
  }

  async ensureDir(): Promise<void> {
    await fs.mkdir(this.memoryDir, { recursive: true });
  }

  async readMainMemory(): Promise<string> {
    try {
      return await fs.readFile(this.mainFilePath, "utf-8");
    } catch {
      return "";
    }
  }

  async writeMainMemory(content: string): Promise<void> {
    await this.ensureDir();
    const lines = content.split("\n");
    const truncated = lines.length > MAX_MEMORY_LINES
      ? lines.slice(0, MAX_MEMORY_LINES).join("\n") + "\n\n<!-- Truncated at 200 lines -->"
      : content;
    await fs.writeFile(this.mainFilePath, truncated, "utf-8");
  }

  async appendToMainMemory(entry: string): Promise<void> {
    const existing = await this.readMainMemory();
    const newContent = existing
      ? `${existing.trimEnd()}\n\n${entry}`
      : `# Project Memory\n\n${entry}`;
    await this.writeMainMemory(newContent);
  }

  async readTopicMemory(topic: string): Promise<string> {
    try {
      const safeName = topic.replace(/[^a-z0-9-_]/gi, "-").toLowerCase();
      return await fs.readFile(path.join(this.memoryDir, `${safeName}.md`), "utf-8");
    } catch {
      return "";
    }
  }

  async writeTopicMemory(topic: string, content: string): Promise<void> {
    await this.ensureDir();
    const safeName = topic.replace(/[^a-z0-9-_]/gi, "-").toLowerCase();
    await fs.writeFile(path.join(this.memoryDir, `${safeName}.md`), content, "utf-8");
  }

  async listTopics(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.memoryDir);
      return files
        .filter((f) => f.endsWith(".md") && f !== "MEMORY.md")
        .map((f) => f.replace(/\.md$/, ""));
    } catch {
      return [];
    }
  }

  async removeEntry(keyword: string): Promise<boolean> {
    const content = await this.readMainMemory();
    if (!content) return false;

    const lines = content.split("\n");
    const filtered = lines.filter(
      (line) => !line.toLowerCase().includes(keyword.toLowerCase()),
    );

    if (filtered.length === lines.length) return false;

    await this.writeMainMemory(filtered.join("\n"));
    return true;
  }
}
