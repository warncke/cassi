import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Coder } from "./Coder.js";
import { Models, GenerateModelOptions } from "../Models.js"; // Import base and options
import { Task } from "../../task/Task.js"; // Import Task
import { genkit } from "genkit"; // Import genkit only
import { defineTool } from "@genkit-ai/ai"; // defineTool comes from @genkit-ai/ai
import { z } from "zod"; // Import z

// --- Mocks ---
// Mock the Task class
vi.mock("../../task/Task.js");

// Mock the genkit function itself
const mockGenerate = vi.fn();
const mockDefineTool = vi.fn((def, handler) => {
  return { name: def.name, description: def.description, handler };
});
const mockAiObject = {
  generate: mockGenerate,
  defineTool: mockDefineTool, // this.ai.defineTool will use this mock
};
vi.mock("genkit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("genkit")>();
  return {
    ...actual,
    genkit: vi.fn(() => mockAiObject), // Mock the genkit() function
    // REMOVED: defineTool: actual.defineTool, // defineTool is not exported here
  };
});
// Mock the defineTool from @genkit-ai/ai as well, as it might be used internally by this.ai.defineTool
vi.mock("@genkit-ai/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@genkit-ai/ai")>();
  return {
    ...actual,
    defineTool: mockDefineTool, // Use the same mock for consistency
  };
});

// --- Test Suite ---
describe("Coder Model", () => {
  let mockTask: Task; // Declare mock task variable
  let coderInstance: Coder; // Instance of the class under test

  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
    mockGenerate.mockClear();
    mockDefineTool.mockClear();
    (genkit as ReturnType<typeof vi.fn>).mockClear(); // Clear the genkit mock itself

    // Create a mock Task instance
    mockTask = new (Task as any)("mock-coder-task") as Task;

    // Create a new instance of Coder, passing a dummy plugin object and mock task
    coderInstance = new Coder({}, mockTask);
  });

  afterEach(() => {
    // Restore mocks after each test
    vi.restoreAllMocks();
  });

  it("should extend the Models base class", () => {
    expect(coderInstance).toBeInstanceOf(Models);
  });

  it("should call the base class constructor and initialize 'ai' via mocked genkit", () => {
    expect(genkit).toHaveBeenCalledTimes(1);
    expect(coderInstance).toHaveProperty("ai");
    expect((coderInstance as any).ai).toBe(mockAiObject);
    expect((coderInstance as any).ai.generate).toBe(mockGenerate);
    expect((coderInstance as any).ai.defineTool).toBe(mockDefineTool);
  });

  it("should define the 'execute_command' tool correctly using the mocked defineTool", () => {
    expect(mockDefineTool).toHaveBeenCalledTimes(1);

    const toolDefinitionCall = mockDefineTool.mock.calls[0][0];
    const toolHandler = mockDefineTool.mock.calls[0][1];

    expect(toolDefinitionCall.name).toBe("execute_command");
    expect(toolDefinitionCall.description).toContain(
      "Request to execute a CLI command"
    );
    expect(toolDefinitionCall.inputSchema).toBeInstanceOf(z.ZodObject);
    expect(toolDefinitionCall.outputSchema).toBeInstanceOf(z.ZodString);

    const inputSchemaShape = toolDefinitionCall.inputSchema.shape;
    expect(inputSchemaShape.command).toBeInstanceOf(z.ZodString);
    expect(inputSchemaShape.requires_approval).toBeInstanceOf(z.ZodBoolean);

    expect(typeof toolHandler).toBe("function");

    expect(coderInstance.tools).toBeDefined();
    expect(Array.isArray(coderInstance.tools)).toBe(true);
    expect(coderInstance.tools.length).toBe(1);
    expect(coderInstance.tools[0].name).toBe("execute_command");
    expect(typeof coderInstance.tools[0].handler).toBe("function");
  });

  it("should call ai.generate with correct parameters in generate method", async () => {
    const mockResponse = { text: "Generated code", usage: { totalTokens: 10 } };
    mockGenerate.mockResolvedValue(mockResponse);

    const options: GenerateModelOptions = {
      model: "mockModelRef" as any,
      prompt: "Write a function",
    };
    const { model, prompt, ...restOptions } = options;

    await coderInstance.generate(options);

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerate).toHaveBeenCalledWith({
      model: model,
      prompt: expect.stringContaining(prompt as string),
      tools: coderInstance.tools,
      ...restOptions,
    });
  });

  it("should return the text content from the ai.generate response", async () => {
    const expectedText = "This is the generated code.";
    const mockResponse = { text: expectedText, usage: { totalTokens: 5 } };
    mockGenerate.mockResolvedValue(mockResponse);

    const options: GenerateModelOptions = {
      model: "mockModelRef" as any,
      prompt: "Generate something",
    };

    const result = await coderInstance.generate(options);
    expect(result).toBe(expectedText);
  });

  it("should log usage information if present in the response", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const mockUsage = { inputTokens: 5, outputTokens: 10, totalTokens: 15 };
    const mockResponse = { text: "Some text", usage: mockUsage };
    mockGenerate.mockResolvedValue(mockResponse);

    const options: GenerateModelOptions = {
      model: "mockModelRef" as any,
      prompt: "Generate with usage",
    };

    await coderInstance.generate(options);
    expect(consoleLogSpy).toHaveBeenCalledWith("AI Usage:", mockUsage);
    consoleLogSpy.mockRestore();
  });

  it("should return an empty string and warn if ai.generate response has no text", async () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    const mockResponse = { usage: { totalTokens: 2 } };
    mockGenerate.mockResolvedValue(mockResponse);

    const options: GenerateModelOptions = {
      model: "mockModelRef" as any,
      prompt: "Generate nothing",
    };

    const result = await coderInstance.generate(options);
    expect(result).toBe("");
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "AI response did not contain text content."
    );
    consoleWarnSpy.mockRestore();
  });

  it("should execute the placeholder logic in the execute_command tool handler", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(mockDefineTool).toHaveBeenCalled();
    const toolHandler = mockDefineTool.mock.calls[0][1];
    const input = { command: "ls -l", requires_approval: false };

    const result = await toolHandler(input);

    expect(result).toBe("Simulated output for command: ls -l");
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "Placeholder: Would execute command: ls -l (Requires Approval: false)"
    );
    consoleLogSpy.mockRestore();
  });
});
