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
    diff: vi.fn(),
    add: vi.fn(),
    commit: vi.fn(),
    rebase: vi.fn(),
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

  describe("diff", () => {
    it("should call git.diff with an empty array when no target is provided", async () => {
      const expectedDiffOutput =
        "diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old content\n+new content";
      vi.mocked(mockGitInstance.diff).mockResolvedValue(expectedDiffOutput);

      const diffOutput = await localGit.diff();

      expect(mockGitInstance.diff).toHaveBeenCalledTimes(1);
      expect(mockGitInstance.diff).toHaveBeenCalledWith([]);
      expect(diffOutput).toBe(expectedDiffOutput);
    });

    it("should call git.diff with [target] when a target is provided", async () => {
      const target = "develop";
      const expectedDiffOutput =
        "diff --git a/another.txt b/another.txt\n--- a/another.txt\n+++ b/another.txt\n@@ -1 +1 @@\n-old line\n+new line";
      vi.mocked(mockGitInstance.diff).mockResolvedValue(expectedDiffOutput);

      const diffOutput = await localGit.diff(target);

      expect(mockGitInstance.diff).toHaveBeenCalledTimes(1);
      expect(mockGitInstance.diff).toHaveBeenCalledWith([target]);
      expect(diffOutput).toBe(expectedDiffOutput);
    });

    it("should handle errors from git.diff when calling diff", async () => {
      const mockError = new Error("Git diff failed");
      vi.mocked(mockGitInstance.diff).mockRejectedValue(mockError);

      await expect(localGit.diff()).rejects.toThrow(mockError);
      expect(mockGitInstance.diff).toHaveBeenCalledTimes(1);
      expect(mockGitInstance.diff).toHaveBeenCalledWith([]);
    });

    it("should handle errors from git.diff when calling diff with a target", async () => {
      const target = "main";
      const mockError = new Error("Git diff target failed");
      vi.mocked(mockGitInstance.diff).mockRejectedValue(mockError);

      await expect(localGit.diff(target)).rejects.toThrow(mockError);
      expect(mockGitInstance.diff).toHaveBeenCalledTimes(1);
      expect(mockGitInstance.diff).toHaveBeenCalledWith([target]);
    });
  });

  describe("commitAll", () => {
    it("should call git.add with './*' and then git.commit with the message", async () => {
      const commitMessage = "Test commit message";
      const mockCommitResult = {
        commit: "abcdef123",
        author: null,
        branch: "",
        summary: { changes: 0, deletions: 0, insertions: 0 },
        root: false,
      };

      const addMock = vi.mocked(mockGitInstance.add).mockResolvedValue(""); // Fix: add resolves with string
      const commitMock = vi
        .mocked(mockGitInstance.commit)
        .mockResolvedValue(mockCommitResult);

      const result = await localGit.commitAll(commitMessage);

      expect(addMock).toHaveBeenCalledTimes(1);
      expect(addMock).toHaveBeenCalledWith("./*");
      expect(commitMock).toHaveBeenCalledTimes(1);
      expect(commitMock).toHaveBeenCalledWith(commitMessage);
      expect(result).toEqual(mockCommitResult);
    });

    it("should handle errors from git.add", async () => {
      const commitMessage = "Test commit message";
      const mockError = new Error("Git add failed");
      vi.mocked(mockGitInstance.add).mockRejectedValue(mockError);

      await expect(localGit.commitAll(commitMessage)).rejects.toThrow(
        mockError
      );
      expect(mockGitInstance.add).toHaveBeenCalledTimes(1);
      expect(mockGitInstance.add).toHaveBeenCalledWith("./*");
      expect(mockGitInstance.commit).not.toHaveBeenCalled();
    });

    it("should handle errors from git.commit", async () => {
      const commitMessage = "Test commit message";
      const mockError = new Error("Git commit failed");
      vi.mocked(mockGitInstance.add).mockResolvedValue(""); // Fix: add resolves with string
      vi.mocked(mockGitInstance.commit).mockRejectedValue(mockError);

      await expect(localGit.commitAll(commitMessage)).rejects.toThrow(
        mockError
      );
      expect(mockGitInstance.add).toHaveBeenCalledTimes(1);
      expect(mockGitInstance.add).toHaveBeenCalledWith("./*");
      expect(mockGitInstance.commit).toHaveBeenCalledTimes(1);
      expect(mockGitInstance.commit).toHaveBeenCalledWith(commitMessage);
    });
  });

  describe("rebase", () => {
    it("should call git.rebase with undefined options when no options are provided", async () => {
      const mockRebaseResult = "Rebase successful";
      vi.mocked(mockGitInstance.rebase).mockResolvedValue(mockRebaseResult);

      const result = await localGit.rebase();

      expect(mockGitInstance.rebase).toHaveBeenCalledTimes(1);
      expect(mockGitInstance.rebase).toHaveBeenCalledWith([]); // Expect empty array now
      expect(result).toBe(mockRebaseResult);
    });

    it("should call git.rebase with the provided options array", async () => {
      const options = ["--interactive", "main"];
      const mockRebaseResult = "Interactive rebase successful";
      vi.mocked(mockGitInstance.rebase).mockResolvedValue(mockRebaseResult);

      const result = await localGit.rebase(...options);

      expect(mockGitInstance.rebase).toHaveBeenCalledTimes(1);
      expect(mockGitInstance.rebase).toHaveBeenCalledWith(options);
      expect(result).toBe(mockRebaseResult);
    });

    it("should handle errors from git.rebase", async () => {
      const options = ["--abort"];
      const mockError = new Error("Git rebase failed");
      vi.mocked(mockGitInstance.rebase).mockRejectedValue(mockError);

      await expect(localGit.rebase(...options)).rejects.toThrow(mockError);
      expect(mockGitInstance.rebase).toHaveBeenCalledTimes(1);
      expect(mockGitInstance.rebase).toHaveBeenCalledWith(options);
    });
  });
});
