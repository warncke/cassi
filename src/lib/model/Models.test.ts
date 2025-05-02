import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { Models, GenerateModelOptions } from "./Models.js";
import { Task } from "../task/Task.js";
import { ToolDefinition } from "../tool/Tool.js";
import {
  genkit,
  GenkitError,
  GenerateResponse,
  MessageData,
  Part,
  ToolRequest,
  ToolResponse,
  ToolRequestPart,
  ToolResponsePart,
} from "genkit";

vi.mock("genkit", async (importOriginal) => {
  const original = await importOriginal<typeof import("genkit")>();
  return {
    ...original,
    genkit: vi.fn().mockReturnValue({
      generate: vi.fn(),
      defineTool: vi.fn((def, handler) => ({ ...def, handler })),
    }),
  };
});

vi.mock("../task/Task.js", () => ({
  Task: vi.fn().mockImplementation(() => ({
    config: { cwd: "/fake/path" },
  })),
}));

const createToolParameters = (
  properties: Record<string, z.ZodTypeAny>,
  required?: string[]
): z.ZodObject<any> => {
  return z.object(properties);
};

class TestModel extends Models {
  constructor(plugin: any, task: Task) {
    super(plugin, task);
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
        inputSchema: createToolParameters({}),
        outputSchema: z.object({}),
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
        [{ description: "missing name" }, vi.fn()],
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
        inputSchema: createToolParameters(
          {
            param1: z.string(),
          }
        ),
        outputSchema: z.object({ result: z.string() }),
      };
      mockHandler = vi.fn().mockResolvedValue({ result: "tool success" });
      const toolDefinitions: [ToolDefinition, (input: any) => Promise<any>][] =
        [[mockToolDef, mockHandler]];
      (testModel as any).initializeTools(toolDefinitions);
    });

    it("should return response directly if no tool requests", async () => {
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
          toolResponses: () => [],
          custom: {},
          metadata: {},
        } as any,
        usage: { totalTokens: 10 },
        toolRequests: [],
      };
      mockGenkitGenerate.mockResolvedValue(mockResponse as any);

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
      const initialResponse = {
        message: {
          role: "model",
          content: [toolRequest],
          toolCalls: [toolRequest],
          toolResponseParts: [],
          data: undefined,
          output: undefined,
          text: "",
          media: [],
          toolResponses: () => [],
          custom: {},
          metadata: {},
        } as any,
        usage: { totalTokens: 20 },
        messages: [{ role: "user", content: [{ text: "initial prompt" }] }],
        toolRequests: [toolRequest],
      };
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
          toolResponses: () => [],
          custom: {},
          metadata: {},
        } as any,
        usage: { totalTokens: 30 },
        toolRequests: [],
        messages: [
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

      mockGenkitGenerate.mockResolvedValueOnce(initialResponse as any);
      mockGenkitGenerate.mockResolvedValueOnce(finalResponse as any);

      const generateOptions = { model: {} as any, prompt: "initial prompt" };
      await testModel.generateWithTools(generateOptions);

      expect(mockGenkitGenerate).toHaveBeenCalledTimes(2);
      expect(mockGenkitGenerate).toHaveBeenNthCalledWith(1, generateOptions);
      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith({ param1: "value1" });

      const expectedSecondCallOptions = {
        model: {} as any,
        messages: [
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
        ],
        prompt: undefined,
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
      const initialResponse = {
        message: {
          role: "model",
          content: [toolRequest],
          toolCalls: [toolRequest],
          toolResponseParts: [],
          data: undefined,
          output: undefined,
          text: "",
          media: [],
          toolResponses: () => [],
          custom: {},
          metadata: {},
        } as any,
        usage: { totalTokens: 25 },
        messages: [{ role: "user", content: [{ text: "another prompt" }] }],
        toolRequests: [toolRequest],
      };
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
          toolResponses: () => [],
          custom: {},
          metadata: {},
        } as any,
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

      mockGenkitGenerate.mockResolvedValueOnce(initialResponse as any);
      mockGenkitGenerate.mockResolvedValueOnce(finalResponse as any);

      const generateOptions = { model: {} as any, prompt: "another prompt" };
      await testModel.generateWithTools(generateOptions);

      expect(mockGenkitGenerate).toHaveBeenCalledTimes(2);
      expect(mockHandler).not.toHaveBeenCalled();

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
                  output: { error: "Tool not found: nonExistentTool" },
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
      const initialResponse = {
        message: {
          role: "model",
          content: [toolRequest],
          toolCalls: [toolRequest],
          toolResponseParts: [],
          data: undefined,
          output: undefined,
          text: "",
          media: [],
          toolResponses: () => [],
          custom: {},
          metadata: {},
        } as any,
        usage: { totalTokens: 40 },
        messages: [{ role: "user", content: [{ text: "error prompt" }] }],
        toolRequests: [toolRequest],
      };
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
          toolResponses: () => [],
          custom: {},
          metadata: {},
        } as any,
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
                  output: { error: "Tool execution failed: Handler failed" },
                },
              },
            ],
          },
          { role: "model", content: [{ text: "Final response" }] },
        ],
      };

      const handlerError = new Error("Handler failed");
      mockHandler.mockRejectedValueOnce(handlerError);
      mockGenkitGenerate.mockResolvedValueOnce(initialResponse as any);
      mockGenkitGenerate.mockResolvedValueOnce(finalResponse as any);

      const generateOptions = { model: {} as any, prompt: "error prompt" };
      await testModel.generateWithTools(generateOptions);

      expect(mockGenkitGenerate).toHaveBeenCalledTimes(2);
      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith({ param1: "error case" });

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
                    error: `Tool execution failed: ${handlerError.message}`,
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
