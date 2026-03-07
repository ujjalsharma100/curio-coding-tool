import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import fg from "fast-glob";
import { createTool } from "curio-agent-sdk";
import { z } from "zod";

type OutputMode = "content" | "files_with_matches" | "count";

async function runRipgrep(args: string[], cwd: string): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const child = spawn("rg", args, { cwd, env: process.env });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", () => resolve({ code: 127, output: "" }));
    child.on("close", (code) => resolve({ code: code ?? 1, output }));
  });
}

async function fallbackSearch(params: {
  pattern: string;
  cwd: string;
  outputMode: OutputMode;
  pathFilter?: string;
  glob?: string;
  caseInsensitive: boolean;
  multiline: boolean;
}): Promise<string> {
  const { pattern, cwd, outputMode, pathFilter, glob, caseInsensitive, multiline } = params;
  const targetPath = path.resolve(cwd, pathFilter ?? ".");
  const targetStat = await fs.stat(targetPath);
  const files = targetStat.isDirectory()
    ? await fg(glob ?? "**/*", { cwd: targetPath, absolute: true, onlyFiles: true })
    : [targetPath];
  const regex = new RegExp(pattern, `${caseInsensitive ? "i" : ""}${multiline ? "s" : "g"}`);

  if (outputMode === "files_with_matches") {
    const matchedFiles: string[] = [];
    for (const filePath of files) {
      const content = await fs.readFile(filePath, "utf8");
      if (regex.test(content)) {
        matchedFiles.push(filePath);
      }
      regex.lastIndex = 0;
    }
    return matchedFiles.join("\n");
  }

  if (outputMode === "count") {
    const lines: string[] = [];
    for (const filePath of files) {
      const content = await fs.readFile(filePath, "utf8");
      const matches = content.match(regex);
      if (matches && matches.length > 0) {
        lines.push(`${filePath}:${matches.length}`);
      }
      regex.lastIndex = 0;
    }
    return lines.join("\n");
  }

  const contentLines: string[] = [];
  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");
    const split = content.split(/\r?\n/);
    split.forEach((line, index) => {
      if (regex.test(line)) {
        contentLines.push(`${filePath}:${index + 1}:${line}`);
      }
      regex.lastIndex = 0;
    });
  }
  return contentLines.join("\n");
}

function paginateResult(output: string, offset?: number, headLimit?: number): string {
  const lines = output.split("\n").filter((line) => line.length > 0);
  const start = offset ?? 0;
  const end = headLimit ? start + headLimit : undefined;
  const page = lines.slice(start, end);
  return page.join("\n");
}

export const grepTool = createTool({
  name: "grep",
  description: "Search file contents by regex using ripgrep with JS fallback.",
  parameters: z.object({
    pattern: z.string().describe("Regex pattern to search for"),
    path: z.string().optional().describe("File or directory to search in"),
    glob: z.string().optional().describe("Glob filter (e.g., '*.js')"),
    type: z.string().optional().describe("File type (e.g., 'ts', 'py')"),
    output_mode: z
      .enum(["content", "files_with_matches", "count"])
      .optional()
      .describe("Output mode (default: files_with_matches)"),
    "-i": z.boolean().optional().describe("Case insensitive"),
    "-A": z.number().optional().describe("Lines after match"),
    "-B": z.number().optional().describe("Lines before match"),
    "-C": z.number().optional().describe("Lines around match"),
    multiline: z.boolean().optional().describe("Enable multiline matching"),
    head_limit: z.number().optional().describe("Limit results"),
    offset: z.number().optional().describe("Skip first N results"),
  }),
  execute: async (rawArgs) => {
    const cwd = process.cwd();
    const outputMode = rawArgs.output_mode ?? "files_with_matches";
    const rgArgs: string[] = [];

    if (outputMode === "files_with_matches") rgArgs.push("--files-with-matches");
    if (outputMode === "count") rgArgs.push("--count");
    if (outputMode === "content") rgArgs.push("-n");
    if (rawArgs["-i"]) rgArgs.push("-i");
    if (rawArgs["-A"] !== undefined && outputMode === "content") rgArgs.push("-A", String(rawArgs["-A"]));
    if (rawArgs["-B"] !== undefined && outputMode === "content") rgArgs.push("-B", String(rawArgs["-B"]));
    if (rawArgs["-C"] !== undefined && outputMode === "content") rgArgs.push("-C", String(rawArgs["-C"]));
    if (rawArgs.multiline) rgArgs.push("-U", "--multiline-dotall");
    if (rawArgs.type) rgArgs.push("--type", rawArgs.type);
    if (rawArgs.glob) rgArgs.push("--glob", rawArgs.glob);

    rgArgs.push(rawArgs.pattern);
    if (rawArgs.path) {
      rgArgs.push(path.resolve(rawArgs.path));
    }

    const rgResult = await runRipgrep(rgArgs, cwd);
    let output = rgResult.output;
    if (rgResult.code === 127) {
      output = await fallbackSearch({
        pattern: rawArgs.pattern,
        cwd,
        outputMode,
        pathFilter: rawArgs.path,
        glob: rawArgs.glob,
        caseInsensitive: rawArgs["-i"] ?? false,
        multiline: rawArgs.multiline ?? false,
      });
    }

    return paginateResult(output, rawArgs.offset, rawArgs.head_limit);
  },
});
