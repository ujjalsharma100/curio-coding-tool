import { createTool } from "curio-agent-sdk";
import { z } from "zod";
import type { PlanState } from "./plan-state.js";
import {
  enterPlanMode,
  submitPlan,
  exitPlanMode,
  getAvailableToolsInPlan,
} from "./plan-state.js";

export interface PlanStateRef {
  current: PlanState;
}

export function createPlanTools(stateRef: PlanStateRef) {
  const enterPlan = createTool({
    name: "enter_plan_mode",
    description:
      "Switch to plan mode for read-only exploration before implementation. " +
      "In plan mode only read tools are available (Read, Glob, Grep, Web Fetch, Web Search). " +
      "Use this for complex tasks that need architectural planning before coding.",
    parameters: z.object({
      reason: z
        .string()
        .optional()
        .describe("Why entering plan mode (e.g. 'complex refactoring')"),
    }),
    execute: async (args) => {
      if (stateRef.current.status !== "inactive") {
        return `Already in plan mode (status: ${stateRef.current.status}). Use exit_plan_mode to leave.`;
      }
      stateRef.current = enterPlanMode(stateRef.current);
      const tools = getAvailableToolsInPlan().join(", ");
      return [
        "Entered plan mode.",
        args.reason ? `Reason: ${args.reason}` : "",
        `Available tools: ${tools}`,
        "Write tools are disabled. Use exit_plan_mode with your plan when ready.",
      ]
        .filter(Boolean)
        .join("\n");
    },
  });

  const exitPlan = createTool({
    name: "exit_plan_mode",
    description:
      "Exit plan mode and submit a plan for user approval. " +
      "The plan will be shown to the user who can approve, reject, or request edits.",
    parameters: z.object({
      plan: z.string().describe("The implementation plan to submit for approval"),
    }),
    execute: async (args) => {
      if (stateRef.current.status !== "drafting") {
        return `Not in drafting mode (status: ${stateRef.current.status}). Cannot submit plan.`;
      }
      stateRef.current = submitPlan(stateRef.current, args.plan);
      return [
        "Plan submitted for user approval.",
        "",
        "--- Plan ---",
        args.plan,
        "--- End Plan ---",
        "",
        "Waiting for user approval. The user can approve, reject, or request changes.",
      ].join("\n");
    },
  });

  const leavePlan = createTool({
    name: "cancel_plan_mode",
    description: "Cancel plan mode and return to normal execution without submitting a plan.",
    parameters: z.object({}),
    execute: async () => {
      stateRef.current = exitPlanMode(stateRef.current);
      return "Plan mode cancelled. Returned to normal execution with full tool access.";
    },
  });

  return [enterPlan, exitPlan, leavePlan];
}
