import path from "path"; // Import path
import { describe, it, expect, vi, beforeEach } from "vitest"; // Import vi and beforeEach
import { ConfirmCwd } from "./ConfirmCwd.js";
import { Cassi } from "../../cassi/Cassi.js";
import { User } from "../../user/User.js";
import { Prompt } from "../../prompt/Prompt.js"; // Import Prompt
import Confirm from "../../prompt/prompts/Confirm.js"; // Import Confirm

// Mock dependencies
let mockUser: User;
let mockCassi: Cassi;
const mockConfigFile = "mock-config.json";
const initialMockRepoDir = "relative/repo"; // Use a relative path for better testing
const mockCwd = "/mock/cwd"; // Define a consistent mock CWD

describe("ConfirmCwd", () => {
  beforeEach(() => {
    // Reset mocks and Cassi instance before each test
    mockUser = new User();
    mockCassi = new Cassi(mockUser, mockConfigFile, initialMockRepoDir);
    vi.restoreAllMocks(); // Ensure all mocks are cleared
  });

  it("should instantiate correctly with default parentTask", () => {
    const task = new ConfirmCwd(mockCassi); // Test default null parentTask
    expect(task).toBeInstanceOf(ConfirmCwd);
    expect(task.parentTask).toBeNull(); // Verify default parentTask
    expect(mockCassi.repository.repositoryDir).toBe(initialMockRepoDir); // Check initial state
  });

  it("initTask should run without errors and update repo dir when user confirms", async () => {
    const expectedResolvedPath = path.resolve(mockCwd, initialMockRepoDir);
    // Mock the tool.invoke method
    const invokeSpy = vi
      .spyOn(mockCassi.tool, "invoke")
      .mockResolvedValue(mockCwd);

    // Mock the user.prompt method
    const promptSpy = vi
      .spyOn(mockCassi.user, "prompt")
      .mockImplementation(async (prompt: Prompt) => {
        const confirmPrompt = prompt.prompts.find(
          (p) => p instanceof Confirm
        ) as Confirm | undefined;
        expect(confirmPrompt?.message).toContain(expectedResolvedPath); // Check resolved path in prompt
        if (confirmPrompt) {
          confirmPrompt.response = true; // Simulate confirmation
        }
      });

    const task = new ConfirmCwd(mockCassi); // Instantiated with default null parentTask
    await expect(task.initTask()).resolves.toBeUndefined();

    // Verify mocks were called
    // Expect the task instance as the first argument now
    expect(invokeSpy).toHaveBeenCalledWith(
      task,
      "fs",
      "getCurrentWorkingDirectory"
    );
    expect(promptSpy).toHaveBeenCalled();

    // Verify repositoryDir was updated
    expect(mockCassi.repository.repositoryDir).toBe(expectedResolvedPath);
  });

  // Test for the denial case
  it("initTask should exit if user denies the directory", async () => {
    const expectedResolvedPath = path.resolve(mockCwd, initialMockRepoDir);
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called"); // Throw error to catch exit call
    });

    // Mock tool.invoke
    vi.spyOn(mockCassi.tool, "invoke").mockResolvedValue(mockCwd);

    // Mock user.prompt to simulate denial
    vi.spyOn(mockCassi.user, "prompt").mockImplementation(
      async (prompt: Prompt) => {
        const confirmPrompt = prompt.prompts.find(
          (p) => p instanceof Confirm
        ) as Confirm | undefined;
        expect(confirmPrompt?.message).toContain(expectedResolvedPath);
        if (confirmPrompt) {
          confirmPrompt.response = false; // Simulate denial
        }
      }
    );

    const task = new ConfirmCwd(mockCassi); // Instantiated with default null parentTask

    // Expect initTask to eventually lead to process.exit being called
    await expect(task.initTask()).rejects.toThrow("process.exit called");

    // Verify process.exit was called with code 1
    expect(mockExit).toHaveBeenCalledWith(1);

    // Verify repositoryDir was NOT updated
    expect(mockCassi.repository.repositoryDir).toBe(initialMockRepoDir);

    mockExit.mockRestore(); // Restore mock exit
  });
});
