import { LocalGit } from "./LocalGit.js";
import { simpleGit, SimpleGit, StatusResult } from "simple-git";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"; // Added afterEach
import path from "path";
import fs from "fs-extra";

// Mock the simple-git library
vi.mock("simple-git");
vi.mock("fs-extra", () => ({
  ensureDir: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  default: {
    // Handle default export if needed by other parts of the code
    ensureDir: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("LocalGit", () => {
  let localGit: LocalGit;
  const testRepoPath = path.join(__dirname, "test-repo");
  const mockGitInstance = {
    status: vi.fn(),
  } as unknown as SimpleGit;

  beforeEach(async () => {
    // Reset mocks before each test
    vi.resetAllMocks();

    // Mock the simpleGit function to return our mock instance
    vi.mocked(simpleGit).mockReturnValue(mockGitInstance);

    // Create a dummy directory for testing (optional, depends on test needs)
    await fs.ensureDir(testRepoPath);

    localGit = new LocalGit(testRepoPath);
  });

  afterEach(async () => {
    // Clean up the dummy directory
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
        detached: false, // Add the missing 'detached' property
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
});
