import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AudioCode } from "./AudioCode.js";
import { Cassi } from "../../cassi/Cassi.js";
import { EvaluateAudioCodePrompt } from "../../model/models/EvaluateAudioCodePrompt.js";
import { Coder } from "./Coder.js";
import { Tester } from "./Tester.js";
import { RequirePassingTests } from "./RequirePassingTests.js";
import { GitCommitMerge } from "./GitCommitMerge.js";
import { Task } from "../Task.js";

vi.mock("../../cassi/Cassi.js");
vi.mock("../../model/models/EvaluateAudioCodePrompt.js");
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

describe("AudioCode Task", () => {
  let cassi: Cassi;
  let parentTask: Task | null;
  let audioCodeTask: AudioCode;
  let mockEvaluateModel: EvaluateAudioCodePrompt;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  const testAudioBase64 =
    "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

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
    audioCodeTask = new AudioCode(cassi, parentTask, testAudioBase64);

    mockEvaluateModel = new (vi.mocked(EvaluateAudioCodePrompt))(
      {} as any,
      audioCodeTask
    );
    vi.spyOn(audioCodeTask, "newModel").mockReturnValue(mockEvaluateModel);

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
    const initFileTaskSpy = vi.spyOn(audioCodeTask as any, "initFileTask");

    await audioCodeTask.initTask();

    expect(audioCodeTask.newModel).toHaveBeenCalledWith(
      "EvaluateAudioCodePrompt"
    );
    expect(mockEvaluateModel.generate).toHaveBeenCalledWith(
      expect.objectContaining({ audioBase64: testAudioBase64 })
    );
    expect(audioCodeTask.evaluation).toEqual(mockEvaluation);
    expect(initFileTaskSpy).toHaveBeenCalled();
    expect(audioCodeTask.setTaskId).toHaveBeenCalledWith("test summary");
    expect(audioCodeTask.initWorktree).toHaveBeenCalled();
    expect(audioCodeTask.addSubtask).toHaveBeenCalledTimes(4);
    expect(audioCodeTask.addSubtask).toHaveBeenCalledWith(expect.any(Coder));
    expect(audioCodeTask.addSubtask).toHaveBeenCalledWith(expect.any(Tester));
    expect(audioCodeTask.addSubtask).toHaveBeenCalledWith(
      expect.any(RequirePassingTests)
    );
    expect(audioCodeTask.addSubtask).toHaveBeenCalledWith(
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
    const initFileTaskSpy = vi.spyOn(audioCodeTask as any, "initFileTask");

    await audioCodeTask.initTask();

    expect(audioCodeTask.newModel).toHaveBeenCalledWith(
      "EvaluateAudioCodePrompt"
    );
    expect(mockEvaluateModel.generate).toHaveBeenCalledWith(
      expect.objectContaining({ audioBase64: testAudioBase64 })
    );
    expect(audioCodeTask.evaluation).toEqual(mockEvaluation);
    expect(initFileTaskSpy).not.toHaveBeenCalled();
    expect(audioCodeTask.addSubtask).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "Model response indicates no file modifications. Only file modification tasks are currently supported."
    );
  });

  describe("cleanupTask", () => {
    it("should call cassi.repository.remWorktree with taskId if taskId exists", async () => {
      audioCodeTask.taskId = "test-task-id";
      await audioCodeTask.cleanupTask();
      expect(cassi.repository.remWorktree).toHaveBeenCalledWith("test-task-id");
    });

    it("should not call cassi.repository.remWorktree if taskId is null", async () => {
      audioCodeTask.taskId = null;
      await audioCodeTask.cleanupTask();
      expect(cassi.repository.remWorktree).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[AudioCode Task] No taskId found for cleanup, skipping worktree removal."
      );
    });

    it("should propagate errors from cassi.repository.remWorktree", async () => {
      audioCodeTask.taskId = "test-task-id-error";
      const remWorktreeError = new Error("Failed to remove worktree");
      vi.spyOn(cassi.repository, "remWorktree").mockRejectedValue(
        remWorktreeError
      );

      await expect(audioCodeTask.cleanupTask()).rejects.toThrow(
        remWorktreeError
      );
      expect(cassi.repository.remWorktree).toHaveBeenCalledWith(
        "test-task-id-error"
      );
    });
  });
});
