import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { RunTestFile } from "./RunTestFile.js";
import { Models } from "../Models.js";
import { Task } from "../../task/Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import { Config } from "../../config/Config.js";

describe("RunTestFile Tool", () => {
  let mockModel: Models;
  let mockTask: Task;
  let mockCassi: Cassi;
  let mockConfig: Config;
  const testFilePath = "src/lib/some/test/file.test.ts";

  beforeEach(() => {
    mockConfig = {
      configData: {
        commands: {
          test: "npm run test",
        },
      },
    } as unknown as Config;

    mockCassi = {
      config: mockConfig,
    } as unknown as Cassi;

    mockTask = {
      cassi: mockCassi,
      getCwd: vi.fn().mockReturnValue("/test/dir"),
      invoke: vi.fn(),
    } as unknown as Task;

    mockModel = {
      task: mockTask,
    } as unknown as Models;
  });

  it("should have correct tool definition", () => {
    expect(RunTestFile.toolDefinition.name).toBe("RUN_TEST_FILE");
    expect(RunTestFile.toolDefinition.description).toBe(
      "Runs tests for a specific file"
    );
    expect(RunTestFile.toolDefinition.inputSchema).toBeDefined();
    const inputSchema = RunTestFile.toolDefinition
      .inputSchema as z.ZodObject<any>;
    expect(inputSchema.shape).toHaveProperty("path");
  });

  it("should execute the test command for the specified file successfully", async () => {
    const mockExecResult = { stdout: "Tests passed", stderr: "" };
    vi.mocked(mockTask.invoke).mockResolvedValue(mockExecResult);

    const result = await RunTestFile.toolMethod(mockModel, {
      path: testFilePath,
    });

    const expectedCommand = `npm run test -- --reporter=dot --silent ${testFilePath}`;
    expect(mockTask.invoke).toHaveBeenCalledWith(
      "console",
      "exec",
      ["/test/dir"],
      [expectedCommand]
    );
    expect(result).toBe("OK");
  });

  it("should return stderr if present", async () => {
    const mockExecResult = { stdout: "", stderr: "Test warnings" };
    vi.mocked(mockTask.invoke).mockResolvedValue(mockExecResult);

    const result = await RunTestFile.toolMethod(mockModel, {
      path: testFilePath,
    });

    const expectedCommand = `npm run test -- --reporter=dot --silent ${testFilePath}`;
    expect(mockTask.invoke).toHaveBeenCalledWith(
      "console",
      "exec",
      ["/test/dir"],
      [expectedCommand]
    );
    expect(result).toBe(mockExecResult.stderr);
  });

  it("should return an error if test command is not found", async () => {
    mockConfig.configData!.commands!.test = undefined;
    const result = await RunTestFile.toolMethod(mockModel, {
      path: testFilePath,
    });
    expect(result).toBe("Error: Test command not found in configuration.");
    expect(mockTask.invoke).not.toHaveBeenCalled();
  });

  it("should return an error if commands configuration is not found", async () => {
    mockConfig.configData!.commands = undefined;
    const result = await RunTestFile.toolMethod(mockModel, {
      path: testFilePath,
    });
    expect(result).toBe("Error: Commands configuration not found.");
    expect(mockTask.invoke).not.toHaveBeenCalled();
  });

  it("should return an error if configData is not found", async () => {
    mockConfig.configData = null;
    const result = await RunTestFile.toolMethod(mockModel, {
      path: testFilePath,
    });
    expect(result).toBe("Error: Configuration data not found.");
    expect(mockTask.invoke).not.toHaveBeenCalled();
  });

  it("should return an error if exec fails", async () => {
    const errorMessage = "Command failed";
    vi.mocked(mockTask.invoke).mockRejectedValue(new Error(errorMessage));

    const result = await RunTestFile.toolMethod(mockModel, {
      path: testFilePath,
    });

    const expectedCommand = `npm run test -- --reporter=dot --silent ${testFilePath}`;
    expect(mockTask.invoke).toHaveBeenCalledWith(
      "console",
      "exec",
      ["/test/dir"],
      [expectedCommand]
    );
    expect(result).toBe(
      `Error executing test command "${expectedCommand}": ${errorMessage}`
    );
  });
});
