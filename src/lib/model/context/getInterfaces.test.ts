import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { getInterfaces } from "./getInterfaces.js";
import { Worktree } from "../../repository/Worktree.js";
import { FileInfo } from "../../file-info/FileInfo.js";
import path from "path";
import * as glob from "glob";

vi.mock("glob");
vi.mock("../../file-info/FileInfo.js");

describe("getInterfaces", () => {
  let mockWorktree: Worktree;
  let mockFileInfo: Mocked<FileInfo>;

  beforeEach(() => {
    mockFileInfo = {
      getInfo: vi.fn(),
      // Add other methods/properties of FileInfo if needed for other tests
    } as unknown as Mocked<FileInfo>;

    mockWorktree = {
      worktreeDir: "/fake/repo/.cassi/worktrees/task1",
      fileInfo: mockFileInfo,
      repository: undefined, // Add required properties with mock/undefined values
      task: undefined,
      repositoryBranch: "main",
      init: vi.fn(),
      initRepositoryBranch: vi.fn(),
      delete: vi.fn(),
    } as unknown as Worktree; // Use 'as unknown as Worktree' to bypass strict checks if mocks are partial

    vi.mocked(glob.glob).mockClear();
    mockFileInfo.getInfo.mockClear();
  });

  it("should return combined interface prompts for TS files, skipping test files", async () => {
    const files = [
      path.join(mockWorktree.worktreeDir, "src/file1.ts"),
      path.join(mockWorktree.worktreeDir, "src/file2.ts"),
      path.join(mockWorktree.worktreeDir, "src/file3.test.ts"), // This is returned by glob but skipped by the function
      // path.join(mockWorktree.worktreeDir, "dist/ignored.ts"), // This should NOT be returned by the mocked glob due to ignore pattern
    ];
    // Mock glob to return only files that match the pattern AND are not ignored
    vi.mocked(glob.glob).mockResolvedValue([
      path.join(mockWorktree.worktreeDir, "src/file1.ts"),
      path.join(mockWorktree.worktreeDir, "src/file2.ts"),
      path.join(mockWorktree.worktreeDir, "src/file3.test.ts"),
    ]);

    mockFileInfo.getInfo
      .mockResolvedValueOnce("Interface for file1")
      .mockResolvedValueOnce("Interface for file2");

    const result = await getInterfaces(mockWorktree);

    expect(glob.glob).toHaveBeenCalledWith("**/*.ts", {
      cwd: mockWorktree.worktreeDir,
      ignore: ["node_modules/**", ".cassi/**", "dist/**"],
      absolute: true,
    });
    expect(mockFileInfo.getInfo).toHaveBeenCalledTimes(2);
    expect(mockFileInfo.getInfo).toHaveBeenCalledWith(
      "interfacePrompt",
      "src/file1.ts"
    );
    expect(mockFileInfo.getInfo).toHaveBeenCalledWith(
      "interfacePrompt",
      "src/file2.ts"
    );
    expect(mockFileInfo.getInfo).not.toHaveBeenCalledWith(
      "interfacePrompt",
      "src/file3.test.ts"
    );
    expect(result).toBe(
      `===== BEGIN FILE_INTERFACES =====\nInterface for file1\n\n--- FILE_SEPARATOR ---\n\nInterface for file2\n===== END FILE_INTERFACES =====`
    );
  });

  it("should return an empty string if no non-test TS files are found", async () => {
    const files = [path.join(mockWorktree.worktreeDir, "src/file3.test.ts")];
    vi.mocked(glob.glob).mockResolvedValue(files);

    const result = await getInterfaces(mockWorktree);

    expect(mockFileInfo.getInfo).not.toHaveBeenCalled();
    expect(result).toBe("");
  });

  it("should handle cases where getInfo returns null", async () => {
    const files = [
      path.join(mockWorktree.worktreeDir, "src/file1.ts"),
      path.join(mockWorktree.worktreeDir, "src/file2.ts"),
    ];
    vi.mocked(glob.glob).mockResolvedValue(files);

    mockFileInfo.getInfo
      .mockResolvedValueOnce("Interface for file1")
      .mockResolvedValueOnce(null); // file2 returns null

    const result = await getInterfaces(mockWorktree);

    expect(mockFileInfo.getInfo).toHaveBeenCalledTimes(2);
    expect(result).toBe(
      `===== BEGIN FILE_INTERFACES =====\nInterface for file1\n===== END FILE_INTERFACES =====`
    );
  });

  it("should join multiple valid prompts correctly", async () => {
    const files = [
      path.join(mockWorktree.worktreeDir, "src/file1.ts"),
      path.join(mockWorktree.worktreeDir, "src/file2.ts"),
      path.join(mockWorktree.worktreeDir, "src/file3.ts"),
    ];
    vi.mocked(glob.glob).mockResolvedValue(files);

    mockFileInfo.getInfo
      .mockResolvedValueOnce("Interface for file1")
      .mockResolvedValueOnce("Interface for file2")
      .mockResolvedValueOnce("Interface for file3");

    const result = await getInterfaces(mockWorktree);

    expect(result).toBe(
      `===== BEGIN FILE_INTERFACES =====\nInterface for file1\n\n--- FILE_SEPARATOR ---\n\nInterface for file2\n\n--- FILE_SEPARATOR ---\n\nInterface for file3\n===== END FILE_INTERFACES =====`
    );
  });
});
