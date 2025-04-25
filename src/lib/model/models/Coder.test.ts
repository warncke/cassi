/// <reference types="vitest/globals" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Coder } from "./Coder.js";
import { type ModelReference } from "genkit"; // Keep ModelReference for mock
import { GenerateModelOptions } from "../Models.js"; // Import GenerateModelOptions
// Removed genkit import as it's not directly used/mocked here anymore
// Do not import defineTool from @genkit-ai/ai here, we will mock it

// Use vi.hoisted to define the mock function ensuring it's available before mocks
const { topLevelMockDefineTool } = vi.hoisted(() => {
  return {
    topLevelMockDefineTool: vi.fn((config, handler, options) => ({
      ...config,
      handler,
      options,
    })),
  };
});

// REMOVED mock for "@genkit-ai/ai"
// REMOVED mock for "genkit"

// Mock the Models base class constructor and its methods
vi.mock("../Models.js", () => {
  // Define a mock generate function for the ai object
  const mockAIGenerate = vi.fn(async (options: GenerateModelOptions) => {
    // Simulate an AI response based on input for testing
    // Return a structure that has a .text() method
    const responseText = `AI Response for prompt: ${
      typeof options.prompt === "string"
        ? options.prompt
        : JSON.stringify(options.prompt)
    }`;
    return {
      text: () => responseText,
      toJSON: () => ({ text: responseText }), // Add toJSON for logging in implementation
    };
  });

  class MockBaseModels {
    ai: any;
    constructor(plugin: any) {
      // Assign the hoisted mock tool and the mock generate function to this.ai
      this.ai = {
        defineTool: topLevelMockDefineTool,
        generate: mockAIGenerate, // Add the mock generate function here
      };
      // No model stored here anymore
      // No actual genkit() call here
    }
    // Implement the abstract generate method (though it won't be called directly in these tests)
    async generate(options: GenerateModelOptions): Promise<string> {
      throw new Error("Base generate should not be called in this mock");
    }
    // Expose the mock generate function for assertions if needed outside the instance
    static mockAIGenerate = mockAIGenerate;
  }

  return {
    Models: MockBaseModels,
    // Export GenerateModelOptions if it was defined here, but it's imported now
  };
});

// Mock plugin and model - Use the imported type
const mockPlugin = { name: "mock-plugin" } as any;
const mockModel = { name: "mock-model" } as ModelReference<any>; // Keep mock model reference

describe("Coder", () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
    // We might need to reset the internal mock function used by the genkit mock if accessible,
    // but clearAllMocks should handle the topLevelMockDefineTool.
  });

  it("should instantiate correctly with mock plugin", () => {
    // Instantiation uses the mocked Models base class
    expect(() => new Coder(mockPlugin)).not.toThrow(); // Only pass plugin
    const coderInstance = new Coder(mockPlugin); // Only pass plugin

    expect(coderInstance).toBeInstanceOf(Coder);

    // Verify the instance has the 'ai' property with 'defineTool' from the mock
    expect((coderInstance as any).ai).toBeDefined();
    expect((coderInstance as any).ai.defineTool).toBeDefined();
    // Ensure it IS the top-level mock via the base class mock
    expect((coderInstance as any).ai.defineTool).toBe(topLevelMockDefineTool);
  });

  it("should have an async generate method", () => {
    // Need to instantiate within the test as beforeEach clears mocks
    const coderInstance = new Coder(mockPlugin); // Only pass plugin
    expect(coderInstance.generate).toBeInstanceOf(Function);
  });

  it("should initialize the tools property by calling the mocked ai.defineTool", () => {
    // Instantiate Coder - constructor calls this.ai.defineTool
    const coderInstance = new Coder(mockPlugin); // Only pass plugin

    // Check if the topLevelMockDefineTool was called by the Coder constructor
    expect(topLevelMockDefineTool).toHaveBeenCalledTimes(1);
    expect(topLevelMockDefineTool).toHaveBeenCalledWith(
      expect.objectContaining({ name: "execute_command" }),
      expect.any(Function),
      {} // Assuming default options {}
    );

    // Check the resulting tools array (based on the return value of the mock)
    expect(coderInstance.tools).toBeDefined();
    expect(Array.isArray(coderInstance.tools)).toBe(true);
    expect(coderInstance.tools.length).toBe(1);
    const tool = coderInstance.tools[0];
    expect(tool).toBeDefined();
    expect(tool.name).toBe("execute_command");
    expect(tool.description).toBeDefined();
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
    expect(tool.handler).toBeInstanceOf(Function);
    expect(tool.options).toEqual({});
  });

  it("should call ai.generate with correct parameters and return the text response", async () => {
    const coderInstance = new Coder(mockPlugin); // Only pass plugin
    const testPrompt = "Write a function";
    const generateOptions: GenerateModelOptions = {
      model: mockModel, // Pass the mock model reference
      prompt: testPrompt,
    };
    const expectedText = `AI Response for prompt: ${testPrompt}`; // Expecting string now

    // Access the mock generate function via the instance's ai property
    const mockGenerateFn = (coderInstance as any).ai.generate;

    // Call the generate method with the options object
    const responseText = await coderInstance.generate(generateOptions);

    // Assert ai.generate was called
    expect(mockGenerateFn).toHaveBeenCalledTimes(1);

    // Assert ai.generate was called with the correct arguments object
    expect(mockGenerateFn).toHaveBeenCalledWith({
      model: mockModel, // Check model was passed
      prompt: testPrompt,
      tools: coderInstance.tools, // Ensure tools are passed
    });

    // Assert the method returned the expected text string from the mock's .text() method
    expect(responseText).toBe(expectedText);
  });
});
