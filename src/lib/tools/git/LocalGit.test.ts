import { LocalGit } from "./LocalGit.js";
import { simpleGit, SimpleGit, StatusResult } from "simple-git";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs-extra";

vi.mock("simple-git");
vi.mock("fs-extra", () => ({
  ensureDir: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  default: {
    ensureDir: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("LocalGit", () => {
  let localGit: LocalGit;
  const testRepoPath = path.join(__dirname, "test-repo");
  const mockGitInstance = {
    status: vi.fn(),
    branch: vi.fn(),
    raw: vi.fn(),
  } as unknown as SimpleGit;

  beforeEach(async () => {
    vi.resetAllMocks();

    vi.mocked(simpleGit).mockReturnValue(mockGitInstance);

    await fs.ensureDir(testRepoPath);

    localGit = new LocalGit(testRepoPath);
  });

  afterEach(async () => {
    await fs.remove(testRepoPath);
  });

  it("should initialize simple-git with the correct base path", () => {
    expect(simpleGit).toHaveBeenCalledWith(testRepoPath, undefined);
  });

  describe("status", () => {
    it("should call git.status and return the result", async () => {
      const mockStatus: StatusResult = {
        not_added: [],
        conflicted: [],
        created: [],
        deleted: [],
        modified: ["file.txt"],
        renamed: [],
        files: [],
        staged: [],
        ahead: 0,
        behind: 0,
        current: "main",
        tracking: "origin/main",
        detached: false,
        isClean: () => false,
      };
      vi.mocked(mockGitInstance.status).mockResolvedValue(mockStatus);

      const status = await localGit.status();

      expect(mockGitInstance.status).toHaveBeenCalledTimes(1);
      expect(status).toEqual(mockStatus);
    });

    it("should handle errors from git.status", async () => {
      const mockError = new Error("Git status failed");
      vi.mocked(mockGitInstance.status).mockRejectedValue(mockError);

      await expect(localGit.status()).rejects.toThrow(mockError);
      expect(mockGitInstance.status).toHaveBeenCalledTimes(1);
    });
  });

  describe("branch", () => {
    it("should call git.branch with the correct branch name", async () => {
      const branchName = "new-feature-branch";
      const mockBranchSummary = {
        current: branchName,
        branches: {},
        all: [],
        detached: false,
      };
      vi.mocked(mockGitInstance.branch).mockResolvedValue(mockBranchSummary);

      await localGit.branch(branchName);

      expect(mockGitInstance.branch).toHaveBeenCalledTimes(1);
      expect(mockGitInstance.branch).toHaveBeenCalledWith([branchName]);
    });

    it("should handle errors from git.branch", async () => {
      const branchName = "error-branch";
      const mockError = new Error("Git branch creation failed");
      vi.mocked(mockGitInstance.branch).mockRejectedValue(mockError);

      await expect(localGit.branch(branchName)).rejects.toThrow(mockError);
      expect(mockGitInstance.branch).toHaveBeenCalledTimes(1);
      expect(mockGitInstance.branch).toHaveBeenCalledWith([branchName]);
    });
  });

  describe("addWorktree", () => {
    it("should call git.raw with the correct arguments for worktree add -b", async () => {
      const directory = "../new-worktree-dir";
      const branchName = "feature/new-worktree";
      const expectedCommand = [
        "worktree",
        "add",
        "-b",
        branchName,
        directory,
        "HEAD",
      ];
      vi.mocked(mockGitInstance.raw).mockResolvedValue("Worktree created");

      await localGit.addWorktree(directory, branchName);

      expect(mockGitInstance.raw).toHaveBeenCalledTimes(1);
      expect(mockGitInstance.raw).toHaveBeenCalledWith(expectedCommand);
    });

    it("should handle errors from git.raw when creating a worktree with -b", async () => {
      const directory = "../error-worktree-dir";
      const branchName = "feature/error-worktree";
      const expectedCommand = [
        "worktree",
        "add",
        "-b",
        branchName,
        directory,
        "HEAD",
      ];
      const mockError = new Error("Git worktree add failed");
      vi.mocked(mockGitInstance.raw).mockRejectedValue(mockError);

      await expect(localGit.addWorktree(directory, branchName)).rejects.toThrow(
        mockError
      );
      expect(mockGitInstance.raw).toHaveBeenCalledTimes(1);
      expect(mockGitInstance.raw).toHaveBeenCalledWith(expectedCommand);
    });
  });

  describe("remWorkTree", () => {
    it("should call git.raw with the correct arguments for worktree remove", async () => {
      const directory = "../existing-worktree-dir";
      const expectedCommand = ["worktree", "remove", directory];
      vi.mocked(mockGitInstance.raw).mockResolvedValue("Worktree removed");

      await localGit.remWorkTree(directory);

      expect(mockGitInstance.raw).toHaveBeenCalledTimes(1);
      expect(mockGitInstance.raw).toHaveBeenCalledWith(expectedCommand);
    });

    it("should handle errors from git.raw when removing a worktree", async () => {
      const directory = "../error-remove-worktree-dir";
      const expectedCommand = ["worktree", "remove", directory];
      const mockError = new Error("Git worktree remove failed");
      vi.mocked(mockGitInstance.raw).mockRejectedValue(mockError);

      await expect(localGit.remWorkTree(directory)).rejects.toThrow(mockError);
      expect(mockGitInstance.raw).toHaveBeenCalledTimes(1);
      expect(mockGitInstance.raw).toHaveBeenCalledWith(expectedCommand);
    });
  });
});
