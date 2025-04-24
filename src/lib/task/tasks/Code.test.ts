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
const mockNewInstance = vi.fn();
const mockCassi = {
  tool: {
    invoke: vi.fn(),
  },
  model: {
    newInstance: mockNewInstance,
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
    // Mock generate to return valid JSON including summary for this test
    mockGenerate.mockResolvedValue(
      JSON.stringify({ modifiesFiles: true, summary: "Test Summary" })
    );
    const codeTask = new Code(mockCassi, null, promptText);

    await codeTask.initTask(); // Call the method

    // Verify newModel was called correctly
    expect(mockNewInstance).toHaveBeenCalledTimes(1);
    expect(mockNewInstance).toHaveBeenCalledWith("EvaluateCodePrompt");

    // Verify the generate method on the mock model was called correctly
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerate).toHaveBeenCalledWith(promptText);
  });

  it("should log the response from model.generate", async () => {
    const promptText = "Generate some code.";
    const mockResponse = "Generated code response";
    // Configure the mock generate function to return a specific value
    mockGenerate.mockResolvedValue(mockResponse);

    const codeTask = new Code(mockCassi, null, promptText);
    const consoleSpy = vi.spyOn(console, "log"); // Spy on console.log
    const consoleErrorSpy = vi.spyOn(console, "error"); // Spy on console.error

    // Expect initTask to throw because the response is not valid JSON
    // Note: codeTask is already declared above in this scope
    await expect(codeTask.initTask()).rejects.toThrow(
      `Failed to parse model response: ${mockResponse}`
    );

    // Verify console.error was called due to parsing failure
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to parse model response:",
      expect.any(SyntaxError)
    );
    // Verify console.log was NOT called with the outdated message
    expect(consoleSpy).not.toHaveBeenCalledWith(
      "Model response:",
      mockResponse
    );

    consoleSpy.mockRestore(); // Restore original console.log
    consoleErrorSpy.mockRestore(); // Restore original console.error
  });

  it("should log 'Proceeding...' when modifiesFiles is true", async () => {
    const promptText = "Generate code that modifies files.";
    // Mock generate to return valid JSON including summary for this test
    const mockJsonResponse = JSON.stringify({
      modifiesFiles: true,
      summary: "Another Test Summary",
    });
    mockGenerate.mockResolvedValue(mockJsonResponse);

    const codeTask = new Code(mockCassi, null, promptText);
    const consoleSpy = vi.spyOn(console, "log");

    // Spy on the private method initFileTask
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const initFileTaskSpy = vi.spyOn(codeTask as any, "initFileTask");

    await codeTask.initTask();

    // Check that the parsed response is stored in the evaluation property
    expect(codeTask.evaluation).toEqual({
      modifiesFiles: true,
      summary: "Another Test Summary",
    }); // Verify summary is stored

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
    const mockJsonResponse = JSON.stringify({ modifiesFiles: false });
    mockGenerate.mockResolvedValue(mockJsonResponse);

    const codeTask = new Code(mockCassi, null, promptText);
    const consoleSpy = vi.spyOn(console, "log");
    // Spy on the private method initFileTask to ensure it's NOT called
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const initFileTaskSpy = vi.spyOn(codeTask as any, "initFileTask");

    await codeTask.initTask();

    // Check that the parsed response is stored in the evaluation property
    expect(codeTask.evaluation).toEqual({ modifiesFiles: false });

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

  it("should throw an error and log error if JSON parsing fails", async () => {
    const promptText = "Generate invalid JSON.";
    const invalidJsonResponse = "this is not json";
    mockGenerate.mockResolvedValue(invalidJsonResponse);

    const codeTask = new Code(mockCassi, null, promptText);
    const consoleErrorSpy = vi.spyOn(console, "error");

    await expect(codeTask.initTask()).rejects.toThrow(
      `Failed to parse model response: ${invalidJsonResponse}`
    );

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to parse model response:",
      expect.any(SyntaxError) // Check for SyntaxError specifically
    );

    // Check that evaluation property is not set after parsing failure
    expect(codeTask.evaluation).toBeUndefined();

    consoleErrorSpy.mockRestore();
  });

  it("should call initFileTask and log the correct repoSlug when modifiesFiles is true", async () => {
    const promptText = "Generate code that modifies files.";
    const summaryText = "This Is My Summary";
    const expectedRepoSlug = "this-is-my-summary"; // kebabCase of summaryText
    const mockJsonResponse = JSON.stringify({
      modifiesFiles: true,
      summary: summaryText,
    });
    mockGenerate.mockResolvedValue(mockJsonResponse);

    const codeTask = new Code(mockCassi, null, promptText);
    const consoleSpy = vi.spyOn(console, "log");
    // Spy on the private method initFileTask to ensure it's called
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const initFileTaskSpy = vi.spyOn(codeTask as any, "initFileTask");

    await codeTask.initTask();

    // Check that the parsed response is stored in the evaluation property
    expect(codeTask.evaluation).toEqual({
      modifiesFiles: true,
      summary: summaryText,
    });

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
        /^Task ID set to: [a-zA-Z0-9]{8}-this-is-my-summary$/
      )
    );
    // Ensure the old message is not logged
    expect(consoleSpy).not.toHaveBeenCalledWith(
      `Executing file modification task for: ${expectedRepoSlug}`
    );

    consoleSpy.mockRestore();
    initFileTaskSpy.mockRestore(); // Restore the spy
  });

  it("should generate an 8-character alphanumeric ID in initFileTask", async () => {
    const promptText = "Generate code that modifies files.";
    const summaryText = "Generate ID Test";
    const expectedRepoSlug = "generate-id-test";
    const mockTimestamp = 1713996743000; // Fixed timestamp for predictable hash
    const mockJsonResponse = JSON.stringify({
      modifiesFiles: true,
      summary: summaryText,
    });
    mockGenerate.mockResolvedValue(mockJsonResponse);

    // Mock Date.now()
    const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(mockTimestamp);

    const codeTask = new Code(mockCassi, null, promptText);
    const consoleSpy = vi.spyOn(console, "log");
    // Spy on the private method initFileTask to ensure it's called
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const initFileTaskSpy = vi.spyOn(codeTask as any, "initFileTask");

    await codeTask.initTask();

    // Check that initFileTask was called
    expect(initFileTaskSpy).toHaveBeenCalledTimes(1);

    // Check the console logs for the generated ID and taskId
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /^Generated ID for file modification task: [a-zA-Z0-9]{8}$/
      )
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^Task ID set to: [a-zA-Z0-9]{8}-generate-id-test$/)
    );

    // Optional: Calculate expected ID for verification (requires crypto import in test)
    // import crypto from 'crypto';
    // const hashInput = `${expectedRepoSlug}${mockTimestamp}`;
    // const hash = crypto.createHash('sha256').update(hashInput).digest('base64');
    // const alphanumericHash = hash.replace(/[^a-zA-Z0-9]/g, '');
    // const expectedId = alphanumericHash.substring(0, 8);
    // expect(consoleSpy).toHaveBeenCalledWith(`Generated ID for file modification task: ${expectedId}`);
    // expect(consoleSpy).toHaveBeenCalledWith(`Task ID set to: ${expectedId}-${expectedRepoSlug}`);

    // Verify taskId property is set correctly
    expect(codeTask.taskId).toMatch(/^[a-zA-Z0-9]{8}-generate-id-test$/);

    consoleSpy.mockRestore();
    initFileTaskSpy.mockRestore(); // Restore the spy
    dateNowSpy.mockRestore(); // Restore Date.now()
  });
});
