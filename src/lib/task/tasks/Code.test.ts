import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Code } from "./Code.js";
import { Cassi } from "../../cassi/Cassi.js";
import { EvaluateCodePrompt } from "../../model/models/EvaluateCodePrompt.js";
import { Coder } from "./Coder.js";
import { Tester } from "./Tester.js";
import { Task } from "../Task.js";

vi.mock("../../cassi/Cassi.js");
vi.mock("../../model/models/EvaluateCodePrompt.js");
vi.mock("./Coder.js");
vi.mock("./Tester.js");
vi.mock("../Task.js", async () => {
  const actual = await vi.importActual("../Task.js");
  // Cast actual.Task to any to help TypeScript resolve the constructor type
  const BaseTask = actual.Task as any;
  return {
    ...actual,
    Task: class MockTask extends BaseTask {
      // Extend the casted type
      taskId: string | null = null; // Add taskId property
      addSubtask = vi.fn();
      initWorktree = vi.fn().mockResolvedValue(undefined);
      // Mock setTaskId to actually set the taskId property
      setTaskId = vi.fn((id: string) => {
        this.taskId = id;
      });
      newModel = vi.fn();
      worktree = { delete: vi.fn().mockResolvedValue(undefined) };
    },
  };
});

describe("Code Task", () => {
  let cassi: Cassi;
  let parentTask: Task | null;
  let codeTask: Code;
  let mockEvaluateModel: EvaluateCodePrompt;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>; // Added console.warn spy

  beforeEach(() => {
    // Mock Cassi constructor properly if needed, assuming default mock is sufficient for now
    cassi = new (vi.mocked(Cassi))(
      undefined as any,
      undefined as any,
      undefined as any
    ); // Adjust if Cassi constructor needs specific args
    parentTask = null;
    codeTask = new Code(cassi, parentTask, "test prompt");

    // Instantiate the mocked EvaluateCodePrompt correctly
    mockEvaluateModel = new (vi.mocked(EvaluateCodePrompt))(
      {} as any,
      codeTask
    );
    vi.spyOn(codeTask, "newModel").mockReturnValue(mockEvaluateModel);

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {}); // Mock console.warn
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should initialize and add Coder and Tester subtasks when modifiesFiles is true", async () => {
    const mockEvaluation = {
      summary: "test summary",
      modifiesFiles: true,
      steps: ["step 1", "step 2"],
    };
    vi.spyOn(mockEvaluateModel, "generate").mockResolvedValue(
      JSON.stringify(mockEvaluation)
    );
    const initFileTaskSpy = vi.spyOn(codeTask as any, "initFileTask");

    await codeTask.initTask();

    expect(codeTask.newModel).toHaveBeenCalledWith("EvaluateCodePrompt");
    expect(mockEvaluateModel.generate).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "test prompt" })
    );
    expect(codeTask.evaluation).toEqual(mockEvaluation);
    expect(initFileTaskSpy).toHaveBeenCalled();
    expect(codeTask.setTaskId).toHaveBeenCalledWith("test summary");
    expect(codeTask.initWorktree).toHaveBeenCalled();
    expect(codeTask.addSubtask).toHaveBeenCalledTimes(2);
    expect(codeTask.addSubtask).toHaveBeenCalledWith(expect.any(Coder));
    expect(codeTask.addSubtask).toHaveBeenCalledWith(expect.any(Tester));
  });

  it("should not add subtasks when modifiesFiles is false", async () => {
    const mockEvaluation = {
      summary: "no file changes",
      modifiesFiles: false,
      steps: [],
    };
    vi.spyOn(mockEvaluateModel, "generate").mockResolvedValue(
      JSON.stringify(mockEvaluation)
    );
    const initFileTaskSpy = vi.spyOn(codeTask as any, "initFileTask");

    await codeTask.initTask();

    expect(codeTask.newModel).toHaveBeenCalledWith("EvaluateCodePrompt");
    expect(mockEvaluateModel.generate).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "test prompt" })
    );
    expect(codeTask.evaluation).toEqual(mockEvaluation);
    expect(initFileTaskSpy).not.toHaveBeenCalled();
    expect(codeTask.addSubtask).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "Model response indicates no file modifications. Only file modification tasks are currently supported."
    );
  });

  it("should call worktree delete during cleanup if worktree exists", async () => {
    await codeTask.cleanupTask();
    expect(codeTask.worktree?.delete).toHaveBeenCalled();
  });

  it("should not throw error during cleanup if worktree does not exist", async () => {
    codeTask.worktree = undefined;
    await expect(codeTask.cleanupTask()).resolves.not.toThrow();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "[Code Task] No worktree found for cleanup."
    );
  });

  it("should handle errors during worktree deletion in cleanup", async () => {
    const deleteError = new Error("Failed to delete");
    codeTask.worktree!.delete = vi.fn().mockRejectedValue(deleteError);
    await codeTask.cleanupTask();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      // Use the spy
      "[Code Task] Error during worktree cleanup:",
      deleteError
    );
  });
});
