import { bashTaskOutputTool, bashTool } from "./bash.js";
import { fileEditTool } from "./file-edit.js";
import { fileReadTool } from "./file-read.js";
import { fileWriteTool } from "./file-write.js";
import { globTool } from "./glob.js";
import { grepTool } from "./grep.js";
import { notebookEditTool } from "./notebook-edit.js";
import { webFetchTool } from "./web-fetch.js";
import { webSearchTool } from "./web-search.js";

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
];
