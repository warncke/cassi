/// <reference types="vitest/globals" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Coder } from "./Coder.js";
import { type ModelReference, genkit } from "genkit"; // Import genkit here
// Do not import defineTool from @genkit-ai/ai here, we will mock it
// Do not import Models here, we want the original

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

// Mock the Models base class constructor to control `this.ai` initialization
vi.mock("../Models.js", () => {
  // Define a mock generate function for the ai object
  const mockAIGenerate = vi.fn(async (args) => {
    // Simulate an AI response based on input for testing
    return { simulatedResponse: `Response for prompt: ${args.prompt}` };
  });

  return {
    Models: class MockModels {
      ai: any;
      model: ModelReference<any>;
      constructor(plugin: any, model: ModelReference<any>) {
        // Assign the hoisted mock tool and the mock generate function to this.ai
        this.ai = {
          defineTool: topLevelMockDefineTool,
          generate: mockAIGenerate, // Add the mock generate function here
        };
        this.model = model; // Keep the model reference
        // No actual genkit() call here
      }
      // Expose the mock generate function for assertions if needed outside the instance
      static mockAIGenerate = mockAIGenerate;
    },
  };
});

// Mock plugin and model - Use the imported type
const mockPlugin = { name: "mock-plugin" } as any; // Plugin mock might not need 'ai' property anymore if not used
const mockModel = { name: "mock-model" } as ModelReference<any>; // Type assertion is fine

describe("Coder", () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
    // We might need to reset the internal mock function used by the genkit mock if accessible,
    // but clearAllMocks should handle the topLevelMockDefineTool.
  });

  it("should instantiate correctly with mock plugin and model", () => {
    // Instantiation uses original Models base class, which calls mocked genkit()
    expect(() => new Coder(mockPlugin, mockModel)).not.toThrow();
    const coderInstance = new Coder(mockPlugin, mockModel);

    // Check that the mocked genkit function was called by the base constructor
    // expect(genkit).toHaveBeenCalledTimes(1); // REMOVED: This fails as base class calls original genkit
    expect(coderInstance).toBeInstanceOf(Coder);

    // Verify the instance has the 'ai' property with 'defineTool' from the mock
    expect((coderInstance as any).ai).toBeDefined();
    expect((coderInstance as any).ai.defineTool).toBeDefined();
    // Ensure it IS the top-level mock via the base class mock
    expect((coderInstance as any).ai.defineTool).toBe(topLevelMockDefineTool);
  });

  it("should have an async generate method", () => {
    // Need to instantiate within the test as beforeEach clears mocks
    const coderInstance = new Coder(mockPlugin, mockModel);
    expect(coderInstance.generate).toBeInstanceOf(Function);
  });

  it("should initialize the tools property by calling the mocked ai.defineTool", () => {
    // Instantiate Coder - constructor calls this.ai.defineTool
    const coderInstance = new Coder(mockPlugin, mockModel);

    // Check if the topLevelMockDefineTool was called by the Coder constructor
    // (The base class mock constructor doesn't call it, the Coder constructor does)
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

  it("should call ai.generate with correct parameters and return its response", async () => {
    const coderInstance = new Coder(mockPlugin, mockModel);
    const testPrompt = "Write a function";
    const expectedResponse = {
      simulatedResponse: `Response for prompt: ${testPrompt}`,
    };

    // Access the mock generate function via the instance's ai property
    const mockGenerateFn = (coderInstance as any).ai.generate;

    // Call the generate method
    const response = await coderInstance.generate(testPrompt);

    // Assert ai.generate was called
    expect(mockGenerateFn).toHaveBeenCalledTimes(1);

    // Assert ai.generate was called with the correct arguments
    expect(mockGenerateFn).toHaveBeenCalledWith({
      prompt: testPrompt,
      tools: coderInstance.tools, // Ensure tools are passed
    });

    // Assert the method returned the expected response from the mock
    expect(response).toEqual(expectedResponse);
  });
});
