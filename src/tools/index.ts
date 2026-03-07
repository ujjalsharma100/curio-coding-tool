import { bashTaskOutputTool, bashTool } from "./bash.js";
import { fileEditTool } from "./file-edit.js";
import { fileReadTool } from "./file-read.js";
import { fileWriteTool } from "./file-write.js";
import { globTool } from "./glob.js";
import { grepTool } from "./grep.js";
import { notebookEditTool } from "./notebook-edit.js";
import { webFetchTool } from "./web-fetch.js";
import { webSearchTool } from "./web-search.js";
import { screenshotTool } from "./vision.js";

export { createAgentSpawnTool, createTaskOutputTool, SubagentTaskRegistry } from "./agent-spawn.js";
export { screenshotTool } from "./vision.js";
export { isSupportedImagePath, detectImagePathsInText, readImageAsBase64, isVisionCapableModel } from "./vision.js";

export const phaseTwoTools = [
  fileReadTool,
  fileWriteTool,
  fileEditTool,
  globTool,
  grepTool,
  bashTool,
  bashTaskOutputTool,
  webFetchTool,
  webSearchTool,
  notebookEditTool,
  screenshotTool,
];

/** Core tools for providers with limited tool-calling ability (Groq, etc.).
 *  Fewer tools with simpler schemas for reliable tool calling. */
export const coreTools = [
  fileReadTool,
  fileWriteTool,
  fileEditTool,
  globTool,
  grepTool,
  bashTool,
];

export const readOnlyTools = [
  fileReadTool,
  globTool,
  grepTool,
  webFetchTool,
  webSearchTool,
];

export const allTools = phaseTwoTools;
