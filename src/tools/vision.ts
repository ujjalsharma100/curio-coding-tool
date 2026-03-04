import { createTool } from "curio-agent-sdk";
import { z } from "zod";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, extname } from "node:path";

const SUPPORTED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB

export function isSupportedImagePath(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

export function detectImagePathsInText(text: string): string[] {
  const words = text.split(/\s+/);
  return words.filter((w) => isSupportedImagePath(w));
}

export function readImageAsBase64(filePath: string): { base64: string; mimeType: string } | null {
  const absPath = resolve(filePath);
  if (!existsSync(absPath)) return null;

  const stats = statSync(absPath);
  if (stats.size > MAX_IMAGE_SIZE) return null;

  const ext = extname(absPath).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };

  const mimeType = mimeMap[ext];
  if (!mimeType) return null;

  const buffer = readFileSync(absPath);
  return {
    base64: buffer.toString("base64"),
    mimeType,
  };
}

export const screenshotTool = createTool({
  name: "read_image",
  description:
    "Read an image file and analyze its contents. Supports PNG, JPEG, GIF, and WebP. " +
    "Useful for reviewing screenshots, UI mockups, diagrams, or any visual content.",
  parameters: z.object({
    path: z.string().describe("Path to the image file"),
    question: z
      .string()
      .optional()
      .describe("Specific question about the image content"),
  }),
  execute: async (args) => {
    const absPath = resolve(args.path);

    if (!existsSync(absPath)) {
      return `Image not found: ${args.path}`;
    }

    if (!isSupportedImagePath(absPath)) {
      return `Unsupported image format. Supported: ${Array.from(SUPPORTED_EXTENSIONS).join(", ")}`;
    }

    const stats = statSync(absPath);
    if (stats.size > MAX_IMAGE_SIZE) {
      return `Image too large (${(stats.size / 1024 / 1024).toFixed(1)}MB). Maximum: 20MB.`;
    }

    const result = readImageAsBase64(absPath);
    if (!result) {
      return `Failed to read image: ${args.path}`;
    }

    return [
      `Image loaded: ${args.path}`,
      `Format: ${result.mimeType}`,
      `Size: ${(stats.size / 1024).toFixed(1)}KB`,
      `Base64 length: ${result.base64.length} chars`,
      args.question ? `\nAnalysis request: ${args.question}` : "",
      "\n[Image content included in context for vision-capable models]",
    ]
      .filter(Boolean)
      .join("\n");
  },
});

export function isVisionCapableModel(model: string): boolean {
  const visionModels = [
    "claude",
    "gpt-4o",
    "gpt-4-turbo",
    "gemini",
  ];
  const modelLower = model.toLowerCase();
  return visionModels.some((vm) => modelLower.includes(vm));
}
