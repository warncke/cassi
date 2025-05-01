import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { ListFiles } from "./ListFiles.js";
import { Models, GenerateModelOptions } from "../Models.js";
import { Task } from "../../task/Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import { genkit } from "genkit";
import { Config } from "../../config/Config.js";
import { GlobOptions } from "glob";

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

class MockCassi {
  config = {
    configData: {
      srcDir: "mockSrcDir",
    },
  } as Config;
}
class MockTask extends Task {
  invoke = vi.fn(
    async (
      toolName: string,
      methodName: string,
      toolArgs?: any[],
      ...args: any[]
    ) => {
      if (toolName === "fs" && methodName === "glob") {
        const methodArgs = args[0];
        const pattern = methodArgs[0];
        const options: GlobOptions = methodArgs[1];

        expect(options.cwd).toBe("/mock/cwd");
        expect(options.nodir).toBe(true);
        expect(options.ignore).toEqual([
          "node_modules/**",
          ".cassi/**",
          "dist/**",
        ]);

        if (pattern === "**/*.{ts,json}") {
          return ["src/file1.ts", "config.json", "src/lib/util.ts"];
        }
        if (pattern === "nonexistent/pattern") {
          return [];
        }
        if (pattern === "error/pattern") {
          throw new Error("Mock FS error on glob");
        }
        if (pattern === "notarray/pattern") {
          return "not an array";
        }
        mockTaskInstance.invoke = vi.fn(
          async (
            toolName: string,
            methodName: string,
            toolArgs?: any[],
            ...args: any[]
          ) => {
            if (toolName === "fs" && methodName === "glob") {
              const methodArgs = args[0];
              const pattern = methodArgs[0];
              const options: GlobOptions = methodArgs[1];

              expect(options.cwd).toBe("/mock/cwd");
              expect(options.nodir).toBe(true);
              expect(options.ignore).toEqual([
                "node_modules/**",
                ".cassi/**",
                "dist/**",
              ]);

              if (pattern === "**/*.{ts,json}") {
                return ["src/file1.ts", "config.json", "src/lib/util.ts"];
              } else if (pattern === "nonexistent/pattern") {
                return [];
              } else if (pattern === "error/pattern") {
                throw new Error("Mock FS error on glob");
              } else if (pattern === "notarray/pattern") {
                return "not an array";
              }
              throw new Error(`Unexpected pattern for glob mock: ${pattern}`);
            }
            throw new Error(
              `Unexpected tool invocation in mock: ${toolName}.${methodName}`
            );
          }
        );

        throw new Error(`Unexpected pattern for glob mock: ${pattern}`);
      }
      throw new Error(
        `Unexpected tool invocation in mock: ${toolName}.${methodName}`
      );
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

const mockCassiInstance = new MockCassi() as Cassi;
const mockTaskInstance = new MockTask(mockCassiInstance);
const mockModelInstance = new MockCoderModel(mockTaskInstance);

describe("ListFiles", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (genkit as any).mockImplementation(() => ({
      ai: {
        generate: vi.fn(async (options: GenerateModelOptions) => ({
          text: () => `mock ai response for ${options.prompt}`,
          usage: () => ({ totalTokens: 10 }),
        })),
      },
    }));
    vi.mocked(mockTaskInstance.invoke).mockClear();
    vi.mocked(mockTaskInstance.getCwd).mockClear();
    vi.mocked(mockTaskInstance.getCwd).mockReturnValue("/mock/cwd");
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("should have correct toolDefinition", () => {
    expect(ListFiles.toolDefinition).toBeDefined();
    expect(ListFiles.toolDefinition.name).toBe("LIST_FILES");
    expect(ListFiles.toolDefinition.description).toBe(
      "Lists all *.ts and *.json files within the current working directory."
    );
    expect(ListFiles.toolDefinition.inputSchema).toBeDefined();
    // Cast to ZodObject to access shape
    const inputSchema = ListFiles.toolDefinition
      .inputSchema as z.ZodObject<any>;
    expect(Object.keys(inputSchema.shape).length).toBe(0);
  });

  it("modelToolArgs should return correct structure", () => {
    const toolArgs = ListFiles.modelToolArgs(mockModelInstance);
    expect(toolArgs).toBeInstanceOf(Array);
    expect(toolArgs).toHaveLength(2);
    const toolDefinition = toolArgs[0];
    const toolMethod = toolArgs[1];
    expect(toolDefinition).toEqual(ListFiles.toolDefinition);
    expect(typeof toolMethod).toBe("function");

    const boundMethod = toolMethod.bind(mockModelInstance);
    expect(typeof boundMethod).toBe("function");
  });

  it("toolMethod should invoke fs.glob with the hardcoded pattern '**/*.{ts,json}'", async () => {
    const toolArgs = ListFiles.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];

    const result = await toolMethod();

    const expectedPattern = "**/*.{ts,json}";
    const expectedOptions: GlobOptions = {
      cwd: "/mock/cwd",
      nodir: true,
      ignore: ["node_modules/**", ".cassi/**", "dist/**"],
    };
    expect(mockTaskInstance.invoke).toHaveBeenCalledTimes(1);
    expect(mockTaskInstance.invoke).toHaveBeenCalledWith(
      "fs",
      "glob",
      [],
      [expectedPattern, expectedOptions]
    );

    expect(result).toBe("src/file1.ts\nconfig.json\nsrc/lib/util.ts");
  });

  it("toolMethod should return 'Error: No Files Found' if glob returns an empty array", async () => {
    vi.mocked(mockTaskInstance.invoke).mockImplementationOnce(
      async (toolName, methodName, toolArgs, ...args) => {
        if (toolName === "fs" && methodName === "glob") {
          const methodArgs = args[0];
          const pattern = methodArgs[0];
          if (pattern === "**/*.{ts,json}") {
            return [];
          }
        }
        throw new Error("Unexpected mock invocation in empty array test");
      }
    );

    const toolArgs = ListFiles.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];

    const result = await toolMethod();

    const expectedPattern = "**/*.{ts,json}";
    const expectedOptions: GlobOptions = {
      cwd: "/mock/cwd",
      nodir: true,
      ignore: ["node_modules/**", ".cassi/**", "dist/**"],
    };
    expect(mockTaskInstance.invoke).toHaveBeenCalledTimes(1);
    expect(mockTaskInstance.invoke).toHaveBeenCalledWith(
      "fs",
      "glob",
      [],
      [expectedPattern, expectedOptions]
    );
    expect(result).toBe("Error: No Files Found");
  });

  it("toolMethod should return error if glob does not return an array", async () => {
    vi.mocked(mockTaskInstance.invoke).mockImplementationOnce(
      async (toolName, methodName, toolArgs, ...args) => {
        if (toolName === "fs" && methodName === "glob") {
          const methodArgs = args[0];
          const pattern = methodArgs[0];
          if (pattern === "**/*.{ts,json}") {
            return "not an array";
          }
        }
        throw new Error("Unexpected mock invocation in non-array test");
      }
    );
    const toolArgs = ListFiles.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];

    const result = await toolMethod();

    const expectedPattern = "**/*.{ts,json}";
    const expectedOptions: GlobOptions = {
      cwd: "/mock/cwd",
      nodir: true,
      ignore: ["node_modules/**", ".cassi/**", "dist/**"],
    };
    expect(mockTaskInstance.invoke).toHaveBeenCalledTimes(1);
    expect(mockTaskInstance.invoke).toHaveBeenCalledWith(
      "fs",
      "glob",
      [],
      [expectedPattern, expectedOptions]
    );
    expect(result).toBe(
      "Error: Expected an array of file paths but received something else."
    );
  });

  it("toolMethod should return error message if fs.glob throws", async () => {
    const mockError = new Error("Mock FS error on glob");
    vi.mocked(mockTaskInstance.invoke).mockImplementationOnce(
      async (toolName, methodName, toolArgs, ...args) => {
        if (toolName === "fs" && methodName === "glob") {
          const methodArgs = args[0];
          const pattern = methodArgs[0];
          if (pattern === "**/*.{ts,json}") {
            throw mockError;
          }
        }
        throw new Error("Unexpected mock invocation in error test");
      }
    );
    const toolArgs = ListFiles.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];

    const result = await toolMethod();

    const expectedPattern = "**/*.{ts,json}";
    const expectedOptions: GlobOptions = {
      cwd: "/mock/cwd",
      nodir: true,
      ignore: ["node_modules/**", ".cassi/**", "dist/**"],
    };
    expect(mockTaskInstance.invoke).toHaveBeenCalledTimes(1);
    expect(mockTaskInstance.invoke).toHaveBeenCalledWith(
      "fs",
      "glob",
      [],
      [expectedPattern, expectedOptions]
    );
    expect(result).toBe(
      `Error executing glob pattern '${expectedPattern}' in /mock/cwd: Mock FS error on glob`
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error executing glob pattern:",
      mockError
    );
  });

  it("toolMethod should pass the correct ignore option to fs.glob", async () => {
    const toolArgs = ListFiles.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];

    await toolMethod();

    const expectedPattern = "**/*.{ts,json}";
    const expectedOptions: GlobOptions = {
      cwd: "/mock/cwd",
      nodir: true,
      ignore: ["node_modules/**", ".cassi/**", "dist/**"],
    };
    expect(mockTaskInstance.invoke).toHaveBeenCalledTimes(1);
    expect(mockTaskInstance.invoke).toHaveBeenCalledWith(
      "fs",
      "glob",
      [],
      [expectedPattern, expectedOptions]
    );
  });
});
