import { describe, it, expect, vi, beforeEach } from "vitest";
import { RunTestAll } from "./RunTestAll.js";
import { Models } from "../Models.js";
import { Task } from "../../task/Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import { Config } from "../../config/Config.js";

describe("RunTestAll Tool", () => {
  let mockModel: Models;
  let mockTask: Task;
  let mockCassi: Cassi;
  let mockConfig: Config;

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
    expect(RunTestAll.toolDefinition.name).toBe("RUN_TEST_ALL");
    expect(RunTestAll.toolDefinition.description).toBe(
      "Runs all tests for project"
    );
    expect(RunTestAll.toolDefinition.inputSchema).toBeDefined();
    expect(
      Object.keys(RunTestAll.toolDefinition.inputSchema.shape).length
    ).toBe(0);
  });

  it("should execute the test command successfully", async () => {
    const mockExecResult = { stdout: "Tests passed", stderr: "" };
    vi.mocked(mockTask.invoke).mockResolvedValue(mockExecResult);

    const result = await RunTestAll.toolMethod(mockModel, {});

    expect(mockTask.invoke).toHaveBeenCalledWith(
      "console",
      "exec",
      ["/test/dir"],
      ["npm run test -- --reporter=dot --silent"]
    );
    expect(result).toBe("OK");
  });

  it("should return stderr if present", async () => {
    const mockExecResult = { stdout: "", stderr: "Test warnings" };
    vi.mocked(mockTask.invoke).mockResolvedValue(mockExecResult);

    const result = await RunTestAll.toolMethod(mockModel, {});

    expect(mockTask.invoke).toHaveBeenCalledWith(
      "console",
      "exec",
      ["/test/dir"],
      ["npm run test -- --reporter=dot --silent"]
    );
    expect(result).toBe("Test warnings");
  });

  it("should return an error if test command is not found", async () => {
    mockConfig.configData!.commands!.test = undefined;
    const result = await RunTestAll.toolMethod(mockModel, {});
    expect(result).toBe("Error: Test command not found in configuration.");
    expect(mockTask.invoke).not.toHaveBeenCalled();
  });

  it("should return an error if commands configuration is not found", async () => {
    mockConfig.configData!.commands = undefined;
    const result = await RunTestAll.toolMethod(mockModel, {});
    expect(result).toBe("Error: Commands configuration not found.");
    expect(mockTask.invoke).not.toHaveBeenCalled();
  });

  it("should return an error if configData is not found", async () => {
    mockConfig.configData = null;
    const result = await RunTestAll.toolMethod(mockModel, {});
    expect(result).toBe("Error: Configuration data not found.");
    expect(mockTask.invoke).not.toHaveBeenCalled();
  });

  it("should return an error if exec fails", async () => {
    const errorMessage = "Command failed";
    vi.mocked(mockTask.invoke).mockRejectedValue(new Error(errorMessage));

    const result = await RunTestAll.toolMethod(mockModel, {});

    expect(mockTask.invoke).toHaveBeenCalledWith(
      "console",
      "exec",
      ["/test/dir"],
      ["npm run test -- --reporter=dot --silent"]
    );
    expect(result).toBe(
      `Error executing test command "npm run test": ${errorMessage}`
    );
  });

  it("should append the tap reporter flag to the test command", async () => {
    const mockExecResult = { stdout: "TAP version 13...", stderr: "" };
    vi.mocked(mockTask.invoke).mockResolvedValue(mockExecResult);

    const result = await RunTestAll.toolMethod(mockModel, {});

    expect(mockTask.invoke).toHaveBeenCalledWith(
      "console",
      "exec",
      ["/test/dir"],
      ["npm run test -- --reporter=dot --silent"]
    );
    expect(result).toBe("OK");
  });
});
