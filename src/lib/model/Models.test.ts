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
  required,
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
        parameters: createToolParameters({}),
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
});
