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
  });

  it("should store the prompt correctly", () => {
    const promptText = "Write a test for the Code task.";
    const codeTask = new Code(mockCassi, null, promptText);
    expect(codeTask.prompt).toBe(promptText);
  });

  it("should call newModel and generate on the model during initTask", async () => {
    const promptText = "Generate some code.";
    // Mock generate to return valid JSON for this test
    mockGenerate.mockResolvedValue(JSON.stringify({ modifiesFiles: true }));
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
    const mockJsonResponse = JSON.stringify({ modifiesFiles: true });
    mockGenerate.mockResolvedValue(mockJsonResponse);

    const codeTask = new Code(mockCassi, null, promptText);
    const consoleSpy = vi.spyOn(console, "log");

    await codeTask.initTask();

    expect(consoleSpy).toHaveBeenCalledWith(
      "Model indicates file modifications. Proceeding..."
    );
    expect(consoleSpy).not.toHaveBeenCalledWith(
      "Model response indicates no file modifications. Only file modification tasks are currently supported."
    );

    consoleSpy.mockRestore();
  });

  it("should log 'Only file modification tasks supported' when modifiesFiles is false", async () => {
    const promptText = "Generate code that does not modify files.";
    const mockJsonResponse = JSON.stringify({ modifiesFiles: false });
    mockGenerate.mockResolvedValue(mockJsonResponse);

    const codeTask = new Code(mockCassi, null, promptText);
    const consoleSpy = vi.spyOn(console, "log");

    await codeTask.initTask();

    expect(consoleSpy).toHaveBeenCalledWith(
      "Model response indicates no file modifications. Only file modification tasks are currently supported."
    );
    expect(consoleSpy).not.toHaveBeenCalledWith(
      "Model indicates file modifications. Proceeding..."
    );

    consoleSpy.mockRestore();
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

    consoleErrorSpy.mockRestore();
  });
});
