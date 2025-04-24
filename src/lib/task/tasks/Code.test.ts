import { Code } from "./Code.js"; // Added .js extension
import { Cassi } from "../../cassi/Cassi.js"; // Import Cassi
import { Task } from "../Task.js"; // Import Task for parentTask type hint
import { describe, it, expect, vi } from "vitest"; // Import vitest functions

// Mock Cassi or create a minimal instance for testing
// For simplicity, we can cast `null` or an empty object if strict checks aren't needed yet.
// A more robust approach would use a mocking library like Jest's mocks.
const mockCassi = {
  // Mock necessary Cassi properties/methods if Code interacts with them
  tool: {
    // Mock tool invoker if needed
    invoke: vi.fn(), // Use vitest mock function
  },
  // Add other properties/methods as needed by Task or Code
} as unknown as Cassi;

describe("Code Task", () => {
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

  it("should log the prompt when initTask is called", async () => {
    const promptText = "Log this prompt.";
    const codeTask = new Code(mockCassi, null, promptText);
    const consoleSpy = vi.spyOn(console, "log"); // Spy on console.log

    await codeTask.initTask(); // Call the method

    expect(consoleSpy).toHaveBeenCalledWith(promptText); // Assert console.log was called with the prompt

    consoleSpy.mockRestore(); // Restore original console.log
  });

  // TODO: Add more tests for getPrompts and main methods
});
