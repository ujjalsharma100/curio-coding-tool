import fs from "node:fs/promises";
import path from "node:path";
import { createTool } from "curio-agent-sdk";
import { z } from "zod";
import { toolSessionState } from "./session-state.js";

const FileWriteArgsSchema = z.object({
  file_path: z.string().describe("Absolute path to write to"),
  content: z.string().describe("Content to write"),
});

type FileWriteArgs = z.infer<typeof FileWriteArgsSchema>;

export const fileWriteTool = createTool<FileWriteArgs>({
  name: "write_file",
  description: "Write UTF-8 content to a file, creating parent directories as needed.",
  parameters: FileWriteArgsSchema,
  execute: async (args) => {
    const targetPath = args.file_path;
    if (!targetPath) {
      return 'write_file: expected "file_path" to be a non-empty string.';
    }

    const body = args.content;
    if (!body) {
      return 'write_file: expected "content" to be a non-empty string.';
    }

    const absolutePath = path.resolve(targetPath);
    try {
      const parentDir = path.dirname(absolutePath);
      await fs.mkdir(parentDir, { recursive: true });

      let warning = "";
      let existing = false;
      try {
        await fs.access(absolutePath);
        existing = true;
      } catch {
        existing = false;
      }

      if (existing && !toolSessionState.hasReadFile(absolutePath)) {
        warning = "Warning: overwriting file that was not read first\n";
      }

      const buffer = Buffer.from(body, "utf8");
      await fs.writeFile(absolutePath, buffer, "utf8");
      return `${warning}Wrote ${buffer.byteLength} bytes to ${absolutePath}`;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "EACCES" || nodeError.code === "EPERM") {
        return `Permission denied: ${absolutePath}`;
      }
      if (nodeError.code === "ENOSPC") {
        return `Disk full while writing: ${absolutePath}`;
      }
      if (nodeError.code === "EINVAL") {
        return `Invalid path: ${absolutePath}`;
      }
      return `Failed to write file: ${absolutePath}\n${nodeError.message}`;
    }
  },
});
