import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Code } from "./Code.js";
import { Task } from "../Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import { Models } from "../../model/Models.js";
import { Coder } from "../../model/models/Coder.js";
import { gemini20Flash } from "@genkit-ai/googleai";

vi.mock("../../cassi/Cassi.js");
vi.mock("../../model/Models.js");
vi.mock("../../model/models/Coder.js");

vi.mock("../../model/models/EvaluateCodePrompt.js", () => {
  const MockEvaluateCodePrompt = vi.fn().mockImplementation((plugin, task) => {
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
  let mockCassi: Cassi;
  let mockParentTask: Task;
  let codeTask: Code;
  let mockNewInstance: ReturnType<typeof vi.spyOn>;
  let mockGenerate: ReturnType<typeof vi.fn>;
  let mockEvaluateModel: { generate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.resetAllMocks();

    mockGenerate = vi.fn();
    mockEvaluateModel = { generate: mockGenerate };

    mockNewInstance = vi.fn().mockReturnValue(mockEvaluateModel);
    mockCassi = {
      model: {
        newInstance: mockNewInstance,
      },
      repository: {
        repositoryDir: "/mock/repo/dir",
      },
      tool: {
        invoke: vi.fn().mockResolvedValue(undefined),
      },
    } as unknown as Cassi;

    mockParentTask = new Task(mockCassi);
    codeTask = new Code(mockCassi, mockParentTask, "Generate some code.");

    vi.spyOn(codeTask, "addSubtask");
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
  });

  it("should store the prompt correctly and initialize taskId to null", () => {
    expect(codeTask.prompt).toBe("Generate some code.");
    expect(codeTask.taskId).toBeNull();
  });

  it("should call newModel generate and add Coder subtask during initTask when modifiesFiles is true", async () => {
    const mockResponse = JSON.stringify({
      summary: "Test Summary",
      modifiesFiles: true,
      steps: [],
    });
    mockGenerate.mockResolvedValue(mockResponse);
    const invokeSpy = vi.spyOn(mockCassi.tool, "invoke");

    await codeTask.initTask();

    expect(mockNewInstance).toHaveBeenCalledTimes(1);
    expect(mockNewInstance).toHaveBeenCalledWith(
      "EvaluateCodePrompt",
      codeTask
    );

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerate).toHaveBeenCalledWith({
      model: "mockedGemini20Flash",
      prompt: codeTask.prompt,
    });

    // Check the first git addWorktree call (which might be creating the branch)
    expect(invokeSpy).toHaveBeenCalledWith(
      codeTask, // Add task instance as first argument
      "git",
      "addWorktree",
      [codeTask.getCwd()],
      [expect.stringMatching(/^[a-zA-Z0-9]{8}-test-summary$/)]
    );

    // Check the console exec call for npm install with the corrected structure
    expect(invokeSpy).toHaveBeenCalledWith(
      codeTask, // Add task instance as first argument
      "console",
      "exec",
      [codeTask.getCwd()], // First argument array (options/cwd)
      ["npm install"] // Second argument array (command)
    );

    // Check the second git addWorktree call (adding the actual worktree)
    expect(invokeSpy).toHaveBeenCalledWith(
      codeTask, // Add task instance as first argument
      "git",
      "addWorktree",
      [codeTask.cassi.repository.repositoryDir],
      [
        expect.stringMatching(
          /^\/mock\/repo\/dir\/\.cassi\/workspaces\/[a-zA-Z0-9]{8}-test-summary$/
        ),
        expect.stringMatching(/^[a-zA-Z0-9]{8}-test-summary$/),
      ]
    );

    expect(codeTask.addSubtask).toHaveBeenCalledWith(expect.any(Object)); // Changed Coder to Object
  });

  it("should correctly parse the JSON string returned by model.generate", async () => {
    const mockJsonResponse = {
      summary: "Parsed Summary",
      modifiesFiles: true,
      steps: ["Step 1", "Step 2"],
    };
    mockGenerate.mockResolvedValue(JSON.stringify(mockJsonResponse));
    const invokeSpy = vi.spyOn(mockCassi.tool, "invoke");

    await codeTask.initTask();

    expect(codeTask.evaluation).toEqual(mockJsonResponse);
    // Add check for console.exec here too for consistency with the corrected structure
    expect(invokeSpy).toHaveBeenCalledWith(
      codeTask, // Add task instance as first argument
      "console",
      "exec",
      [codeTask.getCwd()],
      ["npm install"]
    );
    expect(mockNewInstance).toHaveBeenCalledWith(
      "EvaluateCodePrompt",
      codeTask
    );
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "mockedGemini20Flash",
        prompt: codeTask.prompt,
      })
    );
    expect(codeTask.addSubtask).toHaveBeenCalledWith(expect.any(Object));
  });

  it("should add Coder subtask when modifiesFiles is true", async () => {
    mockGenerate.mockResolvedValue(
      JSON.stringify({ modifiesFiles: true, summary: "s", steps: [] })
    );
    const invokeSpy = vi.spyOn(mockCassi.tool, "invoke");
    await codeTask.initTask();

    // Check the first git addWorktree call
    expect(invokeSpy).toHaveBeenCalledWith(
      codeTask, // Add task instance as first argument
      "git",
      "addWorktree",
      [codeTask.getCwd()],
      [expect.stringMatching(/^[a-zA-Z0-9]{8}-s$/)]
    );

    // Check the console exec call with the corrected structure
    expect(invokeSpy).toHaveBeenCalledWith(
      codeTask, // Add task instance as first argument
      "console",
      "exec",
      [codeTask.getCwd()],
      ["npm install"]
    );

    // Check the second git addWorktree call
    expect(invokeSpy).toHaveBeenCalledWith(
      codeTask, // Add task instance as first argument
      "git",
      "addWorktree",
      [codeTask.cassi.repository.repositoryDir],
      [
        expect.stringMatching(
          /^\/mock\/repo\/dir\/\.cassi\/workspaces\/[a-zA-Z0-9]{8}-s$/
        ),
        expect.stringMatching(/^[a-zA-Z0-9]{8}-s$/),
      ]
    );
    expect(codeTask.addSubtask).toHaveBeenCalledWith(expect.any(Object)); // Changed Coder to Object
  });

  it("should log 'Only file modification tasks supported' and not add Coder subtask when modifiesFiles is false", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockGenerate.mockResolvedValue(
      JSON.stringify({ modifiesFiles: false, summary: "s", steps: [] })
    );
    const invokeSpy = vi.spyOn(mockCassi.tool, "invoke");

    await codeTask.initTask();

    expect(invokeSpy).not.toHaveBeenCalled();
    expect(codeTask.addSubtask).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Only file modification tasks are currently supported"
      )
    );
    consoleLogSpy.mockRestore();
  });

  it("should call git tools and add Coder subtask with correct prompt when modifiesFiles is true", async () => {
    const summary = "this-is-my-summary";
    const steps = ["step a", "step b"];
    mockGenerate.mockResolvedValue(
      JSON.stringify({ modifiesFiles: true, summary: summary, steps: steps })
    );
    const invokeSpy = vi.spyOn(mockCassi.tool, "invoke");
    const addSubtaskSpy = vi.spyOn(codeTask, "addSubtask");

    await codeTask.initTask();

    // Check first addWorktree
    expect(invokeSpy).toHaveBeenCalledWith(
      codeTask, // Add task instance as first argument
      "git",
      "addWorktree",
      [codeTask.getCwd()],
      [expect.stringMatching(/^[a-zA-Z0-9]{8}-this-is-my-summary$/)]
    );

    // Check console exec with the corrected structure
    expect(invokeSpy).toHaveBeenCalledWith(
      codeTask, // Add task instance as first argument
      "console",
      "exec",
      [codeTask.getCwd()],
      ["npm install"]
    );

    // Check second addWorktree
    expect(invokeSpy).toHaveBeenCalledWith(
      codeTask, // Add task instance as first argument
      "git",
      "addWorktree",
      [codeTask.cassi.repository.repositoryDir],
      [
        expect.stringMatching(
          /^\/mock\/repo\/dir\/\.cassi\/workspaces\/[a-zA-Z0-9]{8}-this-is-my-summary$/
        ),
        expect.stringMatching(/^[a-zA-Z0-9]{8}-this-is-my-summary$/),
      ]
    );
    expect(addSubtaskSpy).toHaveBeenCalledTimes(1);
    expect(addSubtaskSpy).toHaveBeenCalledWith(expect.any(Object)); // Changed Coder to Object

    const addedSubtask = addSubtaskSpy.mock.calls[0][0] as any;
    expect(addedSubtask.prompt).toContain(codeTask.prompt);
    expect(addedSubtask.prompt).toContain(`Summary: ${summary}`);
    expect(addedSubtask.prompt).toContain(
      `Steps:\n- ${steps[0]}\n- ${steps[1]}`
    );
  });

  it("should generate an 8-character alphanumeric ID and use it in git calls", async () => {
    mockGenerate.mockResolvedValue(
      JSON.stringify({
        modifiesFiles: true,
        summary: "generate-id-test",
        steps: [],
      })
    );
    const invokeSpy = vi.spyOn(mockCassi.tool, "invoke");

    await codeTask.initTask();

    // Check first addWorktree
    expect(invokeSpy).toHaveBeenCalledWith(
      codeTask, // Add task instance as first argument
      "git",
      "addWorktree",
      [codeTask.getCwd()],
      [expect.stringMatching(/^[a-zA-Z0-9]{8}-generate-id-test$/)]
    );

    // Check console exec with the corrected structure
    expect(invokeSpy).toHaveBeenCalledWith(
      codeTask, // Add task instance as first argument
      "console",
      "exec",
      [codeTask.getCwd()],
      ["npm install"]
    );

    // Check second addWorktree
    expect(invokeSpy).toHaveBeenCalledWith(
      codeTask, // Add task instance as first argument
      "git",
      "addWorktree",
      [codeTask.cassi.repository.repositoryDir],
      [
        expect.stringMatching(
          /^\/mock\/repo\/dir\/\.cassi\/workspaces\/[a-zA-Z0-9]{8}-generate-id-test$/
        ),
        expect.stringMatching(/^[a-zA-Z0-9]{8}-generate-id-test$/),
      ]
    );
    expect(codeTask.taskId).toMatch(/^[a-zA-Z0-9]{8}-generate-id-test$/);
  });

  describe("cleanupTask", () => {
    it("should call git remWorkTree and fs deleteDirectory if worktreeDir is set", async () => {
      const mockWorktreeDir = "/mock/repo/dir/.cassi/workspaces/mock-task-id";
      codeTask.worktreeDir = mockWorktreeDir;
      const invokeSpy = vi.spyOn(mockCassi.tool, "invoke");

      await codeTask.cleanupTask();

      expect(invokeSpy).toHaveBeenCalledTimes(2);
      // Correcting the remWorkTree call based on likely intent (using worktreeDir as primary arg)
      expect(invokeSpy).toHaveBeenCalledWith(
        codeTask, // Add task instance as first argument
        "git",
        "remWorkTree",
        [mockWorktreeDir], // Options likely empty or related to the worktree path
        [mockWorktreeDir] // Argument is the worktree path to remove
      );
      expect(invokeSpy).toHaveBeenCalledWith(
        codeTask, // Add task instance as first argument
        "fs",
        "deleteDirectory",
        [], // No options expected for deleteDirectory
        [mockWorktreeDir]
      );
    });

    it("should not call invoke if worktreeDir is not set", async () => {
      codeTask.worktreeDir = undefined;
      const invokeSpy = vi.spyOn(mockCassi.tool, "invoke");

      await codeTask.cleanupTask();

      expect(invokeSpy).not.toHaveBeenCalled();
    });
  });
});
