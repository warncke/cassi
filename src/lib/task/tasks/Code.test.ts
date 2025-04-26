import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Code } from "./Code.js";
import { Task } from "../Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import { Models } from "../../model/Models.js";
import { Coder } from "./Coder.js";
import { EvaluateCodePrompt } from "../../model/models/EvaluateCodePrompt.js";
import { gemini20Flash } from "@genkit-ai/googleai";

vi.mock("../../cassi/Cassi.js");
vi.mock("../../model/Models.js");
vi.mock("./Coder.js", () => {
  const MockCoder = vi.fn().mockImplementation((cassi, parentTask, prompt) => {
    return {
      cassi: cassi,
      parentTask: parentTask,
      prompt: prompt,
      run: vi.fn().mockResolvedValue(undefined),
    };
  });
  return { Coder: MockCoder };
});
vi.mock("../../model/models/EvaluateCodePrompt.js", () => {
  const MockEvaluateCodePrompt = vi.fn().mockImplementation(() => {
    return {
      generate: vi.fn(),
    };
  });
  return { EvaluateCodePrompt: MockEvaluateCodePrompt };
});

vi.mock("@genkit-ai/googleai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@genkit-ai/googleai")>();
  return {
    ...actual,
    gemini20Flash: "mockedGemini20Flash" as any,
  };
});

describe("Code Task", () => {
  let mockCassi: any;
  let mockParentTask: Task;
  let codeTask: Code;
  let mockNewModel: ReturnType<typeof vi.spyOn>;
  let mockGenerate: ReturnType<typeof vi.fn>;
  let mockEvaluateModel: { generate: ReturnType<typeof vi.fn> };
  let invokeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();

    mockGenerate = vi.fn();
    mockEvaluateModel = { generate: mockGenerate };

    mockNewModel = vi.fn().mockReturnValue(mockEvaluateModel);
    const mockGetWorktree = vi.fn().mockImplementation(async (task) => {
      // Simulate setting the worktreeDir on the task, as the real method does
      task.worktreeDir = `/mock/repo/dir/.cassi/worktrees/${task.taskId}`;
      return { worktreeDir: task.worktreeDir }; // Return a mock Worktree object
    });

    mockCassi = {
      repository: {
        repositoryDir: "/mock/repo/dir",
        getWorktree: mockGetWorktree, // Add the mock function here
      },
      model: {
        newInstance: mockNewModel,
      },
    } as unknown as Cassi;

    mockParentTask = new Task(mockCassi, null);
    codeTask = new Code(mockCassi, mockParentTask, "Generate some code.");

    invokeSpy = vi
      .spyOn(codeTask as any, "invoke")
      .mockResolvedValue(undefined);
    vi.spyOn(codeTask, "addSubtask");
    // getCwd will call the actual implementation which now relies on worktreeDir()
    // Mock worktreeDir separately for tests that need it
    vi.spyOn(codeTask, "worktreeDir").mockImplementation(() => {
      if (codeTask.worktree?.worktreeDir) {
        return codeTask.worktree.worktreeDir;
      }
      throw new Error("Mock worktreeDir not set");
    });
    // No longer need to mock remWorktree here as it's not called by cleanupTask
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should instantiate with a prompt cassi instance and parent task", () => {
    expect(codeTask).toBeInstanceOf(Code);
    expect(codeTask).toBeInstanceOf(Task);
    expect(codeTask.prompt).toBe("Generate some code.");
    expect(codeTask.cassi).toBe(mockCassi);
    expect(codeTask.parentTask).toBe(mockParentTask);
    expect(codeTask.prompt).toBe("Generate some code.");
    expect(codeTask.taskId).toBeNull();
    // worktreeDir property is removed, check worktree object instead if needed
    expect(codeTask.worktree).toBeUndefined();
  });

  it("should evaluate prompt, create worktree, install deps, and add Coder subtask when modifiesFiles is true", async () => {
    const mockResponse = JSON.stringify({
      summary: "Test Summary",
      modifiesFiles: true,
      steps: ["Step 1"],
    });
    mockGenerate.mockResolvedValue(mockResponse);

    await codeTask.initTask();

    expect(mockNewModel).toHaveBeenCalledTimes(1);
    expect(mockNewModel).toHaveBeenCalledTimes(1);
    expect(mockNewModel).toHaveBeenCalledWith("EvaluateCodePrompt", codeTask);

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerate).toHaveBeenCalledWith({
      model: "mockedGemini20Flash",
      prompt: codeTask.prompt,
    });

    expect(codeTask.evaluation).toEqual(JSON.parse(mockResponse));
    expect(codeTask.taskId).toMatch(/^[a-zA-Z0-9]{8}-test-summary$/);
    // Check that the worktree object was created and has the correct dir
    expect(codeTask.worktree).toBeDefined();
    expect(codeTask.worktree?.worktreeDir).toMatch(
      /^\/mock\/repo\/dir\/\.cassi\/worktrees\/[a-zA-Z0-9]{8}-test-summary$/
    );

    // Verify getWorktree was called
    expect(mockCassi.repository.getWorktree).toHaveBeenCalledTimes(1);
    expect(mockCassi.repository.getWorktree).toHaveBeenCalledWith(codeTask);

    // invokeSpy should not be called for worktree setup anymore
    expect(invokeSpy).not.toHaveBeenCalledWith(
      "git",
      "addWorktree",
      expect.anything(),
      expect.anything()
    );
    expect(invokeSpy).not.toHaveBeenCalledWith(
      "console",
      "exec",
      expect.anything(),
      ["npm install"]
    );

    expect(codeTask.addSubtask).toHaveBeenCalledTimes(2); // Coder and Tester
    const MockCoder = vi.mocked(Coder);
    expect(MockCoder).toHaveBeenCalledTimes(1);
    expect(codeTask.addSubtask).toHaveBeenCalledWith(
      MockCoder.mock.instances[0]
    );

    const capturedPrompt = MockCoder.mock.calls[0][2];
    expect(capturedPrompt).toContain("Generate some code.");
    expect(capturedPrompt).toContain("Summary: Test Summary");
    expect(capturedPrompt).toContain("Steps:\n- Step 1");
  });

  it("should log message and not invoke tools or add subtask when modifiesFiles is false", async () => {
    const mockResponse = JSON.stringify({
      summary: "No Modify Summary",
      modifiesFiles: false,
      steps: [],
    });
    mockGenerate.mockResolvedValue(mockResponse);

    await codeTask.initTask();

    expect(mockNewModel).toHaveBeenCalledTimes(1);
    expect(mockNewModel).toHaveBeenCalledWith("EvaluateCodePrompt", codeTask);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(codeTask.evaluation).toEqual(JSON.parse(mockResponse));
    expect(invokeSpy).not.toHaveBeenCalled();
    expect(codeTask.addSubtask).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      "Model response indicates no file modifications. Only file modification tasks are currently supported."
    );
  });

  describe("cleanupTask", () => {
    let mockWorktree: { delete: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      // Setup a mock worktree object for the task
      mockWorktree = {
        delete: vi.fn().mockResolvedValue(undefined),
      };
      codeTask.worktree = mockWorktree as any; // Assign mock worktree
      // No need to set taskId specifically for cleanup tests anymore
    });

    it("should call worktree.delete() if worktree exists", async () => {
      await codeTask.cleanupTask();

      expect(mockWorktree.delete).toHaveBeenCalledTimes(1);
      // remWorktree is no longer called here
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        "[Code Task] Starting cleanupTask"
      );
      expect(console.log).toHaveBeenCalledWith(
        "[Code Task] Finished cleanupTask"
      );
    });

    // Removed test for taskId being null as it's no longer relevant

    it("should log warning if worktree.delete() throws", async () => {
      const deleteError = new Error("Failed to delete worktree");
      mockWorktree.delete.mockRejectedValue(deleteError);

      await codeTask.cleanupTask();

      expect(mockWorktree.delete).toHaveBeenCalledTimes(1);
      // remWorktree is no longer called here
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledWith(
        "[Code Task] Error during worktree cleanup:",
        deleteError
      );
    });

    it("should log message and not call delete if worktree does not exist", async () => {
      codeTask.worktree = undefined; // Ensure worktree is not set

      await codeTask.cleanupTask();

      expect(mockWorktree.delete).not.toHaveBeenCalled(); // The specific mock instance's delete
      // remWorktree is no longer called here
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        "[Code Task] No worktree found for cleanup."
      );
    });
  });
});
