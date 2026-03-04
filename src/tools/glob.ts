import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import ignore from "ignore";
import { createTool } from "curio-agent-sdk";
import { z } from "zod";

const DEFAULT_LIMIT = 200;

async function loadGitignore(basePath: string): Promise<(filePath: string) => boolean> {
  try {
    const gitignorePath = path.join(basePath, ".gitignore");
    const contents = await fs.readFile(gitignorePath, "utf8");
    const engine = ignore().add(contents);
    return (filePath: string) => engine.ignores(filePath);
  } catch {
    return () => false;
  }
}

export const globTool = createTool({
  name: "glob",
  description: "Fast file pattern matching with optional path scope.",
  parameters: z.object({
    pattern: z.string().describe("Glob pattern (e.g., '**/*.ts', 'src/**/*.tsx')"),
    path: z.string().optional().describe("Directory to search in (defaults to cwd)"),
    limit: z.number().optional().describe("Maximum number of files to return"),
  }),
  execute: async ({ pattern, path: searchPath, limit }) => {
    const basePath = path.resolve(searchPath ?? process.cwd());
    const maxResults = limit ?? DEFAULT_LIMIT;
    const isIgnored = await loadGitignore(basePath);
    const matches = await fg(pattern, {
      cwd: basePath,
      absolute: true,
      onlyFiles: true,
      dot: false,
      unique: true,
      suppressErrors: true,
    });

    const filtered = matches.filter((filePath) => {
      const relativePath = path.relative(basePath, filePath);
      return !isIgnored(relativePath);
    });

    const withStats = await Promise.all(
      filtered.map(async (filePath) => ({
        filePath,
        mtimeMs: (await fs.stat(filePath)).mtimeMs,
      })),
    );
    withStats.sort((a, b) => b.mtimeMs - a.mtimeMs);

    const truncated = withStats.slice(0, maxResults).map((entry) => entry.filePath);
    const output = truncated.join("\n");
    if (withStats.length > maxResults) {
      return `${output}\n[${withStats.length - maxResults} more files...]`;
    }
    return output;
  },
});
