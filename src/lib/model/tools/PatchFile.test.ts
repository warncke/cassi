import { describe, it, expect, vi, beforeEach } from "vitest";
import { PatchFile } from "./PatchFile.js";
// No longer mocking ExecuteCommand directly
// import { ExecuteCommand } from "./ExecuteCommand.js";
import { Models, GenerateModelOptions } from "../Models.js";
import { Task } from "../../task/Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import { genkit } from "genkit";

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

// No need to mock ExecuteCommand anymore

class MockCassi {}
class MockTask extends Task {
  // Mock invoke specifically for console.exec
  invoke = vi.fn(
    async (
      toolName: string,
      methodName: string,
      toolArgs?: any[],
      ...args: any[]
    ) => {
      if (toolName === "console" && methodName === "exec") {
        const [command, stdinData] = args;
        // Simulate successful patch command execution
        return Promise.resolve({
          stdout: `Mock stdout for: ${command}`,
          stderr: "",
          code: 0,
        });
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

describe("PatchFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset genkit mock if needed
    // Reset task invoke mock
    vi.mocked(mockTask.invoke).mockClear();
    vi.mocked(mockTask.invoke).mockImplementation(
      async (
        toolName: string,
        methodName: string,
        toolArgs?: any[],
        ...args: any[]
      ) => {
        if (toolName === "console" && methodName === "exec") {
          const [command, stdinData] = args;
          return Promise.resolve({
            stdout: `Mock stdout for: ${command}`,
            stderr: "",
            code: 0,
          });
        }
        throw new Error(
          `Unexpected tool invocation: ${toolName}.${methodName}`
        );
      }
    );
    vi.mocked(mockTask.getCwd).mockClear();
    vi.mocked(mockTask.getCwd).mockReturnValue("/mock/cwd");
  });

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

  it("toolMethod should invoke ExecuteCommand.toolMethod and return success message", async () => {
    const input = {
      path: "some/file/to/patch.txt",
      patchContent: "--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new",
    };
    const toolArgs = PatchFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];

    const result = await toolMethod(input);

    const expectedCommand = `patch "/mock/cwd/some/file/to/patch.txt"`;

    expect(mockTask.invoke).toHaveBeenCalledTimes(1);
    expect(mockTask.invoke).toHaveBeenCalledWith(
      "console",
      "exec",
      [],
      [expectedCommand, input.patchContent]
    );

    expect(result).toContain(`Patch applied successfully to ${input.path}`);
    expect(result).toContain(`Mock stdout for: ${expectedCommand}`); // Check for the mocked output part
  });

  it("toolMethod should handle errors from console.exec (non-zero exit code)", async () => {
    const input = {
      path: "some/file/to/patch.txt",
      patchContent: "invalid patch content",
    };
    const toolArgs = PatchFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const mockStderr = "Patch failed!";
    const mockExitCode = 1;

    // Mock task.invoke to return an error state
    vi.mocked(mockTask.invoke).mockResolvedValueOnce({
      stdout: "",
      stderr: mockStderr,
      code: mockExitCode,
    });

    await expect(toolMethod(input)).rejects.toThrow(
      `Failed to apply patch to ${input.path}: Patch command failed with exit code ${mockExitCode}. Stderr:\n${mockStderr}`
    );

    expect(mockTask.invoke).toHaveBeenCalledTimes(1);
  });

  it("toolMethod should handle errors thrown by task.invoke itself", async () => {
    const input = {
      path: "some/file/to/patch.txt",
      patchContent: "invalid patch content",
    };
    const toolArgs = PatchFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];

    // Mock task.invoke to throw an error
    const mockError = new Error("Invocation failed");
    vi.mocked(mockTask.invoke).mockRejectedValueOnce(mockError);

    await expect(toolMethod(input)).rejects.toThrow(
      `Failed to apply patch to ${input.path}: ${mockError.message}`
    );

    expect(mockTask.invoke).toHaveBeenCalledTimes(1);
  });
});
