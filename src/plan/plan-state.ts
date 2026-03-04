export type PlanStatus =
  | "inactive"
  | "drafting"
  | "awaiting_approval"
  | "approved"
  | "executing"
  | "rejected";

export interface PlanState {
  status: PlanStatus;
  planFilePath?: string;
  planContent?: string;
  restrictedTools: string[];
}

const WRITE_TOOLS = [
  "file_write",
  "file_edit",
  "bash",
  "notebook_edit",
  "task_create",
  "task_update",
  "agent_spawn",
];

const READ_ONLY_TOOLS = [
  "file_read",
  "glob",
  "grep",
  "web_fetch",
  "web_search",
  "task_list",
  "task_get",
];

export function createPlanState(): PlanState {
  return {
    status: "inactive",
    restrictedTools: [],
  };
}

export function enterPlanMode(state: PlanState): PlanState {
  return {
    ...state,
    status: "drafting",
    restrictedTools: WRITE_TOOLS,
    planContent: undefined,
    planFilePath: undefined,
  };
}

export function submitPlan(state: PlanState, content: string): PlanState {
  if (state.status !== "drafting") {
    throw new Error(`Cannot submit plan in ${state.status} state`);
  }
  return {
    ...state,
    status: "awaiting_approval",
    planContent: content,
  };
}

export function approvePlan(state: PlanState): PlanState {
  if (state.status !== "awaiting_approval") {
    throw new Error(`Cannot approve plan in ${state.status} state`);
  }
  return {
    ...state,
    status: "approved",
    restrictedTools: [],
  };
}

export function rejectPlan(state: PlanState): PlanState {
  if (state.status !== "awaiting_approval") {
    throw new Error(`Cannot reject plan in ${state.status} state`);
  }
  return {
    ...state,
    status: "rejected",
    restrictedTools: WRITE_TOOLS,
  };
}

export function exitPlanMode(state: PlanState): PlanState {
  return {
    ...state,
    status: "inactive",
    restrictedTools: [],
    planContent: undefined,
    planFilePath: undefined,
  };
}

export function isToolAllowedInPlan(state: PlanState, toolName: string): boolean {
  if (state.status === "inactive" || state.status === "approved" || state.status === "executing") {
    return true;
  }
  return !state.restrictedTools.includes(toolName);
}

export function getAvailableToolsInPlan(): string[] {
  return READ_ONLY_TOOLS;
}
