/// <reference types="vitest/globals" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Coder } from "./Coder.js";
import { type ModelReference } from "genkit";
import { defineTool } from "@genkit-ai/ai"; // Keep original import for type usage if needed

// Mock the genkit library AND @genkit-ai/ai
const mockDefineTool = vi.fn((config, handler, options) => ({
  ...config,
  handler,
  options,
})); // Simple mock returning config + handler + options

vi.mock("genkit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("genkit")>();
  return {
    ...actual,
    genkit: vi.fn(),
  };
});

vi.mock("@genkit-ai/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@genkit-ai/ai")>();
  return {
    ...actual,
    defineTool: mockDefineTool, // Use the mock function
  };
});

// Mock plugin and model - Use the imported type
// Mock the 'ai' object structure expected by the Models base class or used by Coder
const mockAiInstance = {
  defineTool: mockDefineTool, // Point to the same mock function
};
const mockPlugin = { name: "mock-plugin", ai: mockAiInstance } as any; // Assume plugin provides ai
const mockModel = { name: "mock-model" } as ModelReference<any>; // Type assertion is fine

describe("Coder", () => {
  // Reset and configure mocks before each test
  beforeEach(async () => {
    // Clear all previous mock states and calls
    vi.clearAllMocks();

    // Mock the Models base class constructor or its setup if necessary
    // Ensure the genkit() mock is configured *before* any instantiation
    const { genkit } = await import("genkit");
    (genkit as ReturnType<typeof vi.fn>).mockReturnValue({
      ai: mockAiInstance, // Ensure genkit().ai returns our mock
      // Mock other methods returned by genkit() if needed by Models constructor
    });
    // Note: We pass mockPlugin (which also contains mockAiInstance) to the Coder constructor.
    // This covers cases where the base class might use plugin.ai OR genkit().ai.
  });

  it("should instantiate correctly with mock plugin and model", () => {
    // Expect instantiation to not throw an error
    expect(() => new Coder(mockPlugin, mockModel)).not.toThrow();
  });

  it("should have an async generate method", () => {
    const coderInstance = new Coder(mockPlugin, mockModel);
    expect(coderInstance.generate).toBeInstanceOf(Function);
    // Check if it returns a Promise (basic check for async)
    expect(coderInstance.generate("test prompt")).toBeInstanceOf(Promise);
  });

  it("should initialize the tools property with the execute_command tool", () => {
    // Instantiate Coder - constructor calls this.ai.defineTool which should hit our mock
    const coderInstance = new Coder(mockPlugin, mockModel);

    // Check if defineTool was called correctly within the constructor
    // Note: Depending on how Models sets up `this.ai`, this might be called via mockAiInstance.defineTool
    // or the globally mocked defineTool. We check the global mock.
    expect(mockDefineTool).toHaveBeenCalledTimes(1);
    expect(mockDefineTool).toHaveBeenCalledWith(
      expect.objectContaining({ name: "execute_command" }), // Check config object
      expect.any(Function), // Check handler function
      expect.any(Object) // Check options object (should be {})
    );

    // Check the resulting tools array based on our mock's return value
    expect(coderInstance.tools).toBeDefined();
    expect(Array.isArray(coderInstance.tools)).toBe(true);
    expect(coderInstance.tools.length).toBe(1);
    expect(coderInstance.tools[0]).toBeDefined();
    expect(coderInstance.tools[0].name).toBe("execute_command");
    expect(coderInstance.tools[0].description).toBeDefined();
    expect(coderInstance.tools[0].inputSchema).toBeDefined();
    expect(coderInstance.tools[0].outputSchema).toBeDefined();
    expect(coderInstance.tools[0].handler).toBeInstanceOf(Function);
    expect(coderInstance.tools[0].options).toEqual({}); // Check the options object passed
  });
});
