import fs from "node:fs/promises";
import path from "node:path";
import { createTool } from "curio-agent-sdk";
import { z } from "zod";
import { toolSessionState } from "./session-state.js";

export const fileWriteTool = createTool({
  name: "write_file",
  description: "Write UTF-8 content to a file, creating parent directories as needed.",
  parameters: z.object({
    file_path: z.string().describe("Absolute path to write to"),
    content: z.string().describe("Content to write"),
  }),
  execute: async ({ file_path, content }) => {
    const absolutePath = path.resolve(file_path);
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

      const buffer = Buffer.from(content, "utf8");
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
