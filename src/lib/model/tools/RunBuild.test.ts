import { describe, it, expect, vi, beforeEach } from "vitest";
import { RunBuild } from "./RunBuild.js";
import { Models } from "../Models.js";
import { Task } from "../../task/Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import { Config } from "../../config/Config.js";

describe("RunBuild Tool", () => {
  let mockModel: Models;
  let mockTask: Task;
  let mockCassi: Cassi;
  let mockConfig: Config;

  beforeEach(() => {
    mockConfig = {
      configData: {
        commands: {
          build: "npm run build",
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
    expect(RunBuild.toolDefinition.name).toBe("RUN_BUILD");
    expect(RunBuild.toolDefinition.description).toBe(
      "Runs the build command specified in the cassi configuration."
    );
    expect(RunBuild.toolDefinition.inputSchema).toBeDefined();
    expect(Object.keys(RunBuild.toolDefinition.inputSchema.shape).length).toBe(
      0
    );
  });

  it("should execute the build command successfully", async () => {
    const mockExecResult = { stdout: "Build successful", stderr: "" };
    vi.mocked(mockTask.invoke).mockResolvedValue(mockExecResult);

    const result = await RunBuild.toolMethod(mockModel, {});

    expect(mockTask.invoke).toHaveBeenCalledWith(
      "console",
      "exec",
      ["/test/dir"],
      ["npm run build"]
    );
    expect(result).toBe(
      'Build command "npm run build" executed successfully.\nSTDOUT:\nBuild successful'
    );
  });

  it("should return stderr if present", async () => {
    const mockExecResult = { stdout: "", stderr: "Build warning" };
    vi.mocked(mockTask.invoke).mockResolvedValue(mockExecResult);

    const result = await RunBuild.toolMethod(mockModel, {});

    expect(mockTask.invoke).toHaveBeenCalledWith(
      "console",
      "exec",
      ["/test/dir"],
      ["npm run build"]
    );
    expect(result).toBe(
      'Build command "npm run build" executed successfully.\nSTDERR:\nBuild warning'
    );
  });

  it("should return an error if build command is not found", async () => {
    mockConfig.configData!.commands!.build = undefined;
    const result = await RunBuild.toolMethod(mockModel, {});
    expect(result).toBe("Error: Build command not found in configuration.");
    expect(mockTask.invoke).not.toHaveBeenCalled();
  });

  it("should return an error if commands configuration is not found", async () => {
    mockConfig.configData!.commands = undefined;
    const result = await RunBuild.toolMethod(mockModel, {});
    expect(result).toBe("Error: Commands configuration not found.");
    expect(mockTask.invoke).not.toHaveBeenCalled();
  });

  it("should return an error if configData is not found", async () => {
    mockConfig.configData = null;
    const result = await RunBuild.toolMethod(mockModel, {});
    expect(result).toBe("Error: Configuration data not found.");
    expect(mockTask.invoke).not.toHaveBeenCalled();
  });

  it("should return an error if exec fails", async () => {
    const errorMessage = "Command failed";
    vi.mocked(mockTask.invoke).mockRejectedValue(new Error(errorMessage));

    const result = await RunBuild.toolMethod(mockModel, {});

    expect(mockTask.invoke).toHaveBeenCalledWith(
      "console",
      "exec",
      ["/test/dir"],
      ["npm run build"]
    );
    expect(result).toBe(
      `Error executing build command "npm run build": ${errorMessage}`
    );
  });
});
