import { describe, it, expect, beforeEach } from "vitest";

// ── 8.3 Todo System ──────────────────────────────────────────────────────

import { TodoManager } from "../../src/todos/todo-manager.js";
import { isValidTransition } from "../../src/todos/todo-model.js";

describe("Phase 8.3 — Todo System", () => {
  let manager: TodoManager;

  beforeEach(() => {
    manager = new TodoManager();
  });

  describe("TodoManager.create", () => {
    it("creates a todo with generated ID and pending status", () => {
      const todo = manager.create({
        subject: "Add logging",
        description: "Add structured logging to all API endpoints",
      });
      expect(todo.id).toBeDefined();
      expect(todo.id.length).toBe(8);
      expect(todo.subject).toBe("Add logging");
      expect(todo.description).toBe("Add structured logging to all API endpoints");
      expect(todo.status).toBe("pending");
      expect(todo.blockedBy).toEqual([]);
      expect(todo.blocks).toEqual([]);
      expect(todo.createdAt).toBeDefined();
      expect(todo.updatedAt).toBeDefined();
    });

    it("creates a todo with blockedBy dependencies", () => {
      const t1 = manager.create({ subject: "Setup", description: "Setup project" });
      const t2 = manager.create({
        subject: "Build",
        description: "Build features",
        blockedBy: [t1.id],
      });
      expect(t2.blockedBy).toEqual([t1.id]);
    });
  });

  describe("TodoManager.update", () => {
    it("transitions from pending to in_progress", () => {
      const todo = manager.create({ subject: "Task", description: "A task" });
      const updated = manager.update(todo.id, { status: "in_progress" });
      expect(updated.status).toBe("in_progress");
    });

    it("transitions from in_progress to completed", () => {
      const todo = manager.create({ subject: "Task", description: "A task" });
      manager.update(todo.id, { status: "in_progress" });
      const updated = manager.update(todo.id, { status: "completed" });
      expect(updated.status).toBe("completed");
    });

    it("rejects invalid transition (pending → completed is allowed)", () => {
      const todo = manager.create({ subject: "Task", description: "A task" });
      const updated = manager.update(todo.id, { status: "completed" });
      expect(updated.status).toBe("completed");
    });

    it("rejects completed → in_progress transition", () => {
      const todo = manager.create({ subject: "Task", description: "A task" });
      manager.update(todo.id, { status: "completed" });
      expect(() => manager.update(todo.id, { status: "in_progress" })).toThrow(
        "Invalid status transition",
      );
    });

    it("blocks starting task if dependencies are not completed", () => {
      const t1 = manager.create({ subject: "Dep", description: "Dependency" });
      const t2 = manager.create({
        subject: "Task",
        description: "Blocked task",
        blockedBy: [t1.id],
      });
      expect(() => manager.update(t2.id, { status: "in_progress" })).toThrow(
        "blocked by",
      );
    });

    it("allows starting task when dependencies are completed", () => {
      const t1 = manager.create({ subject: "Dep", description: "Dependency" });
      const t2 = manager.create({
        subject: "Task",
        description: "Blocked task",
        blockedBy: [t1.id],
      });
      manager.update(t1.id, { status: "completed" });
      const updated = manager.update(t2.id, { status: "in_progress" });
      expect(updated.status).toBe("in_progress");
    });

    it("throws on non-existent todo", () => {
      expect(() => manager.update("nope", { status: "completed" })).toThrow(
        "Todo not found",
      );
    });

    it("updates subject and description", () => {
      const todo = manager.create({ subject: "Old", description: "Old desc" });
      const updated = manager.update(todo.id, {
        subject: "New",
        description: "New desc",
      });
      expect(updated.subject).toBe("New");
      expect(updated.description).toBe("New desc");
    });

    it("updates activeForm", () => {
      const todo = manager.create({ subject: "Task", description: "A task" });
      manager.update(todo.id, { status: "in_progress" });
      const updated = manager.update(todo.id, { activeForm: "Running tests" });
      expect(updated.activeForm).toBe("Running tests");
    });
  });

  describe("TodoManager.delete", () => {
    it("deletes existing todo", () => {
      const todo = manager.create({ subject: "Task", description: "A task" });
      expect(manager.delete(todo.id)).toBe(true);
      expect(manager.get(todo.id)).toBeUndefined();
    });

    it("returns false for non-existent todo", () => {
      expect(manager.delete("nope")).toBe(false);
    });
  });

  describe("TodoManager.list and summary", () => {
    it("lists all todos", () => {
      manager.create({ subject: "A", description: "A" });
      manager.create({ subject: "B", description: "B" });
      expect(manager.list()).toHaveLength(2);
    });

    it("returns 'No tasks.' for empty list", () => {
      expect(manager.summary()).toBe("No tasks.");
    });

    it("generates a summary with counts", () => {
      const t1 = manager.create({ subject: "A", description: "A" });
      const t2 = manager.create({ subject: "B", description: "B" });
      manager.update(t1.id, { status: "in_progress" });
      manager.update(t2.id, { status: "completed" });

      const summary = manager.summary();
      expect(summary).toContain("2 total");
      expect(summary).toContain("1 completed");
      expect(summary).toContain("1 in progress");
    });
  });

  describe("TodoManager.toJSON and fromJSON", () => {
    it("serializes and deserializes", () => {
      manager.create({ subject: "A", description: "A" });
      manager.create({ subject: "B", description: "B" });
      const json = manager.toJSON();
      expect(json).toHaveLength(2);

      const newManager = new TodoManager();
      newManager.fromJSON(json);
      expect(newManager.list()).toHaveLength(2);
      expect(newManager.list()[0]!.subject).toBe("A");
    });
  });

  describe("isValidTransition", () => {
    it("pending → in_progress is valid", () => {
      expect(isValidTransition("pending", "in_progress")).toBe(true);
    });
    it("pending → completed is valid", () => {
      expect(isValidTransition("pending", "completed")).toBe(true);
    });
    it("in_progress → completed is valid", () => {
      expect(isValidTransition("in_progress", "completed")).toBe(true);
    });
    it("in_progress → pending is valid (back to pending)", () => {
      expect(isValidTransition("in_progress", "pending")).toBe(true);
    });
    it("completed → pending is invalid", () => {
      expect(isValidTransition("completed", "pending")).toBe(false);
    });
    it("completed → in_progress is invalid", () => {
      expect(isValidTransition("completed", "in_progress")).toBe(false);
    });
  });
});

// ── 8.2 Plan Mode ────────────────────────────────────────────────────────

import {
  createPlanState,
  enterPlanMode,
  submitPlan,
  approvePlan,
  rejectPlan,
  exitPlanMode,
  isToolAllowedInPlan,
  getAvailableToolsInPlan,
} from "../../src/plan/plan-state.js";

describe("Phase 8.2 — Plan Mode", () => {
  describe("PlanState machine", () => {
    it("starts as inactive", () => {
      const state = createPlanState();
      expect(state.status).toBe("inactive");
      expect(state.restrictedTools).toEqual([]);
    });

    it("enters drafting mode", () => {
      let state = createPlanState();
      state = enterPlanMode(state);
      expect(state.status).toBe("drafting");
      expect(state.restrictedTools.length).toBeGreaterThan(0);
      expect(state.restrictedTools).toContain("file_write");
      expect(state.restrictedTools).toContain("bash");
    });

    it("submits plan for approval", () => {
      let state = createPlanState();
      state = enterPlanMode(state);
      state = submitPlan(state, "My detailed plan");
      expect(state.status).toBe("awaiting_approval");
      expect(state.planContent).toBe("My detailed plan");
    });

    it("rejects submit when not in drafting", () => {
      const state = createPlanState();
      expect(() => submitPlan(state, "plan")).toThrow("Cannot submit plan in inactive state");
    });

    it("approves plan — clears restrictions", () => {
      let state = createPlanState();
      state = enterPlanMode(state);
      state = submitPlan(state, "plan");
      state = approvePlan(state);
      expect(state.status).toBe("approved");
      expect(state.restrictedTools).toEqual([]);
    });

    it("rejects plan — keeps restrictions", () => {
      let state = createPlanState();
      state = enterPlanMode(state);
      state = submitPlan(state, "plan");
      state = rejectPlan(state);
      expect(state.status).toBe("rejected");
      expect(state.restrictedTools.length).toBeGreaterThan(0);
    });

    it("exits plan mode — clears everything", () => {
      let state = createPlanState();
      state = enterPlanMode(state);
      state = exitPlanMode(state);
      expect(state.status).toBe("inactive");
      expect(state.restrictedTools).toEqual([]);
      expect(state.planContent).toBeUndefined();
    });

    it("reject when not awaiting_approval throws", () => {
      const state = createPlanState();
      expect(() => rejectPlan(state)).toThrow();
    });

    it("approve when not awaiting_approval throws", () => {
      const state = createPlanState();
      expect(() => approvePlan(state)).toThrow();
    });
  });

  describe("isToolAllowedInPlan", () => {
    it("allows all tools when inactive", () => {
      const state = createPlanState();
      expect(isToolAllowedInPlan(state, "file_write")).toBe(true);
      expect(isToolAllowedInPlan(state, "bash")).toBe(true);
    });

    it("blocks write tools when drafting", () => {
      let state = createPlanState();
      state = enterPlanMode(state);
      expect(isToolAllowedInPlan(state, "file_write")).toBe(false);
      expect(isToolAllowedInPlan(state, "file_edit")).toBe(false);
      expect(isToolAllowedInPlan(state, "bash")).toBe(false);
    });

    it("allows read tools when drafting", () => {
      let state = createPlanState();
      state = enterPlanMode(state);
      expect(isToolAllowedInPlan(state, "file_read")).toBe(true);
      expect(isToolAllowedInPlan(state, "glob")).toBe(true);
      expect(isToolAllowedInPlan(state, "grep")).toBe(true);
    });

    it("allows all tools when approved", () => {
      let state = createPlanState();
      state = enterPlanMode(state);
      state = submitPlan(state, "plan");
      state = approvePlan(state);
      expect(isToolAllowedInPlan(state, "file_write")).toBe(true);
      expect(isToolAllowedInPlan(state, "bash")).toBe(true);
    });
  });

  describe("getAvailableToolsInPlan", () => {
    it("returns read-only tool names", () => {
      const tools = getAvailableToolsInPlan();
      expect(tools).toContain("file_read");
      expect(tools).toContain("glob");
      expect(tools).toContain("grep");
      expect(tools).toContain("web_fetch");
      expect(tools).toContain("web_search");
      expect(tools).not.toContain("file_write");
      expect(tools).not.toContain("bash");
    });
  });
});

// ── 8.1 Subagent System ──────────────────────────────────────────────────

import { SubagentTaskRegistry } from "../../src/tools/agent-spawn.js";

describe("Phase 8.1 — Subagent System", () => {
  describe("SubagentTaskRegistry", () => {
    let registry: SubagentTaskRegistry;

    beforeEach(() => {
      registry = new SubagentTaskRegistry();
    });

    it("registers and retrieves tasks", () => {
      registry.register({
        id: "abc",
        subagentType: "explore",
        description: "test task",
        status: "running",
        startedAt: new Date().toISOString(),
      });
      const task = registry.get("abc");
      expect(task).toBeDefined();
      expect(task!.status).toBe("running");
    });

    it("completes a task", () => {
      registry.register({
        id: "t1",
        subagentType: "general",
        description: "test",
        status: "running",
        startedAt: new Date().toISOString(),
      });
      registry.complete("t1", "done!");
      const task = registry.get("t1");
      expect(task!.status).toBe("completed");
      expect(task!.result).toBe("done!");
      expect(task!.completedAt).toBeDefined();
    });

    it("fails a task", () => {
      registry.register({
        id: "t2",
        subagentType: "plan",
        description: "test",
        status: "running",
        startedAt: new Date().toISOString(),
      });
      registry.fail("t2", "something went wrong");
      const task = registry.get("t2");
      expect(task!.status).toBe("error");
      expect(task!.error).toBe("something went wrong");
    });

    it("lists all tasks", () => {
      registry.register({
        id: "a",
        subagentType: "explore",
        description: "a",
        status: "running",
        startedAt: new Date().toISOString(),
      });
      registry.register({
        id: "b",
        subagentType: "general",
        description: "b",
        status: "running",
        startedAt: new Date().toISOString(),
      });
      expect(registry.list()).toHaveLength(2);
    });

    it("returns undefined for unknown task", () => {
      expect(registry.get("unknown")).toBeUndefined();
    });
  });
});

// ── 8.4 Skills System ────────────────────────────────────────────────────

import { createSkillRegistry, listSkillNames } from "../../src/skills/index.js";

describe("Phase 8.4 — Skills System", () => {
  describe("createSkillRegistry", () => {
    it("creates a registry and loads built-in skills", () => {
      const registry = createSkillRegistry();
      const names = listSkillNames(registry);
      expect(names).toContain("commit");
      expect(names).toContain("pr");
      expect(names).toContain("review-pr");
      expect(names).toContain("simplify");
    });

    it("returns Skill objects with instructions", () => {
      const registry = createSkillRegistry();
      const commit = registry.get("commit");
      expect(commit).toBeDefined();
      expect(commit!.instructions).toContain("/commit");
      expect(commit!.description).toBeDefined();
    });

    it("lists active skills by default", () => {
      const registry = createSkillRegistry();
      const active = registry.getActiveSkills();
      expect(active.length).toBeGreaterThanOrEqual(4);
    });

    it("can deactivate and reactivate skills", () => {
      const registry = createSkillRegistry();
      registry.deactivate("commit");
      expect(registry.isActive("commit")).toBe(false);
      registry.activate("commit");
      expect(registry.isActive("commit")).toBe(true);
    });
  });
});

// ── 8.5 Vision/Image Support ─────────────────────────────────────────────

import {
  isSupportedImagePath,
  detectImagePathsInText,
  isVisionCapableModel,
} from "../../src/tools/vision.js";

describe("Phase 8.5 — Vision/Image Support", () => {
  describe("isSupportedImagePath", () => {
    it("accepts PNG files", () => {
      expect(isSupportedImagePath("photo.png")).toBe(true);
    });
    it("accepts JPEG files", () => {
      expect(isSupportedImagePath("photo.jpg")).toBe(true);
      expect(isSupportedImagePath("photo.jpeg")).toBe(true);
    });
    it("accepts GIF files", () => {
      expect(isSupportedImagePath("anim.gif")).toBe(true);
    });
    it("accepts WebP files", () => {
      expect(isSupportedImagePath("image.webp")).toBe(true);
    });
    it("rejects non-image files", () => {
      expect(isSupportedImagePath("file.ts")).toBe(false);
      expect(isSupportedImagePath("file.txt")).toBe(false);
      expect(isSupportedImagePath("file.pdf")).toBe(false);
    });
    it("case insensitive", () => {
      expect(isSupportedImagePath("PHOTO.PNG")).toBe(true);
      expect(isSupportedImagePath("photo.JPG")).toBe(true);
    });
  });

  describe("detectImagePathsInText", () => {
    it("detects image paths in text", () => {
      const paths = detectImagePathsInText("Look at screenshot.png and diagram.jpg");
      expect(paths).toEqual(["screenshot.png", "diagram.jpg"]);
    });
    it("returns empty array for no images", () => {
      expect(detectImagePathsInText("just some text")).toEqual([]);
    });
    it("handles paths with directories", () => {
      const paths = detectImagePathsInText("Check ./images/test.png");
      expect(paths).toEqual(["./images/test.png"]);
    });
  });

  describe("isVisionCapableModel", () => {
    it("detects Claude as vision-capable", () => {
      expect(isVisionCapableModel("anthropic:claude-sonnet-4-6")).toBe(true);
    });
    it("detects GPT-4o as vision-capable", () => {
      expect(isVisionCapableModel("openai:gpt-4o")).toBe(true);
    });
    it("detects Gemini as vision-capable", () => {
      expect(isVisionCapableModel("google:gemini-2.0-flash")).toBe(true);
    });
    it("rejects non-vision models", () => {
      expect(isVisionCapableModel("groq:llama-3.1-70b")).toBe(false);
    });
  });
});

// ── Slash Commands (Phase 8 additions) ───────────────────────────────────

import {
  handleSlashCommand,
  type SlashCommandContext,
} from "../../src/cli/commands/slash-commands.js";
import type { PlanStateRef } from "../../src/plan/plan-tools.js";

describe("Phase 8 — Slash Commands", () => {
  function makeCtx(overrides?: Partial<SlashCommandContext>): SlashCommandContext {
    return {
      todoManager: new TodoManager(),
      planStateRef: { current: createPlanState() },
      ...overrides,
    };
  }

  describe("/tasks", () => {
    it("shows 'No tasks.' when empty", async () => {
      const result = await handleSlashCommand("/tasks", makeCtx());
      expect(result.handled).toBe(true);
      expect(result.output).toBe("No tasks.");
    });

    it("shows task summary", async () => {
      const ctx = makeCtx();
      ctx.todoManager!.create({ subject: "Test task", description: "desc" });
      const result = await handleSlashCommand("/tasks", ctx);
      expect(result.output).toContain("Test task");
      expect(result.output).toContain("1 total");
    });
  });

  describe("/task <id>", () => {
    it("shows task details", async () => {
      const ctx = makeCtx();
      const todo = ctx.todoManager!.create({ subject: "Test", description: "desc" });
      const result = await handleSlashCommand(`/task ${todo.id}`, ctx);
      expect(result.handled).toBe(true);
      expect(result.output).toContain("Test");
    });

    it("errors on missing id", async () => {
      const result = await handleSlashCommand("/task", makeCtx());
      expect(result.error).toContain("Usage");
    });

    it("errors on unknown id", async () => {
      const result = await handleSlashCommand("/task unknown", makeCtx());
      expect(result.error).toContain("not found");
    });
  });

  describe("/plan", () => {
    it("shows inactive status", async () => {
      const result = await handleSlashCommand("/plan", makeCtx());
      expect(result.output).toContain("inactive");
    });

    it("approves awaiting plan", async () => {
      const ctx = makeCtx();
      let state = enterPlanMode(ctx.planStateRef!.current);
      state = submitPlan(state, "my plan");
      ctx.planStateRef!.current = state;

      const result = await handleSlashCommand("/plan approve", ctx);
      expect(result.output).toContain("approved");
      expect(ctx.planStateRef!.current.status).toBe("approved");
    });

    it("rejects awaiting plan", async () => {
      const ctx = makeCtx();
      let state = enterPlanMode(ctx.planStateRef!.current);
      state = submitPlan(state, "my plan");
      ctx.planStateRef!.current = state;

      const result = await handleSlashCommand("/plan reject", ctx);
      expect(result.output).toContain("rejected");
      expect(ctx.planStateRef!.current.status).toBe("rejected");
    });

    it("errors on approve when not awaiting", async () => {
      const result = await handleSlashCommand("/plan approve", makeCtx());
      expect(result.error).toContain("Cannot approve");
    });

    it("cancels plan mode", async () => {
      const ctx = makeCtx();
      ctx.planStateRef!.current = enterPlanMode(ctx.planStateRef!.current);
      const result = await handleSlashCommand("/plan cancel", ctx);
      expect(result.output).toContain("cancelled");
      expect(ctx.planStateRef!.current.status).toBe("inactive");
    });
  });

  describe("/help includes phase 8 commands", () => {
    it("lists tasks and plan commands", async () => {
      const result = await handleSlashCommand("/help", makeCtx());
      expect(result.output).toContain("/tasks");
      expect(result.output).toContain("/task");
      expect(result.output).toContain("/plan");
    });
  });
});

// ── Todo Tools (registered as SDK tools) ──────────────────────────────────

import { createTodoTools } from "../../src/todos/todo-tools.js";

describe("Phase 8.3 — Todo Tools", () => {
  let manager: TodoManager;
  let tools: ReturnType<typeof createTodoTools>;

  beforeEach(() => {
    manager = new TodoManager();
    tools = createTodoTools(manager);
  });

  it("creates 4 tools", () => {
    expect(tools).toHaveLength(4);
    const names = tools.map((t) => t.name);
    expect(names).toContain("task_create");
    expect(names).toContain("task_update");
    expect(names).toContain("task_list");
    expect(names).toContain("task_get");
  });

  it("task_create creates a todo via tool execution", async () => {
    const createTool = tools.find((t) => t.name === "task_create")!;
    const result = await createTool.execute({
      subject: "Write tests",
      description: "Write unit tests for Phase 8",
    });
    expect(result).toContain("Write tests");
    expect(result).toContain("pending");
    expect(manager.list()).toHaveLength(1);
  });

  it("task_update changes status", async () => {
    const todo = manager.create({ subject: "Task", description: "desc" });
    const updateTool = tools.find((t) => t.name === "task_update")!;
    const result = await updateTool.execute({
      id: todo.id,
      status: "in_progress",
    });
    expect(result).toContain("in_progress");
  });

  it("task_list returns summary", async () => {
    manager.create({ subject: "A", description: "a" });
    const listTool = tools.find((t) => t.name === "task_list")!;
    const result = await listTool.execute({});
    expect(result).toContain("1 total");
  });

  it("task_get returns details", async () => {
    const todo = manager.create({ subject: "Detail", description: "check me" });
    const getTool = tools.find((t) => t.name === "task_get")!;
    const result = await getTool.execute({ id: todo.id });
    expect(result).toContain("Detail");
    expect(result).toContain("check me");
  });

  it("task_get returns error for unknown ID", async () => {
    const getTool = tools.find((t) => t.name === "task_get")!;
    const result = await getTool.execute({ id: "unknown" });
    expect(result).toContain("not found");
  });

  it("task_update returns error for invalid transition", async () => {
    const todo = manager.create({ subject: "Task", description: "desc" });
    manager.update(todo.id, { status: "completed" });
    const updateTool = tools.find((t) => t.name === "task_update")!;
    const result = await updateTool.execute({
      id: todo.id,
      status: "in_progress",
    });
    expect(result).toContain("Error");
  });
});

// ── Plan Tools (registered as SDK tools) ──────────────────────────────────

import { createPlanTools } from "../../src/plan/plan-tools.js";

describe("Phase 8.2 — Plan Tools", () => {
  let stateRef: PlanStateRef;
  let tools: ReturnType<typeof createPlanTools>;

  beforeEach(() => {
    stateRef = { current: createPlanState() };
    tools = createPlanTools(stateRef);
  });

  it("creates 3 plan tools", () => {
    expect(tools).toHaveLength(3);
    const names = tools.map((t) => t.name);
    expect(names).toContain("enter_plan_mode");
    expect(names).toContain("exit_plan_mode");
    expect(names).toContain("cancel_plan_mode");
  });

  it("enter_plan_mode transitions to drafting", async () => {
    const enterTool = tools.find((t) => t.name === "enter_plan_mode")!;
    const result = await enterTool.execute({ reason: "complex refactoring" });
    expect(result).toContain("Entered plan mode");
    expect(stateRef.current.status).toBe("drafting");
  });

  it("enter_plan_mode rejects when already in plan mode", async () => {
    const enterTool = tools.find((t) => t.name === "enter_plan_mode")!;
    await enterTool.execute({});
    const result = await enterTool.execute({});
    expect(result).toContain("Already in plan mode");
  });

  it("exit_plan_mode submits plan", async () => {
    const enterTool = tools.find((t) => t.name === "enter_plan_mode")!;
    const exitTool = tools.find((t) => t.name === "exit_plan_mode")!;
    await enterTool.execute({});
    const result = await exitTool.execute({ plan: "Step 1: do X\nStep 2: do Y" });
    expect(result).toContain("Plan submitted");
    expect(stateRef.current.status).toBe("awaiting_approval");
  });

  it("exit_plan_mode rejects when not drafting", async () => {
    const exitTool = tools.find((t) => t.name === "exit_plan_mode")!;
    const result = await exitTool.execute({ plan: "test" });
    expect(result).toContain("Not in drafting mode");
  });

  it("cancel_plan_mode returns to inactive", async () => {
    const enterTool = tools.find((t) => t.name === "enter_plan_mode")!;
    const cancelTool = tools.find((t) => t.name === "cancel_plan_mode")!;
    await enterTool.execute({});
    const result = await cancelTool.execute({});
    expect(result).toContain("cancelled");
    expect(stateRef.current.status).toBe("inactive");
  });
});
