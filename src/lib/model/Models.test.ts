// Explicit imports instead of relying on globals/reference directive
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { Models, GenerateModelOptions } from "./Models.js";
import { Task } from "../task/Task.js";
import { ToolDefinition } from "../tool/Tool.js"; // Imports the local definition
import {
  genkit, // Import genkit to mock it
  GenkitError,
  GenerateResponse,
  MessageData,
  Part,
  ToolRequest,
  ToolResponse, // Keep this import if used below, otherwise remove
  ToolRequestPart,
  ToolResponsePart,
} from "genkit";

// Mock the genkit function
vi.mock("genkit", async (importOriginal) => {
  const original = await importOriginal<typeof import("genkit")>();
  return {
    ...original, // Keep original exports
    genkit: vi.fn().mockReturnValue({
      // Mock the genkit() function itself
      generate: vi.fn(), // Provide mock generate
      defineTool: vi.fn((def, handler) => ({ ...def, handler })), // Provide mock defineTool
    }),
  };
});

vi.mock("../task/Task.js", () => ({
  Task: vi.fn().mockImplementation(() => ({
    config: { cwd: "/fake/path" },
  })),
}));

// Helper to create parameters structure for local ToolDefinition
const createToolParameters = (
  properties: Record<string, { type: string; description?: string }>,
  required?: string[]
) => ({
  type: "object" as const,
  properties,
  required, // 'required' is part of the parameters object
});

class TestModel extends Models {
  // Constructor now receives the mocked AI object directly via the mocked genkit call
  constructor(plugin: any, task: Task) {
    super(plugin, task); // plugin arg is unused due to mock, but constructor requires it
  }

  async generate(options: GenerateModelOptions): Promise<string> {
    return "TestModel generate called - should not be hit by generateWithTools tests";
  }
}

describe("Models", () => {
  let task: Task;
  let testModel: TestModel;
  let mockGenkitGenerate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    task = new Task({} as any);
    testModel = new TestModel({}, task);
    mockGenkitGenerate = testModel.ai.generate as ReturnType<typeof vi.fn>;
    vi.mocked(testModel.ai.defineTool).mockClear();
  });

  it("should instantiate without throwing error (due to genkit mock)", () => {
    expect(() => new TestModel({}, task)).not.toThrow();
  });

  describe("initializeTools", () => {
    it("should initialize tools and handlers correctly", () => {
      const mockToolDef: ToolDefinition = {
        name: "testTool",
        description: "A test tool",
        parameters: createToolParameters({}), // No required params here
      };
      const mockHandler = vi.fn().mockResolvedValue({ result: "ok" });
      const toolDefinitions: [ToolDefinition, (input: any) => Promise<any>][] =
        [[mockToolDef, mockHandler]];
      (testModel as any).initializeTools(toolDefinitions);
      expect((testModel as any).tools.length).toBe(1);
      expect((testModel as any).toolHandlers.has("testTool")).toBe(true);
      expect((testModel as any).toolHandlers.get("testTool")).toBe(mockHandler);
      expect(testModel.ai.defineTool).toHaveBeenCalledWith(
        mockToolDef,
        mockHandler
      );
    });

    it("should throw error for invalid tool definition", () => {
      const invalidToolDefinitions: any = [
        [{ description: "missing name" }, vi.fn()], // Missing name
      ];
      expect(() =>
        (testModel as any).initializeTools(invalidToolDefinitions)
      ).toThrow(/Invalid tool definition/);
    });
  });

  describe("generateWithTools", () => {
    let mockToolDef: ToolDefinition;
    let mockHandler: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockToolDef = {
        name: "testTool",
        description: "A test tool",
        parameters: createToolParameters(
          // Corrected: 'required' inside parameters
          {
            param1: { type: "string" },
          },
          ["param1"]
        ),
      };
      mockHandler = vi.fn().mockResolvedValue({ result: "tool success" });
      const toolDefinitions: [ToolDefinition, (input: any) => Promise<any>][] =
        [[mockToolDef, mockHandler]];
      (testModel as any).initializeTools(toolDefinitions);
    });

    it("should return response directly if no tool requests", async () => {
      // Removed : GenerateResponse annotation
      const mockResponse = {
        message: {
          role: "model",
          content: [{ text: "Final response" }],
          toolCalls: [],
          toolResponseParts: [],
          data: undefined,
          output: undefined,
          text: "Final response",
          media: [],
          toolResponses: () => [], // Changed to function returning array
          custom: {},
          metadata: {},
        } as any, // Cast message to any
        usage: { totalTokens: 10 },
        toolRequests: [], // Explicitly empty
      };
      mockGenkitGenerate.mockResolvedValue(mockResponse as any); // Cast entire response

      const generateOptions = { model: {} as any, prompt: "test prompt" };
      await testModel.generateWithTools(generateOptions);

      expect(mockGenkitGenerate).toHaveBeenCalledTimes(1);
      expect(mockGenkitGenerate).toHaveBeenCalledWith(generateOptions);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it("should handle a single tool request and return final response", async () => {
      const toolRequest: ToolRequestPart = {
        toolRequest: {
          name: "testTool",
          ref: "tool1",
          input: { param1: "value1" },
        },
      };
      // Removed : GenerateResponse annotation
      const initialResponse = {
        message: {
          role: "model",
          content: [toolRequest],
          toolCalls: [toolRequest],
          toolResponseParts: [],
          data: undefined,
          output: undefined,
          text: "", // Changed undefined to empty string
          media: [],
          toolResponses: () => [], // Changed to function returning array
          custom: {},
          metadata: {},
        } as any, // Cast message to any
        usage: { totalTokens: 20 },
        messages: [{ role: "user", content: [{ text: "initial prompt" }] }],
        toolRequests: [toolRequest],
      };
      // Removed : GenerateResponse annotation
      const finalResponse = {
        message: {
          role: "model",
          content: [{ text: "Final response" }],
          toolCalls: [],
          toolResponseParts: [],
          data: undefined,
          output: undefined,
          text: "Final response",
          media: [],
          toolResponses: () => [], // Changed to function returning array
          custom: {},
          metadata: {},
        } as any, // Cast message to any
        usage: { totalTokens: 30 },
        toolRequests: [],
        messages: [
          // Include expected message history for the second call
          { role: "user", content: [{ text: "initial prompt" }] },
          {
            role: "tool",
            content: [
              {
                toolResponse: {
                  name: "testTool",
                  ref: "tool1",
                  output: { result: "tool success" },
                },
              },
            ],
          },
          { role: "model", content: [{ text: "Final response" }] },
        ],
      };

      mockGenkitGenerate.mockResolvedValueOnce(initialResponse as any); // Cast entire response
      mockGenkitGenerate.mockResolvedValueOnce(finalResponse as any); // Cast entire response

      const generateOptions = { model: {} as any, prompt: "initial prompt" };
      await testModel.generateWithTools(generateOptions);

      expect(mockGenkitGenerate).toHaveBeenCalledTimes(2);
      expect(mockGenkitGenerate).toHaveBeenNthCalledWith(1, generateOptions);
      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith({ param1: "value1" });

      // Verify the options passed to the second generate call
      const expectedSecondCallOptions = {
        model: {} as any,
        messages: [
          { role: "user", content: [{ text: "initial prompt" }] }, // Original message history from initialResponse
          {
            role: "tool", // Tool response added
            content: [
              {
                toolResponse: {
                  name: "testTool",
                  ref: "tool1",
                  output: { result: "tool success" },
                },
              },
            ],
          },
        ],
        prompt: undefined, // Prompt should be cleared when messages are used
      };
      expect(mockGenkitGenerate).toHaveBeenNthCalledWith(
        2,
        expectedSecondCallOptions
      );
    });

    it("should handle tool request where handler is not found", async () => {
      const toolRequest: ToolRequestPart = {
        toolRequest: {
          name: "nonExistentTool",
          ref: "tool2",
          input: {},
        },
      };
      // Removed : GenerateResponse annotation
      const initialResponse = {
        message: {
          role: "model",
          content: [toolRequest],
          toolCalls: [toolRequest],
          toolResponseParts: [],
          data: undefined,
          output: undefined,
          text: "", // Changed undefined to empty string
          media: [],
          toolResponses: () => [], // Changed to function returning array
          custom: {},
          metadata: {},
        } as any, // Cast message to any
        usage: { totalTokens: 25 },
        messages: [{ role: "user", content: [{ text: "another prompt" }] }],
        toolRequests: [toolRequest],
      };
      // Removed : GenerateResponse annotation
      const finalResponse = {
        message: {
          role: "model",
          content: [{ text: "Final response" }],
          toolCalls: [],
          toolResponseParts: [],
          data: undefined,
          output: undefined,
          text: "Final response",
          media: [],
          toolResponses: () => [], // Changed to function returning array
          custom: {},
          metadata: {},
        } as any, // Cast message to any
        usage: { totalTokens: 35 },
        toolRequests: [],
        messages: [
          { role: "user", content: [{ text: "another prompt" }] },
          {
            role: "tool",
            content: [
              {
                toolResponse: {
                  name: "nonExistentTool",
                  ref: "tool2",
                  output: { error: "Tool not found: nonExistentTool" },
                },
              },
            ],
          },
          { role: "model", content: [{ text: "Final response" }] },
        ],
      };

      mockGenkitGenerate.mockResolvedValueOnce(initialResponse as any); // Cast entire response
      mockGenkitGenerate.mockResolvedValueOnce(finalResponse as any); // Cast entire response

      const generateOptions = { model: {} as any, prompt: "another prompt" };
      await testModel.generateWithTools(generateOptions);

      expect(mockGenkitGenerate).toHaveBeenCalledTimes(2);
      expect(mockHandler).not.toHaveBeenCalled(); // Original handler shouldn't be called

      // Verify the options passed to the second generate call
      const expectedSecondCallOptions = {
        model: {} as any,
        messages: [
          { role: "user", content: [{ text: "another prompt" }] },
          {
            role: "tool",
            content: [
              {
                toolResponse: {
                  name: "nonExistentTool",
                  ref: "tool2",
                  output: { error: "Tool not found: nonExistentTool" }, // Error response included
                },
              },
            ],
          },
        ],
        prompt: undefined,
      };
      expect(mockGenkitGenerate).toHaveBeenNthCalledWith(
        2,
        expectedSecondCallOptions
      );
    });

    it("should handle tool request where handler throws an error", async () => {
      const toolRequest: ToolRequestPart = {
        toolRequest: {
          name: "testTool",
          ref: "tool3",
          input: { param1: "error case" },
        },
      };
      // Removed : GenerateResponse annotation
      const initialResponse = {
        message: {
          role: "model",
          content: [toolRequest],
          toolCalls: [toolRequest],
          toolResponseParts: [],
          data: undefined,
          output: undefined,
          text: "", // Changed undefined to empty string
          media: [],
          toolResponses: () => [], // Changed to function returning array
          custom: {},
          metadata: {},
        } as any, // Cast message to any
        usage: { totalTokens: 40 },
        messages: [{ role: "user", content: [{ text: "error prompt" }] }],
        toolRequests: [toolRequest],
      };
      // Removed : GenerateResponse annotation
      const finalResponse = {
        message: {
          role: "model",
          content: [{ text: "Final response" }],
          toolCalls: [],
          toolResponseParts: [],
          data: undefined,
          output: undefined,
          text: "Final response",
          media: [],
          toolResponses: () => [], // Changed to function returning array
          custom: {},
          metadata: {},
        } as any, // Cast message to any
        usage: { totalTokens: 50 },
        toolRequests: [],
        messages: [
          { role: "user", content: [{ text: "error prompt" }] },
          {
            role: "tool",
            content: [
              {
                toolResponse: {
                  name: "testTool",
                  ref: "tool3",
                  output: { error: "Tool execution failed: Handler failed" }, // Match error structure
                },
              },
            ],
          },
          { role: "model", content: [{ text: "Final response" }] },
        ],
      };

      const handlerError = new Error("Handler failed");
      mockHandler.mockRejectedValueOnce(handlerError); // Make the handler throw
      mockGenkitGenerate.mockResolvedValueOnce(initialResponse as any); // Cast entire response
      mockGenkitGenerate.mockResolvedValueOnce(finalResponse as any); // Cast entire response

      const generateOptions = { model: {} as any, prompt: "error prompt" };
      await testModel.generateWithTools(generateOptions);

      expect(mockGenkitGenerate).toHaveBeenCalledTimes(2);
      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith({ param1: "error case" });

      // Verify the options passed to the second generate call
      const expectedSecondCallOptions = {
        model: {} as any,
        messages: [
          { role: "user", content: [{ text: "error prompt" }] },
          {
            role: "tool",
            content: [
              {
                toolResponse: {
                  name: "testTool",
                  ref: "tool3",
                  output: {
                    error: `Tool execution failed: ${handlerError.message}`, // Error response included
                  },
                },
              },
            ],
          },
        ],
        prompt: undefined,
      };
      expect(mockGenkitGenerate).toHaveBeenNthCalledWith(
        2,
        expectedSecondCallOptions
      );
    });
  });
});
