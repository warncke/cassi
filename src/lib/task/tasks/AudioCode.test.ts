import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AudioCode } from "./AudioCode.js"; // Changed import
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
  // Changed describe block title
  let cassi: Cassi;
  let parentTask: Task | null;
  let audioCodeTask: AudioCode; // Changed variable name
  let mockEvaluateModel: EvaluateAudioCodePrompt;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  // Use a dummy base64 string for testing
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
    audioCodeTask = new AudioCode(cassi, parentTask, testAudioBase64); // Changed instantiation

    mockEvaluateModel = new (vi.mocked(EvaluateAudioCodePrompt))(
      {} as any,
      audioCodeTask // Changed task reference
    );
    vi.spyOn(audioCodeTask, "newModel").mockReturnValue(mockEvaluateModel); // Changed task reference

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
    const initFileTaskSpy = vi.spyOn(audioCodeTask as any, "initFileTask"); // Changed task reference

    await audioCodeTask.initTask(); // Changed task reference

    expect(audioCodeTask.newModel).toHaveBeenCalledWith(
      "EvaluateAudioCodePrompt"
    ); // Changed task reference
    expect(mockEvaluateModel.generate).toHaveBeenCalledWith(
      expect.objectContaining({ audioBase64: testAudioBase64 }) // Check for audioBase64
    );
    expect(audioCodeTask.evaluation).toEqual(mockEvaluation); // Changed task reference
    expect(initFileTaskSpy).toHaveBeenCalled();
    expect(audioCodeTask.setTaskId).toHaveBeenCalledWith("test summary"); // Changed task reference
    expect(audioCodeTask.initWorktree).toHaveBeenCalled(); // Changed task reference
    expect(audioCodeTask.addSubtask).toHaveBeenCalledTimes(4); // Changed task reference
    expect(audioCodeTask.addSubtask).toHaveBeenCalledWith(expect.any(Coder)); // Changed task reference
    expect(audioCodeTask.addSubtask).toHaveBeenCalledWith(expect.any(Tester)); // Changed task reference
    expect(audioCodeTask.addSubtask).toHaveBeenCalledWith(
      expect.any(RequirePassingTests)
    ); // Changed task reference
    expect(audioCodeTask.addSubtask).toHaveBeenCalledWith(
      expect.any(GitCommitMerge)
    ); // Changed task reference
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
    const initFileTaskSpy = vi.spyOn(audioCodeTask as any, "initFileTask"); // Changed task reference

    await audioCodeTask.initTask(); // Changed task reference

    expect(audioCodeTask.newModel).toHaveBeenCalledWith(
      "EvaluateAudioCodePrompt"
    ); // Changed task reference
    expect(mockEvaluateModel.generate).toHaveBeenCalledWith(
      expect.objectContaining({ audioBase64: testAudioBase64 }) // Check for audioBase64
    );
    expect(audioCodeTask.evaluation).toEqual(mockEvaluation); // Changed task reference
    expect(initFileTaskSpy).not.toHaveBeenCalled();
    expect(audioCodeTask.addSubtask).not.toHaveBeenCalled(); // Changed task reference
    // Keep console log check as is, unless the log message itself changes in AudioCode
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "Model response indicates no file modifications. Only file modification tasks are currently supported."
    );
  });

  describe("cleanupTask", () => {
    it("should call cassi.repository.remWorktree with taskId if taskId exists", async () => {
      audioCodeTask.taskId = "test-task-id"; // Changed task reference
      await audioCodeTask.cleanupTask(); // Changed task reference
      expect(cassi.repository.remWorktree).toHaveBeenCalledWith("test-task-id");
    });

    it("should not call cassi.repository.remWorktree if taskId is null", async () => {
      audioCodeTask.taskId = null; // Changed task reference
      await audioCodeTask.cleanupTask(); // Changed task reference
      expect(cassi.repository.remWorktree).not.toHaveBeenCalled();
      // Update console log check if the log message in AudioCode changes
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[AudioCode Task] No taskId found for cleanup, skipping worktree removal."
      );
    });

    it("should propagate errors from cassi.repository.remWorktree", async () => {
      audioCodeTask.taskId = "test-task-id-error"; // Changed task reference
      const remWorktreeError = new Error("Failed to remove worktree");
      vi.spyOn(cassi.repository, "remWorktree").mockRejectedValue(
        remWorktreeError
      );

      await expect(audioCodeTask.cleanupTask()).rejects.toThrow(
        remWorktreeError
      ); // Changed task reference
      expect(cassi.repository.remWorktree).toHaveBeenCalledWith(
        "test-task-id-error"
      );
    });
  });
});
