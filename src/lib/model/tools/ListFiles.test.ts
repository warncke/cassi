import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ListFiles } from "./ListFiles.js";
import { Models, GenerateModelOptions } from "../Models.js";
import { Task } from "../../task/Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import { genkit } from "genkit";
import { Config } from "../../config/Config.js";
import path from "path"; // Import path

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
  } as Config; // Keep mock config simple, srcDir not used by tool anymore
}
class MockTask extends Task {
  invoke = vi.fn(
    async (
      toolName: string,
      methodName: string,
      toolArgs?: any[],
      ...args: any[]
    ) => {
      if (toolName === "fs" && methodName === "listDirectory") {
        const methodArgs = args[0];
        const targetPath = methodArgs[0];
        const options = methodArgs[1]; // { recursive?: boolean } or undefined

        // Mock responses based on path and options
        if (targetPath === path.resolve("/mock/cwd", "test/dir")) {
          if (options?.recursive) {
            return ["file1.txt", "subdir", path.join("subdir", "file2.txt")];
          } else {
            return ["file1.txt", "subdir"];
          }
        }
        if (targetPath === path.resolve("/mock/cwd", "error/path")) {
          throw new Error("Mock FS error on listDirectory");
        }
        if (targetPath === path.resolve("/mock/cwd", "notarray/path")) {
          return "not an array";
        }
        throw new Error(`Unexpected path for listDirectory: ${targetPath}`);
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
    expect(ListFiles.toolDefinition.name).toBe("list_files"); // Updated name
    expect(ListFiles.toolDefinition.description).toBeDefined();
    expect(ListFiles.toolDefinition.parameters).toEqual({
      // Updated parameters schema
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The path of the directory to list contents for",
        },
        recursive: {
          type: "boolean",
          description:
            "Whether to list files recursively. Use true for recursive listing, false or omit for top-level only.",
        },
      },
      required: ["path"],
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

  it("toolMethod should invoke fs.listDirectory non-recursively by default", async () => {
    const toolArgs = ListFiles.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const params = { path: "test/dir" };

    const result = await toolMethod(params);

    const expectedPath = path.resolve("/mock/cwd", "test/dir");
    expect(mockTaskInstance.invoke).toHaveBeenCalledTimes(1);
    expect(mockTaskInstance.invoke).toHaveBeenCalledWith(
      "fs",
      "listDirectory",
      [],
      [expectedPath, undefined] // No options passed
    );

    expect(result).toBe("file1.txt\nsubdir");
  });

  it("toolMethod should invoke fs.listDirectory recursively when recursive is true", async () => {
    const toolArgs = ListFiles.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const params = { path: "test/dir", recursive: true };

    const result = await toolMethod(params);

    const expectedPath = path.resolve("/mock/cwd", "test/dir");
    expect(mockTaskInstance.invoke).toHaveBeenCalledTimes(1);
    expect(mockTaskInstance.invoke).toHaveBeenCalledWith(
      "fs",
      "listDirectory",
      [],
      [expectedPath, { recursive: true }] // Recursive option passed
    );

    expect(result).toBe(
      `file1.txt\nsubdir\n${path.join("subdir", "file2.txt")}`
    );
  });

  it("toolMethod should return error if listDirectory does not return an array", async () => {
    const toolArgs = ListFiles.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const params = { path: "notarray/path" }; // Path configured to return non-array

    const result = await toolMethod(params);

    const expectedPath = path.resolve("/mock/cwd", "notarray/path");
    expect(mockTaskInstance.invoke).toHaveBeenCalledTimes(1);
    expect(mockTaskInstance.invoke).toHaveBeenCalledWith(
      "fs",
      "listDirectory",
      [],
      [expectedPath, undefined]
    );
    expect(result).toBe(
      "Error: Expected an array of file/directory names but received something else."
    );
  });

  it("toolMethod should return error message if fs.listDirectory throws", async () => {
    const toolArgs = ListFiles.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const params = { path: "error/path" }; // Path configured to throw

    const result = await toolMethod(params);

    const expectedPath = path.resolve("/mock/cwd", "error/path");
    expect(mockTaskInstance.invoke).toHaveBeenCalledTimes(1);
    expect(mockTaskInstance.invoke).toHaveBeenCalledWith(
      "fs",
      "listDirectory",
      [],
      [expectedPath, undefined]
    );
    expect(result).toBe(
      `Error listing files/directories in ${expectedPath}: Mock FS error on listDirectory`
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error listing files/directories:",
      expect.any(Error)
    );
  });

  it("toolMethod should log cwd, params.path, targetPath, and options", async () => {
    const toolArgs = ListFiles.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const params = { path: "test/dir", recursive: true };

    await toolMethod(params);

    const expectedPath = path.resolve("/mock/cwd", "test/dir");
    const expectedOptions = { recursive: true };
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "ListFiles toolMethod cwd:",
      "/mock/cwd",
      "params.path:",
      "test/dir",
      "targetPath:",
      expectedPath,
      "options:",
      expectedOptions
    );
  });
});
