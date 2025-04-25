import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InitializeGit } from "./InitializeGit.js";
import { Cassi } from "../../cassi/Cassi.js";
import { Task } from "../Task.js";
import { Prompt } from "../../prompt/Prompt.js";
import Confirm from "../../prompt/prompts/Confirm.js";

vi.mock("../../cassi/Cassi.js");
vi.mock("../../repository/Repository.js", () => ({
  Repository: vi.fn().mockImplementation(() => ({
    repositoryDir: "/mock/repo/dir",
    user: { name: "Test User", email: "test@example.com" },
    init: vi.fn(),
  })),
}));

describe("InitializeGit Task", () => {
  let mockCassi: Cassi;
  let initializeGitTask: InitializeGit;
  let mockProcessExit: any;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {

    mockCassi = {
      repository: {
        repositoryDir: "/mock/repo/dir",
      },
      user: {
        prompt: vi.fn(async (promptContainer: Prompt) => {
          if (promptContainer.prompts[0] instanceof Confirm) {
            promptContainer.prompts[0].response = true;
          }
        }),
      },
    } as unknown as Cassi;

    initializeGitTask = new InitializeGit(mockCassi);

    mockProcessExit = vi
      .spyOn(process, "exit")
      .mockImplementation(vi.fn() as any);
    mockConsoleError = vi.spyOn(console, "error").mockImplementation(vi.fn());
    mockConsoleLog = vi.spyOn(console, "log").mockImplementation(vi.fn());
  });

  afterEach(() => {
    mockProcessExit.mockRestore();
    mockConsoleError.mockRestore();
    mockConsoleLog.mockRestore();
    vi.clearAllMocks();
  });

  it("should inherit from Task", () => {
    expect(initializeGitTask).toBeInstanceOf(Task);
  });

  it("should call invoke with 'git', 'status', and repositoryDir during initTask", async () => {
    const mockStatus = { isClean: () => true };
    const invokeSpy = vi
      .spyOn(initializeGitTask, "invoke")
      .mockResolvedValue(mockStatus);

    await initializeGitTask.initTask();

    expect(invokeSpy).toHaveBeenCalledOnce();
    expect(invokeSpy).toHaveBeenCalledWith(
      "git",
      "status",
      [],
      [mockCassi.repository.repositoryDir]
    );
  });

  it("should log status and proceed without exiting if clean and user confirms", async () => {
    const mockStatus = { isClean: () => true, current: "main" };
    vi.spyOn(initializeGitTask, "invoke").mockResolvedValue(mockStatus);

    await initializeGitTask.initTask();

    expect(mockCassi.user.prompt).toHaveBeenCalled();
    expect(mockConsoleError).not.toHaveBeenCalled();
    expect(mockProcessExit).not.toHaveBeenCalled();
  });

  it("should log error and exit if git status is not clean", async () => {
    const mockStatus = { isClean: () => false };
    const invokeSpy = vi
      .spyOn(initializeGitTask, "invoke")
      .mockResolvedValue(mockStatus);

    await initializeGitTask.initTask();

    expect(invokeSpy).toHaveBeenCalledOnce();
    expect(mockConsoleError).toHaveBeenCalledOnce();
    expect(mockConsoleError).toHaveBeenCalledWith(
      "Git repository is not clean. Please commit or stash changes before proceeding."
    );
    expect(mockProcessExit).toHaveBeenCalledOnce();
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });

  it("should let the base Task class handle errors from invoke", async () => {
    const mockError = new Error("Git command failed");
    const invokeSpy = vi
      .spyOn(initializeGitTask, "invoke")
      .mockRejectedValue(mockError);
    const runSpy = vi.spyOn(initializeGitTask, "run");

    await initializeGitTask.run();

    expect(invokeSpy).toHaveBeenCalledOnce();
    expect(initializeGitTask.error).toBe(mockError);
    expect(mockConsoleLog).not.toHaveBeenCalledWith(
      "Git Status:",
      expect.anything()
    );
    expect(runSpy).toHaveBeenCalled();
  });


  it("should prompt the user with the current branch name if clean", async () => {
    const mockStatus = { isClean: () => true, current: "develop" };
    vi.spyOn(initializeGitTask, "invoke").mockResolvedValue(mockStatus);
    const promptSpy = vi.spyOn(mockCassi.user, "prompt");

    await initializeGitTask.initTask();

    expect(promptSpy).toHaveBeenCalledOnce();
    expect(promptSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        prompts: expect.arrayContaining([
          expect.objectContaining({
            message: "Current branch is 'develop'. Continue?",
            type: "confirm",
          }),
        ]),
      })
    );
  });

  it("should log cancellation and exit with 0 if user cancels the prompt", async () => {
    const mockStatus = { isClean: () => true, current: "feature/new-stuff" };
    vi.spyOn(initializeGitTask, "invoke").mockResolvedValue(mockStatus);
    vi.spyOn(mockCassi.user, "prompt").mockImplementation(
      async (promptContainer: Prompt) => {
        if (promptContainer.prompts[0] instanceof Confirm) {
          promptContainer.prompts[0].response = false;
        }
      }
    );

    await initializeGitTask.initTask();

    expect(mockCassi.user.prompt).toHaveBeenCalledOnce();
    expect(mockConsoleLog).toHaveBeenCalledWith("Operation cancelled by user.");
    expect(mockProcessExit).toHaveBeenCalledOnce();
    expect(mockProcessExit).toHaveBeenCalledWith(0);
    expect(mockConsoleError).not.toHaveBeenCalled();
  });
});
