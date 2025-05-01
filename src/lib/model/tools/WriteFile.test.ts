import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { WriteFile } from "./WriteFile.js";
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
      if (toolName === "fs" && methodName === "writeFile") {
        return Promise.resolve();
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

describe("WriteFile", () => {
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
    expect(WriteFile.toolDefinition).toBeDefined();
    expect(WriteFile.toolDefinition.name).toBe("WRITE_FILE");
    expect(WriteFile.toolDefinition.description).toBeDefined();
    expect(WriteFile.toolDefinition.inputSchema).toBeDefined();
    // Cast to ZodObject to access shape
    const inputSchema = WriteFile.toolDefinition
      .inputSchema as z.ZodObject<any>;
    expect(inputSchema.shape).toHaveProperty("path");
    expect(inputSchema.shape).toHaveProperty("content");
  });

  it("modelToolArgs should return correct structure", () => {
    const toolArgs = WriteFile.modelToolArgs(mockModelInstance);
    expect(toolArgs).toBeInstanceOf(Array);
    expect(toolArgs).toHaveLength(2);
    const toolDefinition = toolArgs[0];
    const toolMethod = toolArgs[1];
    expect(toolDefinition).toEqual(WriteFile.toolDefinition);
    expect(typeof toolMethod).toBe("function");
  });

  it("toolMethod should invoke fs.writeFile via task.invoke and return the file content", async () => {
    const input = { path: "some/new/file.txt", content: "Hello World" };
    const toolArgs = WriteFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];

    const result = await toolMethod(input);

    expect(mockTask.invoke).toHaveBeenCalledTimes(1);
    expect(mockTask.invoke).toHaveBeenCalledWith(
      "fs",
      "writeFile",
      [],
      ["/mock/cwd/some/new/file.txt", "Hello World"]
    );

    expect(result).toBe(input.content);
  });
});
