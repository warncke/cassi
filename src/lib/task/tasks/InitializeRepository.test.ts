import { describe, it, expect, vi, beforeEach } from "vitest";
import { InitializeRepository } from "./InitializeRepository.js";
import { ConfirmCwd } from "./ConfirmCwd.js";
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

// Mock Cassi instance
const mockUser = new User();
const mockConfigFile = "mock-config.json";
const mockRepoDir = "/mock/repo/dir";
const mockCassi = new Cassi(mockUser, mockConfigFile, mockRepoDir);

describe("InitializeRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks(); // Reset mocks before each test
  });

  it("should initialize with ConfirmCwd as a subtask", () => {
    const task = new InitializeRepository(mockCassi); // Pass mock Cassi
    expect(task.subTasks).toHaveLength(1);
    expect(task.subTasks[0]).toBeInstanceOf(ConfirmCwd);
    // Check if ConfirmCwd mock was called with mockCassi and the task instance itself as parent
    expect(ConfirmCwd).toHaveBeenCalledWith(mockCassi, task); // Check parentTask argument
  });

  it("should call the run method of its subtasks when run", async () => {
    const task = new InitializeRepository(mockCassi); // Pass mock Cassi

    // Ensure the mock was called correctly during instantiation
    expect(ConfirmCwd).toHaveBeenCalledWith(mockCassi, task); // Check parentTask argument

    // Get the mocked instance created in the constructor
    const confirmCwdInstance = vi.mocked(ConfirmCwd).mock.instances[0];
    const subTaskRunSpy = vi.spyOn(confirmCwdInstance, "run");

    await task.run();

    expect(subTaskRunSpy).toHaveBeenCalledTimes(1);
  });

  it("should inherit from Task", () => {
    const task = new InitializeRepository(mockCassi); // Pass mock Cassi
    expect(task).toBeInstanceOf(Task);
  });
});
