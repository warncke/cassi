import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { ReadFile } from "./ReadFile.js";
import { Models, GenerateModelOptions } from "../Models.js";
import { Task } from "../../task/Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import { genkit } from "genkit";
import { Repository } from "../../repository/Repository.js";

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
      if (toolName === "fs" && methodName === "readFile") {
        const methodArgs = args[0];
        const filePath = methodArgs[0];
        if (filePath === "/mock/cwd/empty.txt") {
          return null;
        }
        return `mock content for ${filePath}`;
      }
      throw new Error(`Unexpected tool invocation: ${toolName}.${methodName}`);
    }
  );
  getCwd = vi.fn(() => "/mock/cwd");

  constructor(cassi: Cassi) {
    super(cassi, null);
  }
}

class MockCoderModel extends Models {
  constructor(task: Task) {
    const mockPlugin = { name: "mockPlugin" };
    super(mockPlugin, task);
  }
  async generate(options: GenerateModelOptions): Promise<string> {
    return `mock coder response for ${options.prompt}`;
  }
}

const mockCassi = new MockCassi() as Cassi;
const mockTask = new MockTask(mockCassi);
const mockModelInstance = new MockCoderModel(mockTask);

describe("ReadFile", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
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

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("should have correct toolDefinition", () => {
    expect(ReadFile.toolDefinition).toBeDefined();
    expect(ReadFile.toolDefinition.name).toBe("READ_FILE");
    expect(ReadFile.toolDefinition.description).toBeDefined();
    expect(ReadFile.toolDefinition.inputSchema).toBeDefined();
    // Cast to ZodObject to access shape
    const inputSchema = ReadFile.toolDefinition.inputSchema as z.ZodObject<any>;
    expect(inputSchema.shape).toHaveProperty("path");
  });

  it("modelToolArgs should return correct structure", () => {
    const toolArgs = ReadFile.modelToolArgs(mockModelInstance);
    expect(toolArgs).toBeInstanceOf(Array);
    expect(toolArgs).toHaveLength(2);
    const toolDefinition = toolArgs[0];
    const toolMethod = toolArgs[1];
    expect(toolDefinition).toEqual(ReadFile.toolDefinition);
    expect(typeof toolMethod).toBe("function");
  });

  it("toolMethod should invoke fs.readFile via task.invoke and return content", async () => {
    const input = { path: "some/file.txt" };
    const toolArgs = ReadFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];

    const result = await toolMethod(input);

    expect(mockTask.invoke).toHaveBeenCalledTimes(1);
    expect(mockTask.invoke).toHaveBeenCalledWith(
      "fs",
      "readFile",
      [],
      ["/mock/cwd/some/file.txt"]
    );

    expect(result).toBe(`mock content for /mock/cwd/some/file.txt`);
  });

  it("toolMethod should handle empty file content", async () => {
    const input = { path: "empty.txt" };
    const toolArgs = ReadFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];

    const result = await toolMethod(input);

    expect(mockTask.invoke).toHaveBeenCalledTimes(1);
    expect(mockTask.invoke).toHaveBeenCalledWith(
      "fs",
      "readFile",
      [],
      ["/mock/cwd/empty.txt"]
    );

    expect(result).toBe("File read successfully, but it was empty.");
  });

  it("toolMethod should return 'File does not exist' when fs.readFile throws ENOENT", async () => {
    const input = { path: "nonexistent.txt" };
    const toolArgs = ReadFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];

    vi.mocked(mockTask.invoke).mockImplementationOnce(
      async (toolName, methodName, toolArgs, ...args) => {
        if (toolName === "fs" && methodName === "readFile") {
          const methodArgs = args[0];
          const filePath = methodArgs[0];
          if (filePath === "/mock/cwd/nonexistent.txt") {
            const error = new Error(
              "ENOENT: no such file or directory, open '/mock/cwd/nonexistent.txt'"
            );
            (error as any).code = "ENOENT";
            throw error;
          }
        }
        throw new Error(
          `Unexpected tool invocation: ${toolName}.${methodName}`
        );
      }
    );

    const result = await toolMethod(input);

    expect(mockTask.invoke).toHaveBeenCalledTimes(1);
    expect(mockTask.invoke).toHaveBeenCalledWith(
      "fs",
      "readFile",
      [],
      ["/mock/cwd/nonexistent.txt"]
    );

    expect(result).toBe("File does not exist");
  });
});
