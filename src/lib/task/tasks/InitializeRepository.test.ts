import { describe, it, expect, vi, beforeEach } from "vitest";
import { InitializeRepository } from "./InitializeRepository.js";
import { ConfirmCwd } from "./ConfirmCwd.js";
import { InitializeGit } from "./InitializeGit.js"; // Import InitializeGit
import { Task } from "../Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import { User } from "../../user/User.js";

// Mock the ConfirmCwd task and its run method
vi.mock("./ConfirmCwd.js", () => {
  // Mock constructor needs to accept Cassi and parentTask args
  const ConfirmCwd = vi.fn((cassi, parentTask) => {}); // Updated mock signature
  ConfirmCwd.prototype.run = vi.fn().mockResolvedValue(undefined);
  return { ConfirmCwd };
});

// Mock the InitializeGit task and its run method
vi.mock("./InitializeGit.js", () => {
  const InitializeGit = vi.fn((cassi, parentTask) => {}); // Mock constructor
  InitializeGit.prototype.run = vi.fn().mockResolvedValue(undefined);
  return { InitializeGit };
});

// Mock Cassi instance
const mockUser = new User();
const mockConfigFile = "mock-config.json";
const mockRepoDir = "/mock/repo/dir";
const mockCassi = new Cassi(mockUser, mockConfigFile, mockRepoDir);

describe("InitializeRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks(); // Reset mocks before each test
  });

  it("should initialize with ConfirmCwd and InitializeGit as subtasks", () => {
    const task = new InitializeRepository(mockCassi); // Pass mock Cassi
    expect(task.subTasks).toHaveLength(2); // Expect 2 subtasks
    expect(task.subTasks[0]).toBeInstanceOf(ConfirmCwd);
    expect(task.subTasks[1]).toBeInstanceOf(InitializeGit); // Check for InitializeGit instance
    // Check if mocks were called with mockCassi and the task instance itself as parent
    expect(ConfirmCwd).toHaveBeenCalledWith(mockCassi, task);
    expect(InitializeGit).toHaveBeenCalledWith(mockCassi, task); // Check InitializeGit call
  });

  it("should call the run method of its subtasks when run", async () => {
    const task = new InitializeRepository(mockCassi); // Pass mock Cassi

    // Ensure mocks were called correctly during instantiation
    expect(ConfirmCwd).toHaveBeenCalledWith(mockCassi, task);
    expect(InitializeGit).toHaveBeenCalledWith(mockCassi, task);

    // Get the mocked instances created in the constructor
    const confirmCwdInstance = vi.mocked(ConfirmCwd).mock.instances[0];
    const initializeGitInstance = vi.mocked(InitializeGit).mock.instances[0]; // Get InitializeGit instance
    const confirmCwdRunSpy = vi.spyOn(confirmCwdInstance, "run");
    const initializeGitRunSpy = vi.spyOn(initializeGitInstance, "run"); // Spy on InitializeGit run

    await task.run();

    expect(confirmCwdRunSpy).toHaveBeenCalledTimes(1);
    expect(initializeGitRunSpy).toHaveBeenCalledTimes(1); // Expect InitializeGit run to be called
  });

  it("should inherit from Task", () => {
    const task = new InitializeRepository(mockCassi); // Pass mock Cassi
    expect(task).toBeInstanceOf(Task);
  });
});
