import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path"; // Import path
import { PatchFile } from "./PatchFile.js";
import { Models, GenerateModelOptions } from "../Models.js";
import { Task } from "../../task/Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import { Repository } from "../../repository/Repository.js"; // Import Repository
import { genkit } from "genkit";
import fs from "fs/promises"; // Import the actual module

// Mock fs/promises
vi.mock("fs/promises", () => ({
  default: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
  },
}));

// Mock genkit
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

// Mock Repository
class MockRepository {
  repositoryDir = "/mock/repo"; // Mock repository directory
}

class MockCassi {
  repository = new MockRepository() as Repository; // Add repository mock
}
class MockTask extends Task {
  invoke = vi.fn(); // General mock for invoke
  getCwd = vi.fn(() => "/mock/cwd");

  constructor(cassi: Cassi) {
    super(cassi, null);
    this.cassi = cassi; // Ensure cassi is assigned
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

// Define expected error directory path
const expectedErrorDir = path.join(
  mockCassi.repository.repositoryDir,
  ".cassi",
  "errors",
  "patch"
);
const expectedPatchFilePath = path.join(expectedErrorDir, "patch.file");
const expectedOrigFilePath = path.join(expectedErrorDir, "orig.file");

describe("PatchFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockTask.invoke).mockClear();
    vi.mocked(mockTask.getCwd).mockClear();
    vi.mocked(mockTask.getCwd).mockReturnValue("/mock/cwd");

    // Default invoke mock (can be overridden in specific tests)
    vi.mocked(mockTask.invoke).mockImplementation(
      async (
        toolName: string,
        methodName: string,
        toolArgs?: any[],
        ...args: any[]
      ) => {
        if (toolName === "console" && methodName === "exec") {
          const [command] = args;
          // Default to success
          return Promise.resolve({
            stdout: `Mock stdout for: ${command}`,
            stderr: "",
            code: 0,
          });
        } else if (toolName === "fs") {
          // Mock fs operations to succeed by default
          if (methodName === "mkdir") return Promise.resolve();
          if (methodName === "writeFile") return Promise.resolve();
          if (methodName === "readFile")
            return Promise.resolve("mock original content");
        }
        throw new Error(
          `Unexpected default tool invocation: ${toolName}.${methodName}`
        );
      }
    );
  });

  // ... existing tests for toolDefinition and modelToolArgs ...
  it("should have correct toolDefinition", () => {
    expect(PatchFile.toolDefinition).toBeDefined();
    expect(PatchFile.toolDefinition.name).toBe("PATCH_FILE");
    expect(PatchFile.toolDefinition.description).toBeDefined();
    expect(PatchFile.toolDefinition.parameters).toBeDefined();
    expect(PatchFile.toolDefinition.parameters.properties).toHaveProperty(
      "path"
    );
    expect(PatchFile.toolDefinition.parameters.properties).toHaveProperty(
      "patchContent"
    );
    expect(PatchFile.toolDefinition.parameters.required).toEqual([
      "path",
      "patchContent",
    ]);
  });

  it("modelToolArgs should return correct structure", () => {
    const toolArgs = PatchFile.modelToolArgs(mockModelInstance);
    expect(toolArgs).toBeInstanceOf(Array);
    expect(toolArgs).toHaveLength(2);
    const toolDefinition = toolArgs[0];
    const toolMethod = toolArgs[1];
    expect(toolDefinition).toEqual(PatchFile.toolDefinition);
    expect(typeof toolMethod).toBe("function");
  });

  it("toolMethod should invoke console.exec and return success message", async () => {
    const input = {
      path: "some/file/to/patch.txt",
      patchContent: "--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new",
    };
    const toolArgs = PatchFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];

    const result = await toolMethod(input);

    const expectedCommand = `patch "/mock/cwd/some/file/to/patch.txt"`;
    const expectedFullPath = "/mock/cwd/some/file/to/patch.txt";

    expect(mockTask.invoke).toHaveBeenCalledTimes(1);
    expect(mockTask.invoke).toHaveBeenCalledWith(
      "console",
      "exec",
      [],
      [expectedCommand, input.patchContent]
    );

    expect(result).toContain(`Patch applied successfully to ${input.path}`);
    expect(result).toContain(`Mock stdout for: ${expectedCommand}`);
  });

  it("toolMethod should handle patch failure (non-zero exit), save error files, and return error message", async () => {
    const input = {
      path: "some/file/to/patch.txt",
      patchContent: "invalid patch content",
    };
    const toolArgs = PatchFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const mockStderr = "Patch failed!";
    const mockExitCode = 1;
    const mockOriginalContent = "This is the original file content.";
    const expectedFullPath = "/mock/cwd/some/file/to/patch.txt";

    // Mock console.exec failure
    vi.mocked(mockTask.invoke).mockResolvedValueOnce({
      stdout: "",
      stderr: mockStderr,
      code: mockExitCode,
    });

    // Mock fs.promises methods
    vi.mocked(fs.mkdir).mockResolvedValueOnce(undefined);
    vi.mocked(fs.writeFile)
      .mockResolvedValueOnce(undefined) // For patch file
      .mockResolvedValueOnce(undefined); // For original file
    vi.mocked(fs.readFile).mockResolvedValueOnce(mockOriginalContent);

    /* // Old implementation - removed
    vi.mocked(mockTask.invoke)
      // 1. console.exec fails
      .mockResolvedValueOnce({
        stdout: "",
        stderr: mockStderr,
        code: mockExitCode,
      })
      // 2. fs.mkdir succeeds
      .mockResolvedValueOnce(undefined) // Corresponds to fs.mkdir
      // 3. fs.writeFile (patch) succeeds
      .mockResolvedValueOnce(undefined) // Corresponds to fs.writeFile patch
      // 4. fs.readFile succeeds
      .mockResolvedValueOnce(mockOriginalContent) // Corresponds to fs.readFile
      // 5. fs.writeFile (orig) succeeds
      .mockResolvedValueOnce(undefined); // Corresponds to fs.writeFile orig

    vi.mocked(mockTask.invoke).mockImplementation(
      async (
        toolName: string,
        methodName: string,
        toolArgs?: any[],
        ...args: any[]
      ) => {
        // ... original implementation ...
      }
    );
    */

    const result = await toolMethod(input);

    const expectedErrorMessage = `Error applying patch: Patch command failed with exit code ${mockExitCode}. Stderr:\n${mockStderr}. Use WRITE_FILE tool to write the entire file instead.`;
    expect(result).toBe(expectedErrorMessage);

    // Verify calls
    // 1. console.exec
    expect(mockTask.invoke).toHaveBeenCalledTimes(1);
    expect(mockTask.invoke).toHaveBeenCalledWith(
      "console",
      "exec",
      [],
      [`patch "${expectedFullPath}"`, input.patchContent]
    );
    // 2. fs.mkdir
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.mkdir).toHaveBeenCalledWith(expectedErrorDir, {
      recursive: true,
    });
    // 3. fs.writeFile (patch)
    expect(fs.writeFile).toHaveBeenCalledTimes(2); // Called for patch and orig
    expect(fs.writeFile).toHaveBeenCalledWith(
      expectedPatchFilePath, // Use correct variable
      input.patchContent
    );
    // 4. fs.readFile
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(fs.readFile).toHaveBeenCalledWith(expectedFullPath, "utf-8");
    // 5. fs.writeFile (orig)
    expect(fs.writeFile).toHaveBeenCalledWith(
      expectedOrigFilePath, // Use correct variable
      mockOriginalContent
    );
  });

  it("toolMethod should handle patch failure and original file read failure", async () => {
    const input = {
      path: "some/file/to/patch.txt",
      patchContent: "invalid patch content",
    };
    const toolArgs = PatchFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const mockStderr = "Patch failed!";
    const mockExitCode = 1;
    const readErrorMessage = "Permission denied";
    const expectedFullPath = "/mock/cwd/some/file/to/patch.txt";

    // Mock console.exec failure
    vi.mocked(mockTask.invoke).mockResolvedValueOnce({
      stdout: "",
      stderr: mockStderr,
      code: mockExitCode,
    });

    // Mock fs.promises methods
    vi.mocked(fs.mkdir).mockResolvedValueOnce(undefined);
    vi.mocked(fs.writeFile)
      .mockResolvedValueOnce(undefined) // For patch file
      .mockResolvedValueOnce(undefined); // For orig error file
    vi.mocked(fs.readFile).mockRejectedValueOnce(new Error(readErrorMessage)); // Simulate read failure

    /* // Old implementation - removed
    vi.mocked(mockTask.invoke)
      // 1. console.exec fails
      .mockResolvedValueOnce({
        stdout: "",
        stderr: mockStderr,
        code: mockExitCode,
      })
      // 2. fs.mkdir succeeds
      .mockResolvedValueOnce(undefined) // Corresponds to fs.mkdir
      // 3. fs.writeFile (patch) succeeds
      .mockResolvedValueOnce(undefined) // Corresponds to fs.writeFile patch
      // 4. fs.readFile fails
      .mockRejectedValueOnce(new Error(readErrorMessage)) // Corresponds to fs.readFile
      // 5. fs.writeFile (orig error) succeeds
      .mockResolvedValueOnce(undefined); // Corresponds to fs.writeFile orig error

    vi.mocked(mockTask.invoke).mockImplementation(
      async (
        toolName: string,
        methodName: string,
        toolArgs?: any[],
        ...args: any[]
      ) => {
        // ... original implementation ...
      }
    );
    */

    const result = await toolMethod(input);

    const expectedFinalErrorMessage = `Error applying patch: Patch command failed with exit code ${mockExitCode}. Stderr:\n${mockStderr}. Use WRITE_FILE tool to write the entire file instead.`;
    expect(result).toBe(expectedFinalErrorMessage);

    // Verify calls
    expect(mockTask.invoke).toHaveBeenCalledTimes(1); // Only console.exec
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledTimes(2); // patch + orig error
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(fs.readFile).toHaveBeenCalledWith(expectedFullPath, "utf-8");
    expect(fs.writeFile).toHaveBeenCalledWith(
      expectedPatchFilePath, // Use correct variable
      input.patchContent
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      expectedOrigFilePath, // Use correct variable
      `Error reading original file: ${readErrorMessage}`
    );
  });

  it("toolMethod should handle console.exec throwing an error, save error files", async () => {
    const input = {
      path: "some/file/to/patch.txt",
      patchContent: "problematic patch content",
    };
    const toolArgs = PatchFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const mockInvokeError = new Error("Invocation failed spectacularly");
    const mockOriginalContent = "Original content here.";
    const expectedFullPath = "/mock/cwd/some/file/to/patch.txt";

    // Mock console.exec throwing
    vi.mocked(mockTask.invoke).mockRejectedValueOnce(mockInvokeError);

    // Mock fs.promises methods
    vi.mocked(fs.mkdir).mockResolvedValueOnce(undefined);
    vi.mocked(fs.writeFile)
      .mockResolvedValueOnce(undefined) // For patch file
      .mockResolvedValueOnce(undefined); // For original file
    vi.mocked(fs.readFile).mockResolvedValueOnce(mockOriginalContent);

    /* // Old implementation - removed
    vi.mocked(mockTask.invoke)
      // 1. console.exec throws
      .mockRejectedValueOnce(mockInvokeError) // Simulate invoke throwing
      // 2. fs.mkdir succeeds
      .mockResolvedValueOnce(undefined) // Corresponds to fs.mkdir
      // 3. fs.writeFile (patch) succeeds
      .mockResolvedValueOnce(undefined) // Corresponds to fs.writeFile patch
      // 4. fs.readFile succeeds
      .mockResolvedValueOnce(mockOriginalContent) // Corresponds to fs.readFile
      // 5. fs.writeFile (orig) succeeds
      .mockResolvedValueOnce(undefined); // Corresponds to fs.writeFile orig

    vi.mocked(mockTask.invoke).mockImplementation(
      async (
        toolName: string,
        methodName: string,
        toolArgs?: any[],
        ...args: any[]
      ) => {
        // ... original implementation ...
      }
    );
    */

    const result = await toolMethod(input);

    const expectedFinalErrorMessage = `Error applying patch: ${mockInvokeError.message}. Use WRITE_FILE tool to write the entire file instead.`;
    expect(result).toBe(expectedFinalErrorMessage);

    // Verify calls - fs calls happen *after* console.exec fails
    expect(mockTask.invoke).toHaveBeenCalledTimes(1); // Only console.exec
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.mkdir).toHaveBeenCalledWith(expectedErrorDir, {
      recursive: true,
    });
    expect(fs.writeFile).toHaveBeenCalledTimes(2); // patch + orig
    expect(fs.writeFile).toHaveBeenCalledWith(
      expectedPatchFilePath, // Use correct variable
      input.patchContent
    );
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(fs.readFile).toHaveBeenCalledWith(expectedFullPath, "utf-8");
    expect(fs.writeFile).toHaveBeenCalledWith(
      expectedOrigFilePath, // Use correct variable
      mockOriginalContent
    );
  });
});
