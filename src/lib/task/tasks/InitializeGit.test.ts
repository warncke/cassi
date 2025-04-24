import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InitializeGit } from "./InitializeGit.js";
import { Cassi } from "../../cassi/Cassi.js";
import { Task } from "../Task.js";
import { Prompt } from "../../prompt/Prompt.js"; // Import Prompt
import Confirm from "../../prompt/prompts/Confirm.js"; // Import Confirm

// Mock Cassi and its dependencies
vi.mock("../../cassi/Cassi.js");
// Mock Repository more completely if needed, or adjust mock Cassi
vi.mock("../../repository/Repository.js", () => ({
  Repository: vi.fn().mockImplementation(() => ({
    repositoryDir: "/mock/repo/dir",
    user: { name: "Test User", email: "test@example.com" }, // Add missing properties if needed by Cassi/Task
    init: vi.fn(), // Add missing properties if needed
  })),
}));
// vi.mock("../../tool/Tool.js"); // Mocking Tool might not be necessary if invoke is spied on task instance

describe("InitializeGit Task", () => {
  let mockCassi: Cassi;
  let initializeGitTask: InitializeGit;
  // Add explicit 'any' type for process.exit spy
  let mockProcessExit: any;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset mocks before each test
    // vi.clearAllMocks(); // Keep this if other mocks are used, but spies need specific setup/restore

    // Create a mock Cassi instance
    mockCassi = {
      repository: {
        repositoryDir: "/mock/repo/dir",
      },
      user: {
        // Mock the user and its prompt method
        prompt: vi.fn(async (promptContainer: Prompt) => {
          // Default mock implementation: simulate user confirming
          if (promptContainer.prompts[0] instanceof Confirm) {
            promptContainer.prompts[0].response = true;
          }
        }),
      },
      // Add other necessary Cassi properties/methods if needed
    } as unknown as Cassi; // Use unknown for partial mock

    // Create an instance of the task
    initializeGitTask = new InitializeGit(mockCassi);

    // Spy on and mock implementations
    // Use simple vi.fn() for mocks, casting to 'any' for process.exit to bypass 'never' type check
    mockProcessExit = vi
      .spyOn(process, "exit")
      .mockImplementation(vi.fn() as any);
    mockConsoleError = vi.spyOn(console, "error").mockImplementation(vi.fn());
    mockConsoleLog = vi.spyOn(console, "log").mockImplementation(vi.fn());
  });

  afterEach(() => {
    // Restore original implementations
    mockProcessExit.mockRestore();
    mockConsoleError.mockRestore();
    mockConsoleLog.mockRestore();
    vi.clearAllMocks(); // Clear any other mocks like vi.fn() used in tests
  });

  it("should inherit from Task", () => {
    expect(initializeGitTask).toBeInstanceOf(Task);
  });

  it("should call invoke with 'git', 'status', and repositoryDir during initTask", async () => {
    // Mock the invoke method for this specific test
    const mockStatus = { isClean: () => true }; // Example clean status
    const invokeSpy = vi
      .spyOn(initializeGitTask, "invoke")
      .mockResolvedValue(mockStatus);

    await initializeGitTask.initTask();

    expect(invokeSpy).toHaveBeenCalledOnce();
    expect(invokeSpy).toHaveBeenCalledWith("git", "status", "/mock/repo/dir");
  });

  it("should log status and proceed without exiting if clean and user confirms", async () => {
    const mockStatus = { isClean: () => true, current: "main" };
    vi.spyOn(initializeGitTask, "invoke").mockResolvedValue(mockStatus);
    // User prompt mock defaults to confirming (true)

    await initializeGitTask.initTask();

    // expect(mockConsoleLog).toHaveBeenCalledWith("Git Status:", mockStatus); // Removed: Status is not logged here
    expect(mockCassi.user.prompt).toHaveBeenCalled(); // Verify prompt was called
    expect(mockConsoleError).not.toHaveBeenCalled();
    expect(mockProcessExit).not.toHaveBeenCalled(); // Should not exit if confirmed
  });

  it("should log error and exit if git status is not clean", async () => {
    const mockStatus = { isClean: () => false }; // Mock unclean status
    // Ensure the mock invoke returns the unclean status
    const invokeSpy = vi
      .spyOn(initializeGitTask, "invoke")
      .mockResolvedValue(mockStatus);

    // Run the task, don't expect it to throw in the test environment
    await initializeGitTask.initTask();

    // Verify calls happened
    expect(invokeSpy).toHaveBeenCalledOnce();
    // expect(mockConsoleLog).toHaveBeenCalledWith("Git Status:", mockStatus); // Removed: Status is not logged here
    expect(mockConsoleError).toHaveBeenCalledOnce();
    expect(mockConsoleError).toHaveBeenCalledWith(
      "Git repository is not clean. Please commit or stash changes before proceeding."
    );
    expect(mockProcessExit).toHaveBeenCalledOnce();
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });

  it("should let the base Task class handle errors from invoke", async () => {
    const mockError = new Error("Git command failed");
    // Mock invoke to reject with an error
    const invokeSpy = vi
      .spyOn(initializeGitTask, "invoke")
      .mockRejectedValue(mockError);
    // Spy on the base run method to see if error is caught (indirectly)
    // Note: We don't mock invoke on mockCassi.tool anymore, but directly on the task instance
    const runSpy = vi.spyOn(initializeGitTask, "run");

    // We expect run() to catch the error thrown by initTask()
    await initializeGitTask.run(); // Call run() which calls initTask()

    expect(invokeSpy).toHaveBeenCalledOnce();
    // Check if the error property is set by the base class run method
    expect(initializeGitTask.error).toBe(mockError);
    // Ensure console.log wasn't called with status in case of error
    expect(mockConsoleLog).not.toHaveBeenCalledWith(
      "Git Status:",
      expect.anything()
    );
    // Verify run was called
    expect(runSpy).toHaveBeenCalled();
  });

  // --- New tests for prompt functionality ---

  it("should prompt the user with the current branch name if clean", async () => {
    const mockStatus = { isClean: () => true, current: "develop" };
    vi.spyOn(initializeGitTask, "invoke").mockResolvedValue(mockStatus);
    // Spy on the actual prompt function passed to the task
    const promptSpy = vi.spyOn(mockCassi.user, "prompt");

    await initializeGitTask.initTask();

    expect(promptSpy).toHaveBeenCalledOnce();
    // Check the structure and message of the prompt passed
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
    // Override the default prompt mock to simulate cancellation
    vi.spyOn(mockCassi.user, "prompt").mockImplementation(
      async (promptContainer: Prompt) => {
        if (promptContainer.prompts[0] instanceof Confirm) {
          promptContainer.prompts[0].response = false; // Simulate user saying no
        }
      }
    );

    await initializeGitTask.initTask();

    // expect(mockConsoleLog).toHaveBeenCalledWith("Git Status:", mockStatus); // Removed: Status is not logged here
    expect(mockCassi.user.prompt).toHaveBeenCalledOnce();
    expect(mockConsoleLog).toHaveBeenCalledWith("Operation cancelled by user.");
    expect(mockProcessExit).toHaveBeenCalledOnce();
    expect(mockProcessExit).toHaveBeenCalledWith(0); // Exit code 0 for user cancellation
    expect(mockConsoleError).not.toHaveBeenCalled(); // No error should be logged
  });
});
