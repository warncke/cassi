import { describe, it, expect, vi, beforeEach } from "vitest";
import { InitializeRepository } from "./InitializeRepository.js";
import { ConfirmCwd } from "./ConfirmCwd.js";
import { InitializeGit } from "./InitializeGit.js";
import { Task } from "../Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import { User } from "../../user/User.js";

vi.mock("./ConfirmCwd.js", () => {
  const ConfirmCwd = vi.fn((cassi, parentTask) => {});
  ConfirmCwd.prototype.run = vi.fn().mockResolvedValue(undefined);
  return { ConfirmCwd };
});

vi.mock("./InitializeGit.js", () => {
  const InitializeGit = vi.fn((cassi, parentTask) => {});
  InitializeGit.prototype.run = vi.fn().mockResolvedValue(undefined);
  return { InitializeGit };
});

const mockUser = new User();
const mockConfigFile = "mock-config.json";
const mockRepoDir = "/mock/repo/dir";
const mockCassi = new Cassi(mockUser, mockConfigFile, mockRepoDir);

describe("InitializeRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with ConfirmCwd and InitializeGit as subtasks", () => {
    const task = new InitializeRepository(mockCassi);
    expect(task.subTasks).toHaveLength(2);
    expect(task.subTasks[0]).toBeInstanceOf(ConfirmCwd);
    expect(task.subTasks[1]).toBeInstanceOf(InitializeGit);
    expect(ConfirmCwd).toHaveBeenCalledWith(mockCassi, task);
    expect(InitializeGit).toHaveBeenCalledWith(mockCassi, task);
  });

  it("should call the run method of its subtasks when run", async () => {
    const task = new InitializeRepository(mockCassi);

    expect(ConfirmCwd).toHaveBeenCalledWith(mockCassi, task);
    expect(InitializeGit).toHaveBeenCalledWith(mockCassi, task);

    const confirmCwdInstance = vi.mocked(ConfirmCwd).mock.instances[0];
    const initializeGitInstance = vi.mocked(InitializeGit).mock.instances[0];
    const confirmCwdRunSpy = vi.spyOn(confirmCwdInstance, "run");
    const initializeGitRunSpy = vi.spyOn(initializeGitInstance, "run");

    await task.run();

    expect(confirmCwdRunSpy).toHaveBeenCalledTimes(1);
    expect(initializeGitRunSpy).toHaveBeenCalledTimes(1);
  });

  it("should inherit from Task", () => {
    const task = new InitializeRepository(mockCassi);
    expect(task).toBeInstanceOf(Task);
  });
});
