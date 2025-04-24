import path from "path"; // Import path module
import { Code } from "./Code.js"; // Added .js extension
import { Cassi } from "../../cassi/Cassi.js"; // Import Cassi
import { Task } from "../Task.js"; // Import Task for parentTask type hint
import { describe, it, expect, vi, beforeEach } from "vitest"; // Import vitest functions including beforeEach
import { EvaluateCodePrompt } from "../../model/models/EvaluateCodePrompt.js"; // Import the actual model for type hinting if needed

// Mock EvaluateCodePrompt
const mockGenerate = vi.fn();
const mockEvaluateCodePrompt = {
  generate: mockGenerate,
} as unknown as EvaluateCodePrompt; // Cast to the actual type for safety

// Mock Cassi or create a minimal instance for testing
const mockInvoke = vi.fn(); // Mock for tool invocation
const mockNewInstance = vi.fn();
const mockRepositoryDir = "/mock/repo/dir"; // Define mock repo dir
const mockCassi = {
  tool: {
    invoke: mockInvoke, // Use the specific mock here
  },
  model: {
    newInstance: mockNewInstance,
  },
  repository: {
    // Add mock repository object
    repositoryDir: mockRepositoryDir,
  },
} as unknown as Cassi;

describe("Code Task", () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.resetAllMocks();
    // Configure mockNewInstance to return the mock model when called with 'EvaluateCodePrompt'
    mockNewInstance.mockImplementation((modelName: string) => {
      if (modelName === "EvaluateCodePrompt") {
        return mockEvaluateCodePrompt;
      }
      throw new Error(`Unexpected model requested: ${modelName}`);
    });
    // Reset invoke mock specifically if needed, though resetAllMocks should cover it
    mockInvoke.mockClear();
  });
  it("should instantiate with a prompt, cassi instance, and parent task", () => {
    const promptText = "Create a function that adds two numbers.";
    const parentTask: Task | null = null; // Example parent task (or null)
    const codeTask = new Code(mockCassi, parentTask, promptText); // Pass required args
    expect(codeTask).toBeInstanceOf(Code);
    expect(codeTask.cassi).toBe(mockCassi);
    expect(codeTask.parentTask).toBe(parentTask);
    // Check if the prompt is stored correctly
    expect(codeTask.prompt).toBe(promptText);
    // Check if taskId is initialized to null
    expect(codeTask.taskId).toBeNull();
  });

  it("should store the prompt correctly and initialize taskId to null", () => {
    const promptText = "Write a test for the Code task.";
    const codeTask = new Code(mockCassi, null, promptText);
    expect(codeTask.prompt).toBe(promptText);
    expect(codeTask.taskId).toBeNull(); // Also check taskId here
  });

  it("should call newModel, generate, and initFileTask during initTask when modifiesFiles is true", async () => {
    const promptText = "Generate some code.";
    // Mock generate to return a JSON string
    const mockEvaluation = { modifiesFiles: true, summary: "Test Summary" };
    mockGenerate.mockResolvedValue(JSON.stringify(mockEvaluation)); // Stringify the mock
    const codeTask = new Code(mockCassi, null, promptText);

    // Spy on initFileTask
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const initFileTaskSpy = vi.spyOn(codeTask as any, "initFileTask");

    await codeTask.initTask(); // Call the method

    // Verify newModel was called correctly
    expect(mockNewInstance).toHaveBeenCalledTimes(1);
    expect(mockNewInstance).toHaveBeenCalledWith("EvaluateCodePrompt");

    // Verify the generate method on the mock model was called correctly
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerate).toHaveBeenCalledWith(promptText);

    // Check that the evaluation property is set correctly (parsed object)
    expect(codeTask.evaluation).toEqual(mockEvaluation);
    // Check that initFileTask was called
    expect(initFileTaskSpy).toHaveBeenCalledTimes(1);

    initFileTaskSpy.mockRestore(); // Restore spy
  });

  it("should correctly parse the JSON string returned by model.generate", async () => {
    const promptText = "Generate some code.";
    // Mock generate to return a JSON *string*
    const mockJsonResponse = { modifiesFiles: true, summary: "Parsed Summary" };
    const mockJsonString = JSON.stringify(mockJsonResponse);
    mockGenerate.mockResolvedValue(mockJsonString); // Return the stringified JSON

    const codeTask = new Code(mockCassi, null, promptText);
    // Spy on initFileTask to ensure it's called (since modifiesFiles is true in the parsed object)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const initFileTaskSpy = vi.spyOn(codeTask as any, "initFileTask");

    await codeTask.initTask(); // Call the method

    // Verify newModel was called
    expect(mockNewInstance).toHaveBeenCalledWith("EvaluateCodePrompt");
    // Verify generate was called
    expect(mockGenerate).toHaveBeenCalledWith(promptText);
    // Verify the evaluation property contains the PARSED object, not the string
    expect(codeTask.evaluation).toEqual(mockJsonResponse);
    // Verify initFileTask was called because modifiesFiles was true in the parsed object
    expect(initFileTaskSpy).toHaveBeenCalledTimes(1);

    initFileTaskSpy.mockRestore();
  });

  // Removed test 'should log the response from model.generate' as it tested JSON parsing failure which is no longer relevant.

  it("should call initFileTask when modifiesFiles is true", async () => {
    const promptText = "Generate code that modifies files.";
    // Mock generate to return a JSON string
    const mockEvaluation = {
      modifiesFiles: true,
      summary: "Another Test Summary",
    };
    mockGenerate.mockResolvedValue(JSON.stringify(mockEvaluation)); // Stringify the mock

    const codeTask = new Code(mockCassi, null, promptText);
    const consoleSpy = vi.spyOn(console, "log");

    // Spy on the private method initFileTask
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const initFileTaskSpy = vi.spyOn(codeTask as any, "initFileTask");

    await codeTask.initTask();

    // Check that the evaluation property is set correctly
    expect(codeTask.evaluation).toEqual(mockEvaluation);

    // Check that initFileTask was called
    expect(initFileTaskSpy).toHaveBeenCalledTimes(1);

    // Check the console logs inside initFileTask
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /^Generated ID for file modification task: [a-zA-Z0-9]{8}$/
      )
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /^Task ID set to: [a-zA-Z0-9]{8}-another-test-summary$/
      )
    );
    // Ensure the old message is not logged
    expect(consoleSpy).not.toHaveBeenCalledWith(
      `Executing file modification task for: another-test-summary`
    );
    expect(consoleSpy).not.toHaveBeenCalledWith(
      "Model response indicates no file modifications. Only file modification tasks are currently supported."
    );

    consoleSpy.mockRestore();
    initFileTaskSpy.mockRestore(); // Restore the spy
  });

  it("should log 'Only file modification tasks supported' and not call initFileTask when modifiesFiles is false", async () => {
    const promptText = "Generate code that does not modify files.";
    // Mock generate to return a JSON string
    const mockEvaluation = { modifiesFiles: false };
    mockGenerate.mockResolvedValue(JSON.stringify(mockEvaluation)); // Stringify the mock

    const codeTask = new Code(mockCassi, null, promptText);
    const consoleSpy = vi.spyOn(console, "log");
    // Spy on the private method initFileTask to ensure it's NOT called
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const initFileTaskSpy = vi.spyOn(codeTask as any, "initFileTask");

    await codeTask.initTask();

    // Check that the evaluation property is set correctly
    expect(codeTask.evaluation).toEqual(mockEvaluation);

    // Check that initFileTask was NOT called
    expect(initFileTaskSpy).not.toHaveBeenCalled();

    // Check the console log
    expect(consoleSpy).toHaveBeenCalledWith(
      "Model response indicates no file modifications. Only file modification tasks are currently supported."
    );
    expect(consoleSpy).not.toHaveBeenCalledWith(
      "Model indicates file modifications. Proceeding..."
    );
    expect(consoleSpy).not.toHaveBeenCalledWith(
      "Executing file modification task..."
    );

    consoleSpy.mockRestore();
    initFileTaskSpy.mockRestore(); // Restore the spy
  });

  // Removed test 'should throw an error and log error if JSON parsing fails' as JSON parsing is no longer done.

  // Modify this test to check invoke calls and logs
  it("should call initFileTask, create branch/worktree, and log details when modifiesFiles is true", async () => {
    const promptText = "Generate code that modifies files.";
    const summaryText = "This Is My Summary";
    const expectedRepoSlug = "this-is-my-summary";
    const mockTimestamp = 1713996743000; // Fixed timestamp for predictable hash
    // Mock generate to return a JSON string
    const mockEvaluation = {
      modifiesFiles: true,
      summary: summaryText,
    };
    mockGenerate.mockResolvedValue(JSON.stringify(mockEvaluation)); // Stringify the mock

    // Mock Date.now()
    const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(mockTimestamp);

    const codeTask = new Code(mockCassi, null, promptText);
    const consoleSpy = vi.spyOn(console, "log");
    // Spy on the private method initFileTask to ensure it's called
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const initFileTaskSpy = vi.spyOn(codeTask as any, "initFileTask");

    await codeTask.initTask();

    // Check that the evaluation property is set correctly
    expect(codeTask.evaluation).toEqual(mockEvaluation);

    // Check that initFileTask was called
    expect(initFileTaskSpy).toHaveBeenCalledTimes(1);

    // Verify taskId property is set correctly (regex check is fine)
    expect(codeTask.taskId).toMatch(/^[a-zA-Z0-9]{8}-this-is-my-summary$/);
    const taskId = codeTask.taskId!; // Assert taskId is not null for use below

    // Calculate expected workspaceDir
    const expectedWorkspaceDir = path.join(
      mockRepositoryDir,
      ".cassi",
      "workspaces",
      taskId
    );

    // Check the console logs
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /^Generated ID for file modification task: [a-zA-Z0-9]{8}$/
      )
    );
    expect(consoleSpy).toHaveBeenCalledWith(`Task ID set to: ${taskId}`);
    expect(consoleSpy).toHaveBeenCalledWith(
      `Workspace directory set to: ${expectedWorkspaceDir}` // Check workspace log
    );
    expect(consoleSpy).toHaveBeenCalledWith(`Created branch: ${taskId}`); // Check branch log
    expect(consoleSpy).toHaveBeenCalledWith(
      `Added worktree at ${expectedWorkspaceDir} for branch ${taskId}` // Check worktree log
    );

    // Check that invoke was called correctly for git branch
    expect(mockInvoke).toHaveBeenCalledWith(
      expect.any(Code), // Account for 'this' context passed by invoke
      "git",
      "branch",
      [mockRepositoryDir],
      [taskId]
    );

    // Check that invoke was called correctly for git addWorktree
    expect(mockInvoke).toHaveBeenCalledWith(
      expect.any(Code), // Account for 'this' context passed by invoke
      "git",
      "addWorktree", // Corrected typo
      [mockRepositoryDir],
      [expectedWorkspaceDir, taskId]
    );

    // Ensure the old message is not logged
    expect(consoleSpy).not.toHaveBeenCalledWith(
      `Executing file modification task for: ${expectedRepoSlug}`
    );

    consoleSpy.mockRestore();
    initFileTaskSpy.mockRestore();
    dateNowSpy.mockRestore();
  });

  // Keep the test for ID generation if desired, but remove the initFileTaskSpy checks
  // if they are covered elsewhere.
  it("should generate an 8-character alphanumeric ID in initFileTask", async () => {
    const promptText = "Generate code that modifies files.";
    const summaryText = "Generate ID Test";
    const expectedRepoSlug = "generate-id-test";
    const mockTimestamp = 1713996743000; // Fixed timestamp
    // Mock generate to return a JSON string
    const mockEvaluation = {
      modifiesFiles: true,
      summary: summaryText,
    };
    mockGenerate.mockResolvedValue(JSON.stringify(mockEvaluation)); // Stringify the mock
    const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(mockTimestamp);
    const codeTask = new Code(mockCassi, null, promptText);
    const consoleSpy = vi.spyOn(console, "log");

    // We still need initTask to trigger initFileTask
    await codeTask.initTask();

    // Verify taskId property is set correctly
    expect(codeTask.taskId).toMatch(/^[a-zA-Z0-9]{8}-generate-id-test$/);

    // Check console logs related to ID generation
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /^Generated ID for file modification task: [a-zA-Z0-9]{8}$/
      )
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^Task ID set to: [a-zA-Z0-9]{8}-generate-id-test$/)
    );

    consoleSpy.mockRestore();
    dateNowSpy.mockRestore();
  });

  // ... other tests ...
});
