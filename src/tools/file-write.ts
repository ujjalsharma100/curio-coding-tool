import fs from "node:fs/promises";
import path from "node:path";
import { createTool } from "curio-agent-sdk";
import { z } from "zod";
import { toolSessionState } from "./session-state.js";

const FileWriteArgsSchema = z
  .object({
    file_path: z
      .string()
      .optional()
      .describe("Absolute path to write to"),
    // Common path aliases models sometimes use
    path: z
      .string()
      .optional()
      .describe("Alias for file_path; treated the same."),
    filename: z
      .string()
      .optional()
      .describe("Alias for file_path; treated the same."),
    file: z
      .string()
      .optional()
      .describe("Alias for file_path; treated the same."),
    content: z
      .string()
      .optional()
      .describe("Content to write"),
    // Common aliases for content in tool-calling examples
    text: z
      .string()
      .optional()
      .describe("Alias for content; treated the same as content."),
    body: z
      .string()
      .optional()
      .describe("Alias for content; treated the same as content."),
  })
  // Allow extra keys from various providers/models without failing validation.
  .passthrough();

type FileWriteArgs = z.infer<typeof FileWriteArgsSchema> & Record<string, unknown>;

export const fileWriteTool = createTool<FileWriteArgs>({
  name: "write_file",
  description: "Write UTF-8 content to a file, creating parent directories as needed.",
  parameters: FileWriteArgsSchema,
  execute: async (args) => {
    const targetPath =
      (typeof args.file_path === "string" && args.file_path) ??
      (typeof args.path === "string" && args.path) ??
      (typeof args.filename === "string" && args.filename) ??
      (typeof args.file === "string" && args.file) ??
      "";

    if (!targetPath) {
      return 'write_file: expected "file_path" (or "path", "filename", "file") to be a non-empty string.';
    }

    const body =
      (typeof args.content === "string" && args.content) ??
      (typeof args.text === "string" && args.text) ??
      (typeof args.body === "string" && args.body) ??
      "";

    if (!body) {
      return 'write_file: expected "content" (or "text", "body") to be a non-empty string.';
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
