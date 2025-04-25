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

        if (pattern === "*") {
          return ["file1.txt", "another.js", "config.json"];
        }
        // Handle the transformed pattern for *.txt
        if (pattern === "**/*.txt") {
          return ["file1.txt"];
        }
        if (pattern === "nonexistent/**") {
          return [];
        }
        if (pattern === "error/pattern") {
          throw new Error("Mock FS error on glob");
        }
        if (pattern === "notarray/pattern") {
          return "not an array";
        }
        // Handle the transformed pattern
        if (pattern === "**/*.mockext") {
          return ["file.mockext", "another/dir/file.mockext"];
        }
        throw new Error(`Unexpected pattern for glob: ${pattern}`);
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
    expect(ListFiles.toolDefinition.name).toBe("LIST_FILES"); // Updated name
    expect(ListFiles.toolDefinition.description).toBe(
      "Lists files matching a glob pattern within the current working directory."
    );
    expect(ListFiles.toolDefinition.parameters).toEqual({
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description:
            "The glob pattern to match files against (e.g., 'src/**/*.ts', '**/*.ts'). Defaults to '*'.", // Updated description
        },
      },
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
  });

  it("toolMethod should invoke fs.glob with default pattern '*' when no pattern is provided", async () => {
    const toolArgs = ListFiles.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const rawParams = {}; // No pattern provided
    const parsedParams = ListFiles.parametersSchema.parse(rawParams); // Parse params to apply default

    const result = await toolMethod(parsedParams); // Use parsed params

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
      ["*", expectedOptions]
    );

    expect(result).toBe("file1.txt\nanother.js\nconfig.json");
  });

  it("toolMethod should invoke fs.glob with the specified pattern", async () => {
    const toolArgs = ListFiles.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const params = { pattern: "*.txt" };

    const result = await toolMethod(params);

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
      ["**/*.txt", expectedOptions] // Expect transformed pattern
    );

    expect(result).toBe("file1.txt");
  });

  it("toolMethod should return an empty string if glob returns an empty array", async () => {
    const toolArgs = ListFiles.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const params = { pattern: "nonexistent/**" };

    const result = await toolMethod(params);

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
      ["nonexistent/**", expectedOptions]
    );
    expect(result).toBe("");
  });

  it("toolMethod should return error if glob does not return an array", async () => {
    const toolArgs = ListFiles.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const params = { pattern: "notarray/pattern" };

    const result = await toolMethod(params);

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
      ["notarray/pattern", expectedOptions]
    );
    expect(result).toBe(
      "Error: Expected an array of file paths but received something else."
    );
  });

  it("toolMethod should return error message if fs.glob throws", async () => {
    const toolArgs = ListFiles.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const params = { pattern: "error/pattern" };

    const result = await toolMethod(params);

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
      ["error/pattern", expectedOptions]
    );
    expect(result).toBe(
      `Error executing glob pattern 'error/pattern' in /mock/cwd: Mock FS error on glob`
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error executing glob pattern:",
      expect.any(Error)
    );
  });

  it("toolMethod should log cwd, pattern, and options", async () => {
    const toolArgs = ListFiles.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const params = { pattern: "*.txt" };

    await toolMethod(params);

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
      "**/*.txt", // Expect transformed pattern
      "options:",
      expectedOptions
    );
  });

  it("toolMethod should transform simple *.ext pattern to **/*.ext", async () => {
    const toolArgs = ListFiles.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const params = { pattern: "*.mockext" }; // Simple pattern

    const result = await toolMethod(params);

    const expectedOptions: GlobOptions = {
      cwd: "/mock/cwd",
      nodir: true,
      ignore: ["node_modules/**", ".cassi/**", "dist/**"],
    };
    expect(mockTaskInstance.invoke).toHaveBeenCalledTimes(1);
    // Expect the pattern to be transformed
    expect(mockTaskInstance.invoke).toHaveBeenCalledWith(
      "fs",
      "glob",
      [],
      ["**/*.mockext", expectedOptions]
    );

    expect(result).toBe("file.mockext\nanother/dir/file.mockext");
    // Check console log for the *transformed* pattern
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "ListFiles toolMethod cwd:",
      "/mock/cwd",
      "pattern:",
      "**/*.mockext", // Transformed pattern
      "options:",
      expectedOptions
    );
  });

  it("toolMethod should pass the ignore option to fs.glob", async () => {
    const toolArgs = ListFiles.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const params = { pattern: "src/**/*.ts" }; // Example pattern

    await toolMethod(params);

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
      ["src/**/*.ts", expectedOptions] // Ensure the pattern and options are passed
    );
  });
});
