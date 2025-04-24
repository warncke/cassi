import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// Removed SpyInstance type import again
import { InitializeGit } from "./InitializeGit.js";
import { Cassi } from "../../cassi/Cassi.js";
import { Task } from "../Task.js";

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
    // Provide necessary properties, potentially mocking Repository directly here
    // if the vi.mock above isn't sufficient or causes issues.
    mockCassi = {
      repository: {
        repositoryDir: "/mock/repo/dir",
        // Add other required Repository properties if the mock isn't picked up correctly
      },
      // Add other necessary Cassi properties/methods if needed by Task constructor or methods
    } as Cassi; // Correct type assertion syntax

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

  it("should log the status returned by invoke when clean", async () => {
    const mockStatus = { isClean: () => true /* other properties if needed */ };
    // Ensure the mock invoke returns a specific value for this test
    vi.spyOn(initializeGitTask, "invoke").mockResolvedValue(mockStatus);

    await initializeGitTask.initTask();

    expect(mockConsoleLog).toHaveBeenCalledWith("Git Status:", mockStatus);
    expect(mockConsoleError).not.toHaveBeenCalled();
    expect(mockProcessExit).not.toHaveBeenCalled();
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
    expect(mockConsoleLog).toHaveBeenCalledWith("Git Status:", mockStatus); // Status is still logged
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
});
