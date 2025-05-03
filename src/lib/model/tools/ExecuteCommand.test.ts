import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { ExecuteCommand } from "./ExecuteCommand.js";
import { Models, GenerateModelOptions } from "../Models.js";
import { Task } from "../../task/Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import { genkit } from "genkit";

vi.mock("genkit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("genkit")>();
  return {
    ...actual,
    genkit: vi.fn(() => ({
      ai: {
        generate: vi.fn(async (options: GenerateModelOptions) => ({
          text: () => `mock ai response for ${options.prompt}`,
          usage: () => ({ totalTokens: 10 }),
        })),
      },
    })),
  };
});

class MockCassi {}
class MockTask extends Task {
  invoke = vi.fn(
    async (
      toolName: string,
      methodName: string,
      toolArgs?: any[],
      ...args: any[]
    ) => {
      if (toolName === "console" && methodName === "exec") {
        const command = args[0];
        return { stdout: `mock output for ${command}`, stderr: "" };
      }
      throw new Error(`Unexpected tool invocation: ${toolName}.${methodName}`);
    }
  );
  getCwd = vi.fn(() => "/mock/cwd");

  constructor(cassi: Cassi) {
    super(cassi);
  }
}

class MockCoderModel extends Models {
  constructor(task: Task) {
    super({}, task);
  }
  async generate(options: GenerateModelOptions): Promise<string> {
    return `mock coder response for ${options.prompt}`;
  }
}

const mockCassi = new MockCassi() as Cassi;
const mockTask = new MockTask(mockCassi);
const mockModelInstance = new MockCoderModel(mockTask);

describe("ExecuteCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (genkit as any).mockImplementation(() => ({
      ai: {
        generate: vi.fn(async (options: GenerateModelOptions) => ({
          text: () => `mock ai response for ${options.prompt}`,
          usage: () => ({ totalTokens: 10 }),
        })),
      },
    }));
    vi.mocked(mockTask.invoke).mockClear();
    vi.mocked(mockTask.getCwd).mockClear();
    vi.mocked(mockTask.getCwd).mockReturnValue("/mock/cwd");
  });

  it("should have correct toolDefinition", () => {
    expect(ExecuteCommand.toolDefinition).toBeDefined();
    expect(ExecuteCommand.toolDefinition.name).toBe("ExecuteCommand");
    expect(ExecuteCommand.toolDefinition.description).toBeDefined();
    expect(ExecuteCommand.toolDefinition.inputSchema).toBeDefined();
    const inputSchema = ExecuteCommand.toolDefinition
      .inputSchema as z.ZodObject<any>;
    expect(inputSchema.shape).toHaveProperty("command");
    expect(inputSchema.shape).toHaveProperty("requires_approval");
  });

  it("modelToolArgs should return correct structure", () => {
    const toolArgs = ExecuteCommand.modelToolArgs(mockModelInstance);
    expect(toolArgs).toBeInstanceOf(Array);
    expect(toolArgs).toHaveLength(2);
    const toolDefinition = toolArgs[0];
    const toolMethod = toolArgs[1];
    expect(toolDefinition).toEqual(ExecuteCommand.toolDefinition);
    expect(typeof toolMethod).toBe("function");
  });

  it("toolMethod should invoke console.exec via task.invoke and format output", async () => {
    const input = { command: "ls -l", requires_approval: false };
    const toolArgs = ExecuteCommand.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];

    const result = await toolMethod(input);

    expect(mockTask.invoke).toHaveBeenCalledTimes(1);
    expect(mockTask.invoke).toHaveBeenCalledWith(
      "console",
      "exec",
      [mockTask.getCwd()],
      [input.command]
    );

    expect(result).toBe(`STDOUT:\nmock output for ${input.command}`);
  });

  it("toolMethod should handle stderr output", async () => {
    const input = { command: "error-command", requires_approval: true };
    mockTask.invoke.mockResolvedValueOnce({
      stdout: "",
      stderr: "mock error output",
    });

    const toolArgs = ExecuteCommand.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const result = await toolMethod(input);

    expect(mockTask.invoke).toHaveBeenCalledTimes(1);
    expect(mockTask.invoke).toHaveBeenCalledWith(
      "console",
      "exec",
      [mockTask.getCwd()],
      [input.command]
    );
    expect(result).toBe("STDERR:\nmock error output");
  });

  it("toolMethod should handle combined stdout and stderr", async () => {
    const input = { command: "mixed-command", requires_approval: false };
    mockTask.invoke.mockResolvedValueOnce({
      stdout: "some output",
      stderr: "some error",
    });

    const toolArgs = ExecuteCommand.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const result = await toolMethod(input);

    expect(mockTask.invoke).toHaveBeenCalledTimes(1);
    expect(mockTask.invoke).toHaveBeenCalledWith(
      "console",
      "exec",
      [mockTask.getCwd()],
      [input.command]
    );
    expect(result).toBe("STDOUT:\nsome output\nSTDERR:\nsome error");
  });

  it("toolMethod should handle no output", async () => {
    const input = { command: "silent-command", requires_approval: false };
    mockTask.invoke.mockResolvedValueOnce({ stdout: "", stderr: "" });

    const toolArgs = ExecuteCommand.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const result = await toolMethod(input);

    expect(mockTask.invoke).toHaveBeenCalledTimes(1);
    expect(mockTask.invoke).toHaveBeenCalledWith(
      "console",
      "exec",
      [mockTask.getCwd()],
      [input.command]
    );
    expect(result).toBe("Command executed successfully with no output.");
  });
});
