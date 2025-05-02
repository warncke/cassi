import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Code } from "./Code.js";
import { Cassi } from "../../cassi/Cassi.js";
import { EvaluateCodePrompt } from "../../model/models/EvaluateCodePrompt.js";
import { Coder } from "./Coder.js";
import { Tester } from "./Tester.js";
import { RequirePassingTests } from "./RequirePassingTests.js";
import { GitCommitMerge } from "./GitCommitMerge.js";
import { Task } from "../Task.js";

vi.mock("../../cassi/Cassi.js");
vi.mock("../../model/models/EvaluateCodePrompt.js");
vi.mock("./Coder.js");
vi.mock("./Tester.js");
vi.mock("./RequirePassingTests.js");
vi.mock("./GitCommitMerge.js");
vi.mock("../Task.js", async () => {
  const actual = await vi.importActual("../Task.js");
  const BaseTask = actual.Task as any;
  return {
    ...actual,
    Task: class MockTask extends BaseTask {
      taskId: string | null = null;
      addSubtask = vi.fn();
      initWorktree = vi.fn().mockResolvedValue(undefined);
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
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    cassi = new (vi.mocked(Cassi))(
      undefined as any,
      undefined as any,
      undefined as any
    );
    cassi.repository = {
      remWorktree: vi.fn().mockResolvedValue(undefined),
    } as any;
    parentTask = null;
    codeTask = new Code(cassi, parentTask, "test prompt");

    mockEvaluateModel = new (vi.mocked(EvaluateCodePrompt))(
      {} as any,
      codeTask
    );
    vi.spyOn(codeTask, "newModel").mockReturnValue(mockEvaluateModel);

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
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
    expect(codeTask.addSubtask).toHaveBeenCalledTimes(4);
    expect(codeTask.addSubtask).toHaveBeenCalledWith(expect.any(Coder));
    expect(codeTask.addSubtask).toHaveBeenCalledWith(expect.any(Tester));
    expect(codeTask.addSubtask).toHaveBeenCalledWith(
      expect.any(RequirePassingTests)
    );
    expect(codeTask.addSubtask).toHaveBeenCalledWith(
      expect.any(GitCommitMerge)
    );
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

  describe("cleanupTask", () => {
    it("should call cassi.repository.remWorktree with taskId if taskId exists", async () => {
      codeTask.taskId = "test-task-id";
      await codeTask.cleanupTask();
      expect(cassi.repository.remWorktree).toHaveBeenCalledWith("test-task-id");
    });

    it("should not call cassi.repository.remWorktree if taskId is null", async () => {
      codeTask.taskId = null;
      await codeTask.cleanupTask();
      expect(cassi.repository.remWorktree).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Code Task] No taskId found for cleanup, skipping worktree removal."
      );
    });

    it("should propagate errors from cassi.repository.remWorktree", async () => {
      codeTask.taskId = "test-task-id-error";
      const remWorktreeError = new Error("Failed to remove worktree");
      vi.spyOn(cassi.repository, "remWorktree").mockRejectedValue(
        remWorktreeError
      );

      await expect(codeTask.cleanupTask()).rejects.toThrow(remWorktreeError);
      expect(cassi.repository.remWorktree).toHaveBeenCalledWith(
        "test-task-id-error"
      );
    });
  });
});
