import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { RequirePassingTests } from "./RequirePassingTests.js";
import { Cassi } from "../../cassi/Cassi.js";
import { Config } from "../../config/Config.js";
import { User } from "../../user/User.js";

vi.mock("../../cassi/Cassi.js");
vi.mock("../../config/Config.js");
vi.mock("../../user/User.js");

describe("RequirePassingTests", () => {
  let mockCassi: Cassi;
  let mockConfig: Config;
  let mockUser: User;
  let task: RequirePassingTests;

  beforeEach(() => {
    mockUser = new User();
    mockConfig = new Config("dummyPath", mockUser);
    mockCassi = new Cassi(mockUser, "dummyPath", "dummyRepo");
    mockCassi.config = mockConfig;
    mockCassi.user = mockUser; // Ensure the user property is assigned

    mockConfig.configData = {
      commands: {
        test: "npm run test",
      },
      apiKeys: { gemini: "dummy-key" },
    };

    task = new RequirePassingTests(mockCassi, undefined);
    task.getCwd = vi.fn().mockReturnValue("/fake/cwd");
    task.invoke = vi.fn();

    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    (mockUser.prompt as Mock) = vi.fn();
  });

  it("should resolve successfully if tests pass on the first try", async () => {
    (task.invoke as Mock).mockResolvedValue({
      stdout: "ok 1 test passed",
      stderr: "",
      exitCode: 0,
    });

    await expect(task.initTask()).resolves.toBeUndefined();
    expect(task.invoke).toHaveBeenCalledTimes(1);
    expect(task.invoke).toHaveBeenCalledWith(
      "console",
      "exec",
      ["/fake/cwd"],
      ["npm run test -- --reporter=tap"]
    );
    expect(mockUser.prompt).not.toHaveBeenCalled();
  });

  it("should prompt user and retry if tests fail, then succeed", async () => {
    (task.invoke as Mock)
      .mockResolvedValueOnce({
        stdout: "not ok 1 test failed",
        stderr: "",
        exitCode: 1,
      })
      .mockResolvedValueOnce({
        stdout: "ok 1 test passed",
        stderr: "",
        exitCode: 0,
      });

    // Mock user confirming to continue
    (mockUser.prompt as Mock).mockImplementation(async (promptSequence) => {
      const confirmPrompt = promptSequence.prompts[0];
      confirmPrompt.response = true;
    });

    await expect(task.initTask()).resolves.toBeUndefined();
    expect(task.invoke).toHaveBeenCalledTimes(2);
    expect(mockUser.prompt).toHaveBeenCalledTimes(1);
    const promptArg = (mockUser.prompt as Mock).mock.calls[0][0];
    expect(promptArg.prompts[0].message).toBe(
      "Tests not passing in /fake/cwd. Fix and press y to continue"
    );
  });

  it("should throw error if tests fail and user aborts", async () => {
    (task.invoke as Mock).mockResolvedValueOnce({
      stdout: "not ok 1 test failed",
      stderr: "",
      exitCode: 1,
    });

    // Mock user aborting
    (mockUser.prompt as Mock).mockImplementation(async (promptSequence) => {
      const confirmPrompt = promptSequence.prompts[0];
      confirmPrompt.response = false;
    });

    await expect(task.initTask()).rejects.toThrow("Task aborted by user.");
    expect(task.invoke).toHaveBeenCalledTimes(1);
    expect(mockUser.prompt).toHaveBeenCalledTimes(1);
  });

  it("should throw an error immediately if invoke rejects", async () => {
    const testError = new Error("Underlying command failed");
    (task.invoke as Mock).mockRejectedValue(testError);

    await expect(task.initTask()).rejects.toThrow(testError);
    expect(task.invoke).toHaveBeenCalledTimes(1);
    expect(mockUser.prompt).not.toHaveBeenCalled();
  });

  it("should throw an error if configData is missing", async () => {
    mockConfig.configData = null;
    task = new RequirePassingTests(mockCassi, undefined);
    await expect(task.initTask()).rejects.toThrow(
      "Configuration data not found."
    );
  });

  it("should throw an error if commands configuration is missing", async () => {
    mockConfig.configData = { apiKeys: { gemini: "dummy-key" } };
    task = new RequirePassingTests(mockCassi, undefined);
    await expect(task.initTask()).rejects.toThrow(
      "Commands configuration not found."
    );
  });

  it("should throw an error if test command is missing", async () => {
    mockConfig.configData = { commands: {}, apiKeys: { gemini: "dummy-key" } };
    task = new RequirePassingTests(mockCassi, undefined);
    await expect(task.initTask()).rejects.toThrow(
      "Test command not found in configuration."
    );
  });
});
