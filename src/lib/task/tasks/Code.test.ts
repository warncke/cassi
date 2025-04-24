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

    await codeTask.initTask(); // Call the method

    // Verify console.log was called with the correct message and response
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith("Model response:", mockResponse);

    consoleSpy.mockRestore(); // Restore original console.log
  });

  // TODO: Add more tests if needed
});
