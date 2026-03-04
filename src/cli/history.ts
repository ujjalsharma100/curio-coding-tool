import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const DEFAULT_HISTORY_PATH = path.join(os.homedir(), ".curio-code", "history");
const DEFAULT_MAX_ENTRIES = 10_000;

export interface InputHistoryOptions {
  historyPath?: string;
  maxEntries?: number;
  projectHistoryPath?: string;
}

export class InputHistory {
  private readonly historyPath: string;
  private readonly maxEntries: number;
  private entries: string[] = [];
  private loaded = false;

  constructor(options: InputHistoryOptions = {}) {
    this.historyPath = options.projectHistoryPath ?? options.historyPath ?? DEFAULT_HISTORY_PATH;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  async load(): Promise<string[]> {
    if (this.loaded) return this.entries;

    try {
      const content = await fs.readFile(this.historyPath, "utf-8");
      this.entries = content
        .split("\n")
        .filter((line) => line.trim().length > 0);

      if (this.entries.length > this.maxEntries) {
        this.entries = this.entries.slice(-this.maxEntries);
      }
    } catch {
      this.entries = [];
    }

    this.loaded = true;
    return this.entries;
  }

  async add(entry: string): Promise<void> {
    const trimmed = entry.trim();
    if (!trimmed) return;

    if (this.entries.length > 0 && this.entries[this.entries.length - 1] === trimmed) {
      return;
    }

    this.entries.push(trimmed);

    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    await this.save();
  }

  getEntries(): string[] {
    return [...this.entries];
  }

  getCount(): number {
    return this.entries.length;
  }

  search(query: string): string[] {
    const lower = query.toLowerCase();
    return this.entries.filter((e) => e.toLowerCase().includes(lower)).reverse();
  }

  private async save(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.historyPath), { recursive: true });
      await fs.writeFile(this.historyPath, this.entries.join("\n") + "\n", "utf-8");
    } catch {
      // Silently fail — history persistence is best-effort
    }
  }
}
