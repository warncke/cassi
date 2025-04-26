import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Coder } from "./Coder.js";
import { Models, GenerateModelOptions } from "../Models.js";
import { Task } from "../../task/Task.js";
import { genkit } from "genkit";
import { ExecuteCommand } from "../tools/ExecuteCommand.js";
import { ReadFile } from "../tools/ReadFile.js";
import { WriteFile } from "../tools/WriteFile.js";
import { ReplaceInFile } from "../tools/ReplaceInFile.js";
import { RunBuild } from "../tools/RunBuild.js";
import { ListFiles } from "../tools/ListFiles.js";

vi.mock("../../task/Task.js");

let executeCommandModelToolArgsSpy: any;
let readFileModelToolArgsSpy: any;
let writeFileModelToolArgsSpy: any;
let replaceInFileModelToolArgsSpy: any;
let runBuildModelToolArgsSpy: any;
let listFilesModelToolArgsSpy: any;

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
  const mockReplaceInFileToolMethod = vi.fn();
  const mockReplaceInFileToolDefinition = {
    name: "mockReplaceInFileDef",
    description: "mockReplaceInFileDesc",
    parameters: {},
  };
  const mockRunBuildToolMethod = vi.fn();
  const mockRunBuildToolDefinition = {
    name: "mockRunBuildDef",
    description: "mockRunBuildDesc",
    parameters: {},
  };
  const mockListFilesToolMethod = vi.fn();
  const mockListFilesToolDefinition = {
    name: "mockListFilesDef",
    description: "mockListFilesDesc",
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

    replaceInFileModelToolArgsSpy = vi.spyOn(ReplaceInFile, "modelToolArgs");
    replaceInFileModelToolArgsSpy.mockReturnValue([
      mockReplaceInFileToolDefinition,
      mockReplaceInFileToolMethod,
    ]);

    runBuildModelToolArgsSpy = vi.spyOn(RunBuild, "modelToolArgs");
    runBuildModelToolArgsSpy.mockReturnValue([
      mockRunBuildToolDefinition,
      mockRunBuildToolMethod,
    ]);

    listFilesModelToolArgsSpy = vi.spyOn(ListFiles, "modelToolArgs");
    listFilesModelToolArgsSpy.mockReturnValue([
      mockListFilesToolDefinition,
      mockListFilesToolMethod,
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
    expect(replaceInFileModelToolArgsSpy).toHaveBeenCalledTimes(1);
    expect(replaceInFileModelToolArgsSpy).toHaveBeenCalledWith(coderInstance);
    expect(runBuildModelToolArgsSpy).toHaveBeenCalledTimes(1);
    expect(runBuildModelToolArgsSpy).toHaveBeenCalledWith(coderInstance);
    expect(listFilesModelToolArgsSpy).toHaveBeenCalledTimes(1);
    expect(listFilesModelToolArgsSpy).toHaveBeenCalledWith(coderInstance);

    expect(mockDefineTool).toHaveBeenCalledTimes(6);

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
      mockReplaceInFileToolDefinition,
      mockReplaceInFileToolMethod
    );
    expect(mockDefineTool).toHaveBeenNthCalledWith(
      5,
      mockRunBuildToolDefinition,
      mockRunBuildToolMethod
    );
    expect(mockDefineTool).toHaveBeenNthCalledWith(
      6,
      mockListFilesToolDefinition,
      mockListFilesToolMethod
    );

    expect(coderInstance.tools).toBeDefined();
    expect(Array.isArray(coderInstance.tools)).toBe(true);
    expect(coderInstance.tools.length).toBe(6); // Updated length
    expect(coderInstance.tools[0].name).toBe(mockToolDefinition.name);
    expect(coderInstance.tools[0].handler).toBe(mockExecuteCommandToolMethod);
    expect(coderInstance.tools[1].name).toBe(mockReadFileToolDefinition.name);
    expect(coderInstance.tools[1].handler).toBe(mockReadFileToolMethod);
    expect(coderInstance.tools[2].name).toBe(mockWriteFileToolDefinition.name);
    expect(coderInstance.tools[2].handler).toBe(mockWriteFileToolMethod);
    expect(coderInstance.tools[3].name).toBe(
      mockReplaceInFileToolDefinition.name
    );
    expect(coderInstance.tools[3].handler).toBe(mockReplaceInFileToolMethod);
    expect(coderInstance.tools[4].name).toBe(mockRunBuildToolDefinition.name);
    expect(coderInstance.tools[4].handler).toBe(mockRunBuildToolMethod);
    expect(coderInstance.tools[5].name).toBe(mockListFilesToolDefinition.name); // Added check for ListFiles
    expect(coderInstance.tools[5].handler).toBe(mockListFilesToolMethod);
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
      system: expect.any(String), // Add expectation for system prompt
      tools: coderInstance.tools,
      maxToolCallIterations: 100,
      ...restOptions,
    });
  });

  it("should pass maxToolCallIterations to ai.generate", async () => {
    const mockResponse = { text: "Generated code", usage: { totalTokens: 10 } };
    mockGenerate.mockResolvedValue(mockResponse);

    const options: GenerateModelOptions = {
      model: "mockModelRef" as any,
      prompt: "Test max iterations",
    };
    const { model, prompt, ...restOptions } = options;

    await coderInstance.generate(options);

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        maxToolCallIterations: 100,
      })
    );
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
    expect(mockDefineTool).toHaveBeenCalledTimes(6); // Updated count

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

    const replaceInFileHandler = mockDefineTool.mock.calls[3][1];
    expect(replaceInFileHandler).toBe(mockReplaceInFileToolMethod);

    const replaceInFileInput = {
      path: "existing.txt",
      diff: "<<<<<<< SEARCH\nold\n=======\nnew\n>>>>>>> REPLACE",
    };
    await replaceInFileHandler(replaceInFileInput);
    expect(mockReplaceInFileToolMethod).toHaveBeenCalledWith(
      replaceInFileInput
    );
    expect(coderInstance.tools[3].handler).toBe(mockReplaceInFileToolMethod);

    const runBuildHandler = mockDefineTool.mock.calls[4][1];
    expect(runBuildHandler).toBe(mockRunBuildToolMethod);

    const runBuildInput = {};
    await runBuildHandler(runBuildInput);
    expect(mockRunBuildToolMethod).toHaveBeenCalledWith(runBuildInput);
    expect(coderInstance.tools[4].handler).toBe(mockRunBuildToolMethod);

    const listFilesHandler = mockDefineTool.mock.calls[5][1]; // Get ListFiles handler
    expect(listFilesHandler).toBe(mockListFilesToolMethod);

    const listFilesInput = { path: ".", recursive: false }; // Sample ListFiles input
    await listFilesHandler(listFilesInput);
    expect(mockListFilesToolMethod).toHaveBeenCalledWith(listFilesInput); // Check ListFiles call
    expect(coderInstance.tools[5].handler).toBe(mockListFilesToolMethod); // Check ListFiles handler assignment

    consoleLogSpy.mockRestore();
  });
});
