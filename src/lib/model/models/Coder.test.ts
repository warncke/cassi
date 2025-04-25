import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Coder } from "./Coder.js";
import { Models, GenerateModelOptions } from "../Models.js";
import { Task } from "../../task/Task.js";
import { genkit } from "genkit";
import { ExecuteCommand } from "../tools/ExecuteCommand.js";
import { ReadFile } from "../tools/ReadFile.js";
import { WriteFile } from "../tools/WriteFile.js";
import { PatchFile } from "../tools/PatchFile.js";

vi.mock("../../task/Task.js");

let executeCommandModelToolArgsSpy: any;
let readFileModelToolArgsSpy: any;
let writeFileModelToolArgsSpy: any;
let patchFileModelToolArgsSpy: any;

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
  const mockExecuteCommandToolMethod = vi.fn();
  const mockReadFileToolMethod = vi.fn();
  const mockReadFileToolDefinition = {
    name: "mockReadFileDef",
    description: "mockReadFileDesc",
    parameters: {},
  };
  const mockWriteFileToolMethod = vi.fn();
  const mockWriteFileToolDefinition = {
    name: "mockWriteFileDef",
    description: "mockWriteFileDesc",
    parameters: {},
  };
  const mockPatchFileToolMethod = vi.fn();
  const mockPatchFileToolDefinition = {
    name: "mockPatchFileDef",
    description: "mockPatchFileDesc",
    parameters: {},
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockGenerate.mockClear();
    mockDefineTool.mockClear();
    (genkit as ReturnType<typeof vi.fn>).mockClear();

    executeCommandModelToolArgsSpy = vi.spyOn(ExecuteCommand, "modelToolArgs");
    executeCommandModelToolArgsSpy.mockReturnValue([
      mockToolDefinition,
      mockExecuteCommandToolMethod,
    ]);

    readFileModelToolArgsSpy = vi.spyOn(ReadFile, "modelToolArgs");
    readFileModelToolArgsSpy.mockReturnValue([
      mockReadFileToolDefinition,
      mockReadFileToolMethod,
    ]);

    writeFileModelToolArgsSpy = vi.spyOn(WriteFile, "modelToolArgs");
    writeFileModelToolArgsSpy.mockReturnValue([
      mockWriteFileToolDefinition,
      mockWriteFileToolMethod,
    ]);

    patchFileModelToolArgsSpy = vi.spyOn(PatchFile, "modelToolArgs");
    patchFileModelToolArgsSpy.mockReturnValue([
      mockPatchFileToolDefinition,
      mockPatchFileToolMethod,
    ]);

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

  it("should call modelToolArgs for each tool and pass results to ai.defineTool", () => {
    expect(executeCommandModelToolArgsSpy).toHaveBeenCalledTimes(1);
    expect(executeCommandModelToolArgsSpy).toHaveBeenCalledWith(coderInstance);
    expect(readFileModelToolArgsSpy).toHaveBeenCalledTimes(1);
    expect(readFileModelToolArgsSpy).toHaveBeenCalledWith(coderInstance);
    expect(writeFileModelToolArgsSpy).toHaveBeenCalledTimes(1);
    expect(writeFileModelToolArgsSpy).toHaveBeenCalledWith(coderInstance);
    expect(patchFileModelToolArgsSpy).toHaveBeenCalledTimes(1);
    expect(patchFileModelToolArgsSpy).toHaveBeenCalledWith(coderInstance);

    expect(mockDefineTool).toHaveBeenCalledTimes(4);

    expect(mockDefineTool).toHaveBeenNthCalledWith(
      1,
      mockToolDefinition,
      mockExecuteCommandToolMethod
    );
    expect(mockDefineTool).toHaveBeenNthCalledWith(
      2,
      mockReadFileToolDefinition,
      mockReadFileToolMethod
    );
    expect(mockDefineTool).toHaveBeenNthCalledWith(
      3,
      mockWriteFileToolDefinition,
      mockWriteFileToolMethod
    );
    expect(mockDefineTool).toHaveBeenNthCalledWith(
      4,
      mockPatchFileToolDefinition,
      mockPatchFileToolMethod
    );

    expect(coderInstance.tools).toBeDefined();
    expect(Array.isArray(coderInstance.tools)).toBe(true);
    expect(coderInstance.tools.length).toBe(4);
    expect(coderInstance.tools[0].name).toBe(mockToolDefinition.name);
    expect(coderInstance.tools[0].handler).toBe(mockExecuteCommandToolMethod);
    expect(coderInstance.tools[1].name).toBe(mockReadFileToolDefinition.name);
    expect(coderInstance.tools[1].handler).toBe(mockReadFileToolMethod);
    expect(coderInstance.tools[2].name).toBe(mockWriteFileToolDefinition.name);
    expect(coderInstance.tools[2].handler).toBe(mockWriteFileToolMethod);
    expect(coderInstance.tools[3].name).toBe(mockPatchFileToolDefinition.name);
    expect(coderInstance.tools[3].handler).toBe(mockPatchFileToolMethod);
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

  it("should execute the placeholder logic in the tool handlers", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(mockDefineTool).toHaveBeenCalledTimes(4);

    const executeCommandHandler = mockDefineTool.mock.calls[0][1];
    expect(executeCommandHandler).toBe(mockExecuteCommandToolMethod);

    const executeCommandInput = { command: "ls -l", requires_approval: false };
    await executeCommandHandler(executeCommandInput);
    expect(mockExecuteCommandToolMethod).toHaveBeenCalledWith(
      executeCommandInput
    );
    expect(coderInstance.tools[0].handler).toBe(mockExecuteCommandToolMethod);

    const readFileHandler = mockDefineTool.mock.calls[1][1];
    expect(readFileHandler).toBe(mockReadFileToolMethod);

    const readFileInput = { path: "test.txt" };
    await readFileHandler(readFileInput);
    expect(mockReadFileToolMethod).toHaveBeenCalledWith(readFileInput);
    expect(coderInstance.tools[1].handler).toBe(mockReadFileToolMethod);

    const writeFileHandler = mockDefineTool.mock.calls[2][1];
    expect(writeFileHandler).toBe(mockWriteFileToolMethod);

    const writeFileInput = { path: "new.txt", content: "hello world" };
    await writeFileHandler(writeFileInput);
    expect(mockWriteFileToolMethod).toHaveBeenCalledWith(writeFileInput);
    expect(coderInstance.tools[2].handler).toBe(mockWriteFileToolMethod);

    const patchFileHandler = mockDefineTool.mock.calls[3][1];
    expect(patchFileHandler).toBe(mockPatchFileToolMethod);

    const patchFileInput = {
      path: "existing.txt",
      patch: "--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+new",
    };
    await patchFileHandler(patchFileInput);
    expect(mockPatchFileToolMethod).toHaveBeenCalledWith(patchFileInput);
    expect(coderInstance.tools[3].handler).toBe(mockPatchFileToolMethod);

    consoleLogSpy.mockRestore();
  });
});
