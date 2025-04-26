import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
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
import { ToolDefinition } from "../../tool/Tool.js";

vi.mock("../../task/Task.js");

let executeCommandModelToolArgsSpy: any;
let readFileModelToolArgsSpy: any;
let writeFileModelToolArgsSpy: any;
let replaceInFileModelToolArgsSpy: any;
let runBuildModelToolArgsSpy: any;
let listFilesModelToolArgsSpy: any;

const mockGenerate = vi.fn();
const mockDefineTool = vi.fn((toolDefinition, handler) => {
  return toolDefinition;
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
  const mockExecuteCommandToolDefinition: ToolDefinition = {
    name: "EXECUTE_COMMAND",
    description: "Executes commands",
    parameters: { type: "object", properties: { command: { type: "string" } } },
  };
  const mockExecuteCommandToolMethod = vi
    .fn()
    .mockResolvedValue("Command output");

  const mockReadFileToolDefinition: ToolDefinition = {
    name: "READ_FILE",
    description: "Reads files",
    parameters: { type: "object", properties: { path: { type: "string" } } },
  };
  const mockReadFileToolMethod = vi.fn().mockResolvedValue("File content");

  const mockWriteFileToolDefinition: ToolDefinition = {
    name: "WRITE_FILE",
    description: "Writes files",
    parameters: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
    },
  };
  const mockWriteFileToolMethod = vi.fn().mockResolvedValue("File written");

  const mockReplaceInFileToolDefinition: ToolDefinition = {
    name: "REPLACE_IN_FILE",
    description: "Replaces content in files",
    parameters: {
      type: "object",
      properties: { path: { type: "string" }, diff: { type: "string" } },
    },
  };
  const mockReplaceInFileToolMethod = vi
    .fn()
    .mockResolvedValue("Content replaced");

  const mockRunBuildToolDefinition: ToolDefinition = {
    name: "RUN_BUILD",
    description: "Runs build",
    parameters: { type: "object", properties: {} },
  };
  const mockRunBuildToolMethod = vi.fn().mockResolvedValue("Build successful");

  const mockListFilesToolDefinition: ToolDefinition = {
    name: "LIST_FILES",
    description: "Lists files",
    parameters: { type: "object", properties: { path: { type: "string" } } },
  };
  const mockListFilesToolMethod = vi
    .fn()
    .mockResolvedValue(["file1.ts", "file2.ts"]);

  beforeEach(() => {
    vi.resetAllMocks();
    mockGenerate.mockClear();
    mockDefineTool.mockClear();
    (genkit as ReturnType<typeof vi.fn>).mockClear();

    executeCommandModelToolArgsSpy = vi
      .spyOn(ExecuteCommand, "modelToolArgs")
      .mockReturnValue([
        mockExecuteCommandToolDefinition,
        mockExecuteCommandToolMethod,
      ]);
    readFileModelToolArgsSpy = vi
      .spyOn(ReadFile, "modelToolArgs")
      .mockReturnValue([mockReadFileToolDefinition, mockReadFileToolMethod]);
    writeFileModelToolArgsSpy = vi
      .spyOn(WriteFile, "modelToolArgs")
      .mockReturnValue([mockWriteFileToolDefinition, mockWriteFileToolMethod]);
    replaceInFileModelToolArgsSpy = vi
      .spyOn(ReplaceInFile, "modelToolArgs")
      .mockReturnValue([
        mockReplaceInFileToolDefinition,
        mockReplaceInFileToolMethod,
      ]);
    runBuildModelToolArgsSpy = vi
      .spyOn(RunBuild, "modelToolArgs")
      .mockReturnValue([mockRunBuildToolDefinition, mockRunBuildToolMethod]);
    listFilesModelToolArgsSpy = vi
      .spyOn(ListFiles, "modelToolArgs")
      .mockReturnValue([mockListFilesToolDefinition, mockListFilesToolMethod]);

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
    expect(coderInstance.ai).toBe(mockAiObject);
    expect(coderInstance.ai.generate).toBe(mockGenerate);
    expect(coderInstance.ai.defineTool).toBe(mockDefineTool);
  });

  it("should call modelToolArgs for each tool, store handlers, and define tools with ai.defineTool", () => {
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
      mockExecuteCommandToolDefinition,
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

    expect((coderInstance as any).toolHandlers.get("EXECUTE_COMMAND")).toBe(
      mockExecuteCommandToolMethod
    );
    expect((coderInstance as any).toolHandlers.get("READ_FILE")).toBe(
      mockReadFileToolMethod
    );
    expect((coderInstance as any).toolHandlers.get("WRITE_FILE")).toBe(
      mockWriteFileToolMethod
    );
    expect((coderInstance as any).toolHandlers.get("REPLACE_IN_FILE")).toBe(
      mockReplaceInFileToolMethod
    );
    expect((coderInstance as any).toolHandlers.get("RUN_BUILD")).toBe(
      mockRunBuildToolMethod
    );
    expect((coderInstance as any).toolHandlers.get("LIST_FILES")).toBe(
      mockListFilesToolMethod
    );

    expect(coderInstance.tools).toBeDefined();
    expect(Array.isArray(coderInstance.tools)).toBe(true);
    expect(coderInstance.tools.length).toBe(6);
    expect(coderInstance.tools[0].name).toBe(
      mockExecuteCommandToolDefinition.name
    );
    expect(coderInstance.tools[5].name).toBe(mockListFilesToolDefinition.name);
  });

  it("should call ai.generate initially with correct parameters including returnToolRequests", async () => {
    const mockResponse = {
      text: () => "Generated code",
      usage: { totalTokens: 10 },
      toolRequests: [],
    };
    mockGenerate.mockResolvedValue(mockResponse);

    const options: GenerateModelOptions = {
      model: "mockModelRef" as any,
      prompt: "Write a function",
      messages: [
        { role: "user" as const, content: [{ text: "Initial message" }] },
      ],
    };
    const { model, prompt, messages, ...restOptions } = options;

    await coderInstance.generate(options);

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerate).toHaveBeenCalledWith({
      model: model,
      prompt: expect.any(String),
      tools: coderInstance.tools,
      returnToolRequests: true,
      messages: messages,
      ...restOptions,
    });
  });

  it("should return the final text content when no tool requests are made", async () => {
    const expectedText = "This is the final generated code.";
    const mockResponse = {
      text: () => expectedText,
      usage: { totalTokens: 5 },
      toolRequests: [],
    };
    mockGenerate.mockResolvedValue(mockResponse);

    const options: GenerateModelOptions = {
      model: "mockModelRef" as any,
      prompt: "Generate something simple",
    };

    const result = await coderInstance.generate(options);
    expect(result).toBe(expectedText);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("should log usage information from the final response", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const mockUsage = { inputTokens: 5, outputTokens: 10, totalTokens: 15 };
    const mockResponse = {
      text: () => "Some text",
      usage: mockUsage,
      toolRequests: [],
    };
    mockGenerate.mockResolvedValue(mockResponse);

    const options: GenerateModelOptions = {
      model: "mockModelRef" as any,
      prompt: "Generate with usage",
    };

    await coderInstance.generate(options);
    expect(consoleLogSpy).toHaveBeenCalledWith("AI Usage:", mockUsage);
    consoleLogSpy.mockRestore();
  });

  it("should return an empty string and warn if final response has no text", async () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    const mockResponse = { usage: { totalTokens: 2 }, toolRequests: [] };
    mockGenerate.mockResolvedValue(mockResponse);

    const options: GenerateModelOptions = {
      model: "mockModelRef" as any,
      prompt: "Generate nothing",
    };

    const result = await coderInstance.generate(options);
    expect(result).toBe("");
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "AI response did not contain text content in the final turn."
    );
    consoleWarnSpy.mockRestore();
  });

  it("should handle a single tool request, call the handler, log the call, and continue generation", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const toolInput = { command: "ls", requires_approval: false };
    const toolOutput = "file1\nfile2";
    const finalOutputText = "Okay, I listed the files.";
    const initialMessages = [
      { role: "user" as const, content: [{ text: "list files" }] },
    ];
    const messagesAfterToolRequest = [
      ...initialMessages,
      {
        role: "model",
        parts: [
          {
            toolRequest: {
              name: "EXECUTE_COMMAND",
              ref: "r1",
              input: toolInput,
            },
          },
        ],
      },
    ];

    mockGenerate
      .mockResolvedValueOnce({
        toolRequests: [
          {
            toolRequest: {
              name: "EXECUTE_COMMAND",
              ref: "r1",
              input: toolInput,
            },
          },
        ],
        messages: messagesAfterToolRequest,
        usage: { totalTokens: 10 },
      })
      .mockResolvedValueOnce({
        text: () => finalOutputText,
        toolRequests: [],
        usage: { totalTokens: 20 },
      });

    mockExecuteCommandToolMethod.mockResolvedValueOnce(toolOutput);

    const options: GenerateModelOptions = {
      model: "mockModelRef" as any,
      prompt: "Run ls",
      messages: initialMessages,
    };

    const result = await coderInstance.generate(options);

    expect(mockGenerate).toHaveBeenCalledTimes(2);

    const secondCallArgs = mockGenerate.mock.calls[1][0];

    expect(mockExecuteCommandToolMethod).toHaveBeenCalledTimes(1);
    expect(mockExecuteCommandToolMethod).toHaveBeenCalledWith(toolInput);

    expect(secondCallArgs).toEqual(
      expect.objectContaining({
        messages: messagesAfterToolRequest,
        prompt: [
          {
            toolResponse: {
              name: "EXECUTE_COMMAND",
              ref: "r1",
              output: toolOutput,
            },
          },
        ],
      })
    );
    expect(result).toBe(finalOutputText);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      `Calling tool: EXECUTE_COMMAND with input:`,
      toolInput
    );
    consoleLogSpy.mockRestore();
  });

  it("should handle multiple tool requests in one turn", async () => {
    const toolInput1 = { command: "pwd", requires_approval: false };
    const toolOutput1 = "/current/dir";
    const toolInput2 = { path: "file.txt" };
    const toolOutput2 = "file content";
    const finalOutputText = "Got dir and file content.";
    const initialMessages = [
      { role: "user" as const, content: [{ text: "get dir and read file" }] },
    ];
    const messagesAfterToolRequests = [
      ...initialMessages,
      {
        role: "model",
        parts: [
          {
            toolRequest: {
              name: "EXECUTE_COMMAND",
              ref: "r1",
              input: toolInput1,
            },
          },
          { toolRequest: { name: "READ_FILE", ref: "r2", input: toolInput2 } },
        ],
      },
    ];

    mockGenerate.mockResolvedValueOnce({
      toolRequests: [
        {
          toolRequest: {
            name: "EXECUTE_COMMAND",
            ref: "r1",
            input: toolInput1,
          },
        },
        { toolRequest: { name: "READ_FILE", ref: "r2", input: toolInput2 } },
      ],
      messages: messagesAfterToolRequests,
      usage: { totalTokens: 30 },
    });
    mockGenerate.mockResolvedValueOnce({
      text: () => finalOutputText,
      toolRequests: [],
      usage: { totalTokens: 40 },
    });

    mockExecuteCommandToolMethod.mockResolvedValueOnce(toolOutput1);
    mockReadFileToolMethod.mockResolvedValueOnce(toolOutput2);

    const options: GenerateModelOptions = {
      model: "mockModelRef" as any,
      prompt: "Run pwd and read file.txt",
      messages: initialMessages,
    };

    const result = await coderInstance.generate(options);

    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(mockExecuteCommandToolMethod).toHaveBeenCalledWith(toolInput1);
    expect(mockReadFileToolMethod).toHaveBeenCalledWith(toolInput2);
    expect(mockGenerate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        messages: messagesAfterToolRequests,
        prompt: [
          {
            toolResponse: {
              name: "EXECUTE_COMMAND",
              ref: "r1",
              output: toolOutput1,
            },
          },
          {
            toolResponse: { name: "READ_FILE", ref: "r2", output: toolOutput2 },
          },
        ],
      })
    );
    expect(result).toBe(finalOutputText);
  });

  it("should handle unknown tool request by returning an error response", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const toolInput = { some: "data" };
    const unknownToolName = "UNKNOWN_TOOL";
    const finalOutputText = "Couldn't find that tool.";
    const initialMessages = [
      { role: "user" as const, content: [{ text: "call unknown tool" }] },
    ];
    const messagesAfterToolRequest = [
      ...initialMessages,
      {
        role: "model",
        parts: [
          {
            toolRequest: { name: unknownToolName, ref: "r1", input: toolInput },
          },
        ],
      },
    ];

    mockGenerate.mockResolvedValueOnce({
      toolRequests: [
        { toolRequest: { name: unknownToolName, ref: "r1", input: toolInput } },
      ],
      messages: messagesAfterToolRequest,
      usage: { totalTokens: 10 },
    });
    mockGenerate.mockResolvedValueOnce({
      text: () => finalOutputText,
      toolRequests: [],
      usage: { totalTokens: 20 },
    });

    const options: GenerateModelOptions = {
      model: "mockModelRef" as any,
      prompt: "Call unknown tool",
      messages: initialMessages,
    };

    const result = await coderInstance.generate(options);

    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `Tool handler not found for: ${unknownToolName}`
    );
    expect(mockGenerate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        messages: messagesAfterToolRequest,
        prompt: [
          {
            toolResponse: {
              name: unknownToolName,
              ref: "r1",
              output: { error: `Tool not found: ${unknownToolName}` },
            },
          },
        ],
      })
    );
    expect(result).toBe(finalOutputText);
    consoleErrorSpy.mockRestore();
  });

  it("should handle tool execution error by returning an error response", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const toolInput = { command: "bad-command", requires_approval: false };
    const errorMsg = "Command failed";
    const finalOutputText = "The command failed.";
    const initialMessages = [
      { role: "user" as const, content: [{ text: "run bad command" }] },
    ];
    const messagesAfterToolRequest = [
      ...initialMessages,
      {
        role: "model",
        parts: [
          {
            toolRequest: {
              name: "EXECUTE_COMMAND",
              ref: "r1",
              input: toolInput,
            },
          },
        ],
      },
    ];

    mockGenerate.mockResolvedValueOnce({
      toolRequests: [
        {
          toolRequest: { name: "EXECUTE_COMMAND", ref: "r1", input: toolInput },
        },
      ],
      messages: messagesAfterToolRequest,
      usage: { totalTokens: 10 },
    });
    mockGenerate.mockResolvedValueOnce({
      text: () => finalOutputText,
      toolRequests: [],
      usage: { totalTokens: 20 },
    });

    const executionError = new Error(errorMsg);
    mockExecuteCommandToolMethod.mockRejectedValueOnce(executionError);

    const options: GenerateModelOptions = {
      model: "mockModelRef" as any,
      prompt: "Run bad command",
      messages: initialMessages,
    };

    const result = await coderInstance.generate(options);

    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(mockExecuteCommandToolMethod).toHaveBeenCalledWith(toolInput);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `Error executing tool EXECUTE_COMMAND:`,
      executionError
    );
    expect(mockGenerate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        messages: messagesAfterToolRequest,
        prompt: [
          {
            toolResponse: {
              name: "EXECUTE_COMMAND",
              ref: "r1",
              output: { error: `Tool execution failed: ${errorMsg}` },
            },
          },
        ],
      })
    );
    expect(result).toBe(finalOutputText);
    consoleErrorSpy.mockRestore();
  });
});
