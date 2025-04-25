import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Coder } from "./Coder.js";
import { Models, GenerateModelOptions } from "../Models.js";
import { Task } from "../../task/Task.js";
import { genkit } from "genkit";
import { ExecuteCommand } from "../tools/ExecuteCommand.js";

vi.mock("../../task/Task.js");

let modelToolArgsSpy: any;

const mockGenerate = vi.fn();
const mockDefineTool = vi.fn((toolDefinition, toolMethod) => {
  return {
    name: toolDefinition?.name,
    description: toolDefinition?.description,
    handler: toolMethod,
  };
});

const mockAiObject = {
  generate: mockGenerate,
  defineTool: mockDefineTool,
};

vi.mock("genkit", () => ({
  genkit: vi.fn(() => mockAiObject),
}));


describe("Coder Model", () => {
  let mockTask: Task;
  let coderInstance: Coder;
  const mockToolDefinition = {
    name: "mockDef",
    description: "mockDesc",
    parameters: {},
  };
  const mockToolMethod = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    mockGenerate.mockClear();
    mockDefineTool.mockClear();
    (genkit as ReturnType<typeof vi.fn>).mockClear();

    modelToolArgsSpy = vi.spyOn(ExecuteCommand, "modelToolArgs");
    modelToolArgsSpy.mockReturnValue([mockToolDefinition, mockToolMethod]);

    mockTask = new (Task as any)("mock-coder-task") as Task;

    coderInstance = new Coder({}, mockTask);
  });

  afterEach(() => {
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

  it("should call ExecuteCommand.modelToolArgs and pass its result spread into ai.defineTool", () => {
    expect(modelToolArgsSpy).toHaveBeenCalledTimes(1);
    expect(modelToolArgsSpy).toHaveBeenCalledWith(coderInstance);

    expect(mockDefineTool).toHaveBeenCalledTimes(1);

    expect(mockDefineTool).toHaveBeenCalledWith(
      mockToolDefinition,
      mockToolMethod
    );

    expect(coderInstance.tools).toBeDefined();
    expect(Array.isArray(coderInstance.tools)).toBe(true);
    expect(coderInstance.tools.length).toBe(1);
    expect(coderInstance.tools[0].name).toBe(mockToolDefinition.name);
    expect(coderInstance.tools[0].handler).toBe(mockToolMethod);
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
    expect(toolHandler).toBe(mockToolMethod);

    const input = { command: "ls -l", requires_approval: false };

    await toolHandler(input);

    expect(mockToolMethod).toHaveBeenCalledWith(input);

    expect(coderInstance.tools[0].handler).toBe(mockToolMethod);

    consoleLogSpy.mockRestore();
  });
});
