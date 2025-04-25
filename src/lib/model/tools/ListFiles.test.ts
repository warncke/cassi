import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
        // Check if ignore option is present and correct based on the tool's implementation
        expect(options.ignore).toEqual([
          "node_modules/**",
          ".cassi/**",
          "dist/**",
        ]);

        if (pattern === "**/*.{ts,json}") {
          // Simulate finding some TS and JSON files
          return ["src/file1.ts", "config.json", "src/lib/util.ts"];
        }
        if (pattern === "nonexistent/pattern") {
          // Keep a case for testing empty results
          return [];
        }
        if (pattern === "error/pattern") {
          // Keep a case for testing errors
          throw new Error("Mock FS error on glob");
        }
        if (pattern === "notarray/pattern") {
          // Keep a case for testing non-array results
          return "not an array";
        }
        // Modify the mock invoke to handle the specific pattern or throw error
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
                // Default success case
                return ["src/file1.ts", "config.json", "src/lib/util.ts"];
              } else if (pattern === "nonexistent/pattern") {
                // Case for testing empty results
                return [];
              } else if (pattern === "error/pattern") {
                // Case for testing errors
                throw new Error("Mock FS error on glob");
              } else if (pattern === "notarray/pattern") {
                // Case for testing non-array results
                return "not an array";
              }
              // If the pattern doesn't match expected test cases, throw an error
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
    // Config is no longer directly used by the tool method
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("should have correct toolDefinition", () => {
    expect(ListFiles.toolDefinition).toBeDefined();
    expect(ListFiles.toolDefinition.name).toBe("LIST_FILES");
    expect(ListFiles.toolDefinition.description).toBe(
      "Lists all *.ts and *.json files within the current working directory." // Updated description
    );
    expect(ListFiles.toolDefinition.parameters).toEqual({
      type: "object",
      properties: {}, // No properties
      required: [],
    });
  });

  it("modelToolArgs should return correct structure", () => {
    const toolArgs = ListFiles.modelToolArgs(mockModelInstance);
    expect(toolArgs).toBeInstanceOf(Array);
    expect(toolArgs).toHaveLength(2);
    const toolDefinition = toolArgs[0];
    const toolMethod = toolArgs[1];
    expect(toolDefinition).toEqual(ListFiles.toolDefinition);
    expect(typeof toolMethod).toBe("function");

    // Test the actual method bound to the model instance
    const boundMethod = toolMethod.bind(mockModelInstance);
    expect(typeof boundMethod).toBe("function");
  });

  it("toolMethod should invoke fs.glob with the hardcoded pattern '**/*.{ts,json}'", async () => {
    const toolArgs = ListFiles.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];

    // Call the method directly without params
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

    expect(result).toBe("src/file1.ts\nconfig.json\nsrc/lib/util.ts"); // Based on updated mock
  });

  it("toolMethod should return 'Error: No Files Found' if glob returns an empty array", async () => {
    // Override mock for this specific test
    vi.mocked(mockTaskInstance.invoke).mockImplementationOnce(
      async (toolName, methodName, toolArgs, ...args) => {
        if (toolName === "fs" && methodName === "glob") {
          const methodArgs = args[0];
          const pattern = methodArgs[0];
          if (pattern === "**/*.{ts,json}") {
            return []; // Simulate no files found
          }
        }
        throw new Error("Unexpected mock invocation in empty array test");
      }
    );

    const toolArgs = ListFiles.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];

    const result = await toolMethod(); // No params

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
    // Override mock for this specific test
    vi.mocked(mockTaskInstance.invoke).mockImplementationOnce(
      async (toolName, methodName, toolArgs, ...args) => {
        if (toolName === "fs" && methodName === "glob") {
          const methodArgs = args[0];
          const pattern = methodArgs[0];
          if (pattern === "**/*.{ts,json}") {
            return "not an array"; // Simulate invalid response
          }
        }
        throw new Error("Unexpected mock invocation in non-array test");
      }
    );
    const toolArgs = ListFiles.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];

    const result = await toolMethod(); // No params

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
    // Override mock for this specific test
    const mockError = new Error("Mock FS error on glob");
    vi.mocked(mockTaskInstance.invoke).mockImplementationOnce(
      async (toolName, methodName, toolArgs, ...args) => {
        if (toolName === "fs" && methodName === "glob") {
          const methodArgs = args[0];
          const pattern = methodArgs[0];
          if (pattern === "**/*.{ts,json}") {
            throw mockError; // Simulate error
          }
        }
        throw new Error("Unexpected mock invocation in error test");
      }
    );
    const toolArgs = ListFiles.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];

    const result = await toolMethod(); // No params

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

  it("toolMethod should log cwd, pattern, and options", async () => {
    const toolArgs = ListFiles.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];

    await toolMethod(); // No params

    const expectedPattern = "**/*.{ts,json}";
    const expectedOptions: GlobOptions = {
      cwd: "/mock/cwd",
      nodir: true,
      ignore: ["node_modules/**", ".cassi/**", "dist/**"],
    };
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "ListFiles toolMethod cwd:",
      "/mock/cwd",
      "pattern:",
      expectedPattern, // Expect hardcoded pattern
      "options:",
      expectedOptions
    );
  });

  // Remove tests related to pattern transformation as it's no longer relevant
  // it("toolMethod should transform simple *.ext pattern to **/*.ext", async () => { ... });

  it("toolMethod should pass the correct ignore option to fs.glob", async () => {
    const toolArgs = ListFiles.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];

    await toolMethod(); // No params

    const expectedPattern = "**/*.{ts,json}";
    const expectedOptions: GlobOptions = {
      cwd: "/mock/cwd",
      nodir: true,
      ignore: ["node_modules/**", ".cassi/**", "dist/**"], // Verify this specific ignore list
    };
    expect(mockTaskInstance.invoke).toHaveBeenCalledTimes(1);
    expect(mockTaskInstance.invoke).toHaveBeenCalledWith(
      "fs",
      "glob",
      [],
      [expectedPattern, expectedOptions] // Ensure the pattern and options are passed
    );
  });
});
