import path from "path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfirmCwd } from "./ConfirmCwd.js";
import { Cassi } from "../../cassi/Cassi.js";
import { User } from "../../user/User.js";
import { Prompt } from "../../prompt/Prompt.js";
import Confirm from "../../prompt/prompts/Confirm.js";

let mockUser: User;
let mockCassi: Cassi;
const mockConfigFile = "mock-config.json";
const initialMockRepoDir = "relative/repo";
const mockCwd = "/mock/cwd";

describe("ConfirmCwd", () => {
  beforeEach(() => {
    mockUser = new User();
    mockCassi = new Cassi(mockUser, mockConfigFile, initialMockRepoDir);
    vi.restoreAllMocks();
  });

  it("should instantiate correctly with default parentTask", () => {
    const task = new ConfirmCwd(mockCassi);
    expect(task).toBeInstanceOf(ConfirmCwd);
    expect(task.parentTask).toBeNull();
    expect(mockCassi.repository.repositoryDir).toBe(initialMockRepoDir);
  });

  it("initTask should run without errors and update repo dir when user confirms", async () => {
    const expectedResolvedPath = path.resolve(mockCwd, initialMockRepoDir);
    const task = new ConfirmCwd(mockCassi);

    const invokeSpy = vi.spyOn(task, "invoke").mockResolvedValue(mockCwd);

    const promptSpy = vi
      .spyOn(mockCassi.user, "prompt")
      .mockImplementation(async (prompt: Prompt) => {
        if (prompt instanceof Confirm) {
          expect(prompt.message).toContain(expectedResolvedPath);
          prompt.response = true;
        } else {
          expect(prompt).toBeInstanceOf(Confirm);
        }
      });

    await expect(task.initTask()).resolves.toBeUndefined();

    expect(invokeSpy).toHaveBeenCalledWith(
      "fs",
      "getCurrentWorkingDirectory",
      []
    );
    expect(promptSpy).toHaveBeenCalled();

    expect(mockCassi.repository.repositoryDir).toBe(expectedResolvedPath);
  });

  it("initTask should exit if user denies the directory", async () => {
    const expectedResolvedPath = path.resolve(mockCwd, initialMockRepoDir);
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const task = new ConfirmCwd(mockCassi);

    const invokeSpy = vi.spyOn(task, "invoke").mockResolvedValue(mockCwd);

    const promptSpy = vi
      .spyOn(mockCassi.user, "prompt")
      .mockImplementation(async (prompt: Prompt) => {
        if (prompt instanceof Confirm) {
          expect(prompt.message).toContain(expectedResolvedPath);
          prompt.response = false;
        } else {
          expect(prompt).toBeInstanceOf(Confirm);
        }
      });

    await expect(task.initTask()).rejects.toThrow("process.exit called");

    expect(invokeSpy).toHaveBeenCalledWith(
      "fs",
      "getCurrentWorkingDirectory",
      []
    );
    expect(promptSpy).toHaveBeenCalled();

    expect(mockExit).toHaveBeenCalledWith(1);

    expect(mockCassi.repository.repositoryDir).toBe(initialMockRepoDir);

    mockExit.mockRestore();
  });
});
