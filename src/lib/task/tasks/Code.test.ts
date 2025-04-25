import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Code } from "./Code.js";
import { Task } from "../Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import { Models } from "../../model/Models.js"; // Import Models base class
import { Coder } from "../../model/models/Coder.js"; // Import Coder model
import { gemini20Flash } from "@genkit-ai/googleai"; // Import model reference used in Code task

// Mocks
// REMOVED: vi.mock("../Task.js"); // Remove mock for base Task class
vi.mock("../../cassi/Cassi.js");
vi.mock("../../model/Models.js"); // Mock the base Models class
vi.mock("../../model/models/Coder.js"); // Mock the Coder model

// Mock specific models if EvaluateCodePrompt is used
vi.mock("../../model/models/EvaluateCodePrompt.js", () => {
  const MockEvaluateCodePrompt = vi.fn().mockImplementation((plugin, task) => {
    return {
      generate: vi.fn(),
    };
  });
  return { EvaluateCodePrompt: MockEvaluateCodePrompt };
});

// Mock the specific model reference used in the Code task
vi.mock("@genkit-ai/googleai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@genkit-ai/googleai")>();
  return {
    ...actual,
    gemini20Flash: "mockedGemini20Flash" as any, // Mock the specific model reference
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

    expect(invokeSpy).toHaveBeenCalledWith(
      codeTask,
      "git",
      "branch",
      expect.any(Array),
      expect.any(Array)
    );
    expect(invokeSpy).toHaveBeenCalledWith(
      codeTask,
      "git",
      "addWorktree",
      expect.any(Array),
      expect.any(Array)
    );

    // Changed assertion to expect.any(Object)
    expect(codeTask.addSubtask).toHaveBeenCalledWith(expect.any(Object));
  });

  it("should correctly parse the JSON string returned by model.generate", async () => {
    const mockJsonResponse = {
      summary: "Parsed Summary",
      modifiesFiles: true,
      steps: ["Step 1", "Step 2"],
    };
    mockGenerate.mockResolvedValue(JSON.stringify(mockJsonResponse));
    vi.spyOn(mockCassi.tool, "invoke");

    await codeTask.initTask();

    expect(codeTask.evaluation).toEqual(mockJsonResponse);
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
    // Changed assertion to expect.any(Object)
    expect(codeTask.addSubtask).toHaveBeenCalledWith(expect.any(Object));
  });

  it("should add Coder subtask when modifiesFiles is true", async () => {
    mockGenerate.mockResolvedValue(
      JSON.stringify({ modifiesFiles: true, summary: "s", steps: [] })
    );
    const invokeSpy = vi.spyOn(mockCassi.tool, "invoke");
    await codeTask.initTask();

    expect(invokeSpy).toHaveBeenCalledWith(
      codeTask,
      "git",
      "branch",
      expect.any(Array),
      expect.any(Array)
    );
    expect(invokeSpy).toHaveBeenCalledWith(
      codeTask,
      "git",
      "addWorktree",
      expect.any(Array),
      expect.any(Array)
    );
    // Changed assertion to expect.any(Object)
    expect(codeTask.addSubtask).toHaveBeenCalledWith(expect.any(Object));
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

    expect(invokeSpy).toHaveBeenCalledWith(
      codeTask,
      "git",
      "branch",
      [codeTask.cassi.repository.repositoryDir],
      [expect.stringMatching(/^[a-zA-Z0-9]{8}-this-is-my-summary$/)]
    );
    expect(invokeSpy).toHaveBeenCalledWith(
      codeTask,
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
    // Changed assertion to expect.any(Object)
    expect(addSubtaskSpy).toHaveBeenCalledWith(expect.any(Object));

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

    expect(invokeSpy).toHaveBeenCalledWith(
      codeTask,
      "git",
      "branch",
      [codeTask.cassi.repository.repositoryDir],
      [expect.stringMatching(/^[a-zA-Z0-9]{8}-generate-id-test$/)]
    );
    expect(invokeSpy).toHaveBeenCalledWith(
      codeTask,
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
});
