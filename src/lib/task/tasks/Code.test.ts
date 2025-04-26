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

    mockCassi = {
      repository: {
        repositoryDir: "/mock/repo/dir",
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
    vi.spyOn(codeTask, "getCwd").mockImplementation(
      () => codeTask.worktreeDir || "/mock/worktree/dir"
    );
    vi.spyOn(console, "log").mockImplementation(() => {});
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
    expect(codeTask.worktreeDir).toBeUndefined();
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
    expect(codeTask.worktreeDir).toMatch(
      /^\/mock\/repo\/dir\/\.cassi\/workspaces\/[a-zA-Z0-9]{8}-test-summary$/
    );

    expect(invokeSpy).toHaveBeenCalledTimes(2);

    expect(invokeSpy).toHaveBeenCalledWith(
      "git",
      "addWorktree",
      [mockCassi.repository.repositoryDir],
      [codeTask.worktreeDir, codeTask.taskId]
    );

    expect(invokeSpy).toHaveBeenCalledWith(
      "console",
      "exec",
      [codeTask.worktreeDir],
      ["npm install"]
    );

    expect(codeTask.addSubtask).toHaveBeenCalledTimes(2);
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
    it("should call git remWorkTree if worktreeDir is set", async () => {
      const mockWorktreeDir = "/mock/repo/dir/.cassi/workspaces/mock-task-id";
      codeTask.worktreeDir = mockWorktreeDir;

      await codeTask.cleanupTask();

      expect(invokeSpy).toHaveBeenCalledTimes(1);
      expect(invokeSpy).toHaveBeenCalledWith(
        "git",
        "remWorkTree",
        [],
        [mockWorktreeDir]
      );
    });

    it("should not call invoke if worktreeDir is not set", async () => {
      codeTask.worktreeDir = undefined;
      await codeTask.cleanupTask();
      expect(invokeSpy).not.toHaveBeenCalled();
    });
  });
});
