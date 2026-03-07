import fs from "node:fs/promises";
import path from "node:path";
import { createTool } from "curio-agent-sdk";
import { z } from "zod";
import { toolSessionState } from "./session-state.js";

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) {
    return 0;
  }
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

function buildSimpleUnifiedDiff(
  filePath: string,
  before: string,
  after: string,
  contextLines = 3,
): string {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");

  let start = 0;
  while (
    start < beforeLines.length &&
    start < afterLines.length &&
    beforeLines[start] === afterLines[start]
  ) {
    start += 1;
  }

  let beforeEnd = beforeLines.length - 1;
  let afterEnd = afterLines.length - 1;
  while (beforeEnd >= start && afterEnd >= start && beforeLines[beforeEnd] === afterLines[afterEnd]) {
    beforeEnd -= 1;
    afterEnd -= 1;
  }

  const beforeChunkStart = Math.max(0, start - contextLines);
  const beforeChunkEnd = Math.min(beforeLines.length - 1, beforeEnd + contextLines);
  const afterChunkStart = Math.max(0, start - contextLines);
  const afterChunkEnd = Math.min(afterLines.length - 1, afterEnd + contextLines);

  const removedCount = Math.max(0, beforeChunkEnd - beforeChunkStart + 1);
  const addedCount = Math.max(0, afterChunkEnd - afterChunkStart + 1);
  const lines: string[] = [`--- a/${filePath}`, `+++ b/${filePath}`];
  lines.push(`@@ -${beforeChunkStart + 1},${removedCount} +${afterChunkStart + 1},${addedCount} @@`);

  for (let line = beforeChunkStart; line <= beforeChunkEnd; line += 1) {
    const beforeLine = beforeLines[line];
    const afterLine = afterLines[line - beforeChunkStart + afterChunkStart];
    if (line >= start && line <= beforeEnd) {
      lines.push(`-${beforeLine ?? ""}`);
    } else if (beforeLine === afterLine) {
      lines.push(` ${beforeLine ?? ""}`);
    }
  }
  for (let line = afterChunkStart; line <= afterChunkEnd; line += 1) {
    if (line >= start && line <= afterEnd) {
      lines.push(`+${afterLines[line] ?? ""}`);
    }
  }
  return lines.join("\n");
}

export const fileEditTool = createTool({
  name: "edit_file",
  description: "Edit a file via exact string replacement with uniqueness validation.",
  parameters: z.object({
    file_path: z.string().describe("Absolute path to the file"),
    old_string: z.string().describe("Exact text to find and replace"),
    new_string: z.string().describe("Replacement text"),
    replace_all: z.boolean().optional().describe("Replace all occurrences (default: false)"),
  }),
  execute: async ({ file_path, old_string, new_string, replace_all: replaceAll }) => {
    const replace_all = replaceAll ?? false;
    const absolutePath = path.resolve(file_path);
    if (!toolSessionState.hasReadFile(absolutePath)) {
      return `File must be read before editing: ${absolutePath}`;
    }
    if (old_string === new_string) {
      return "No-op edit rejected: old_string and new_string are identical.";
    }
    try {
      const original = await fs.readFile(absolutePath, "utf8");
      const occurrences = countOccurrences(original, old_string);
      if (occurrences === 0) {
        return "old_string not found in file. Check indentation and whitespace.";
      }
      if (!replace_all && occurrences > 1) {
        return `old_string matches ${occurrences} locations. Provide more context to make it unique, or use replace_all: true`;
      }

      const updated = replace_all
        ? original.split(old_string).join(new_string)
        : original.replace(old_string, new_string);

      await fs.writeFile(absolutePath, updated, "utf8");
      const diff = buildSimpleUnifiedDiff(absolutePath, original, updated);
      return `Applied edit to ${absolutePath}\n\n${diff}`;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return `File not found: ${absolutePath}`;
      }
      if (nodeError.code === "EACCES" || nodeError.code === "EPERM") {
        return `Permission denied: ${absolutePath}`;
      }
      return `Failed to edit file: ${absolutePath}\n${nodeError.message}`;
    }
  },
});
