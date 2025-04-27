import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitCommitMerge } from "./GitCommitMerge.js";
import { Task } from "../Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import { StatusResult } from "simple-git";
import { CommitMessage } from "../../model/models/CommitMessage.js";
import { gemini25FlashPreview0417 } from "@genkit-ai/googleai"; // Import the requested model

const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});

const mockCassi = {} as Cassi;

describe("GitCommitMerge", () => {
  let task: GitCommitMerge;
  let mockInvoke: ReturnType<typeof vi.fn>;
  let mockNewModel: ReturnType<typeof vi.fn>;
  let mockCommitMessageModel: Partial<CommitMessage>;
  let mockGenerate: ReturnType<typeof vi.fn>;
  let mockGetTaskId: ReturnType<typeof vi.fn>;
  let mockGetTaskIdShort: ReturnType<typeof vi.fn>;
  let mockGetWorkTree: ReturnType<typeof vi.fn>;

  const mockCwd = "/mock/cwd";
  const mockTaskId = "task-123";
  const mockTaskIdShort = "abc1234";
  const mockCleanStatus: StatusResult = {
    isClean: () => true,
  } as StatusResult;
  const mockDirtyStatus: StatusResult = {
    isClean: () => false,
    files: [{ path: "file.txt", index: "M", working_dir: " " }],
  } as StatusResult;
  const mockDiffResult = "diff --git a/file.txt b/file.txt...";
  const mockGeneratedMessage = "feat: Update file.txt\n\n- Made changes";
  const mockRepositoryBranch = "main";
  const mockRebaseResult = "Successfully rebased and updated refs/heads/main.";
  const mockMergeResult = "Merge made by the 'recursive' strategy.";
  const mockRebaseConflictResult =
    "CONFLICT (content): Merge conflict in file.txt";

  beforeEach(() => {
    consoleLogSpy.mockClear();
    task = new GitCommitMerge(mockCassi);
    mockInvoke = vi.fn();
    mockNewModel = vi.fn();
    mockGenerate = vi.fn().mockResolvedValue(mockGeneratedMessage);

    mockCommitMessageModel = {
      generate: mockGenerate,
    };

    task.getCwd = vi.fn().mockReturnValue(mockCwd);
    (task as any).invoke = mockInvoke;
    task.newModel = mockNewModel.mockReturnValue(
      mockCommitMessageModel as CommitMessage
    );
    mockGetTaskIdShort = vi.fn().mockReturnValue(mockTaskIdShort);
    mockGetTaskId = vi.fn().mockReturnValue(mockTaskId);
    task.getTaskId = mockGetTaskId;
    mockGetTaskIdShort = vi.fn().mockReturnValue(mockTaskIdShort);
    task.getTaskIdShort = mockGetTaskIdShort;
    mockGetWorkTree = vi.fn().mockReturnValue({
      repositoryBranch: mockRepositoryBranch,
    });
    task.getWorkTree = mockGetWorkTree;
  });

  it("should log 'No changes to commit' and return if status is clean", async () => {
    mockInvoke.mockImplementation(
      async (tool: string, method: string, args?: any[]) => {
        if (tool === "git" && method === "status" && args?.[0] === mockCwd) {
          return mockCleanStatus;
        }
        throw new Error(`Unexpected invoke call: ${tool}.${method}`);
      }
    );

    await task.initTask();

    expect(mockInvoke).toHaveBeenCalledWith("git", "status", [mockCwd]);
    expect(consoleLogSpy).toHaveBeenCalledWith("No changes to commit");
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "git",
      "diff",
      expect.anything()
    );
    expect(task.getCwd).toHaveBeenCalledTimes(1);
  });

  it("should call git diff, generate commit message, and log result if status is not clean", async () => {
    mockInvoke.mockImplementation(
      async (
        tool: string,
        method: string,
        argArray1?: any[],
        argArray2?: any[]
      ) => {
        // Handle status call
        if (
          tool === "git" &&
          method === "status" &&
          argArray1?.[0] === mockCwd
        ) {
          return mockDirtyStatus;
        }
        // Handle diff call
        if (tool === "git" && method === "diff" && argArray1?.[0] === mockCwd) {
          return mockDiffResult;
        }
        // Handle commitAll call
        if (
          tool === "git" &&
          method === "commitAll" &&
          argArray1?.[0] === mockCwd &&
          argArray2?.[0] === `${mockTaskIdShort}: ${mockGeneratedMessage}`
        ) {
          return; // commitAll doesn't return anything significant
        }
        // Handle rebase call
        if (
          tool === "git" &&
          method === "rebase" &&
          argArray1?.[0] === mockCwd &&
          argArray2?.[0] === mockRepositoryBranch
        ) {
          return mockRebaseResult;
        }
        // Handle merge call
        if (
          tool === "git" &&
          method === "merge" &&
          argArray1?.length === 0 && // No positional args
          argArray2?.[0] === mockTaskId
        ) {
          return mockMergeResult;
        }
        throw new Error(
          `Unexpected invoke call: ${tool}.${method} with args ${JSON.stringify(
            argArray1
          )} ${JSON.stringify(argArray2)}`
        );
      }
    );

    await task.initTask();

    expect(mockInvoke).toHaveBeenCalledWith("git", "status", [mockCwd]);
    expect(mockInvoke).toHaveBeenCalledWith("git", "diff", [mockCwd]);
    expect(mockNewModel).toHaveBeenCalledWith("CommitMessage");
    expect(mockGenerate).toHaveBeenCalledWith({
      model: gemini25FlashPreview0417, // Use the requested model reference
      prompt: mockDiffResult,
    });
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "[GitCommitMerge Task] Starting initTask"
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "Generated Commit Message:",
      `${mockTaskIdShort}: ${mockGeneratedMessage}`
    );
    expect(consoleLogSpy).not.toHaveBeenCalledWith("No changes to commit");
    expect(mockInvoke).toHaveBeenCalledWith(
      "git",
      "commitAll",
      [mockCwd],
      [`${mockTaskIdShort}: ${mockGeneratedMessage}`]
    );
    // Now expecting 4 calls to getCwd: status, diff, commitAll, rebase
    expect(task.getCwd).toHaveBeenCalledTimes(4);
    expect(mockGetTaskIdShort).toHaveBeenCalledTimes(1);
    expect(mockGetTaskId).toHaveBeenCalledTimes(1); // For the merge call
    // We don't need to assert rebase wasn't called anymore, as it *is* called.
    // We can optionally assert it *was* called if desired, but the main focus
    // of this test is the commit message generation.
    // Let's remove the negative assertion:
    // expect(mockInvoke).not.toHaveBeenCalledWith(
    //   "git",
    //   "rebase",
    //   expect.anything(),
    //   expect.anything()
    // );
    // Add assertion for getWorkTree call
    expect(mockGetWorkTree).toHaveBeenCalledTimes(1);
  });

  it("should call git rebase after commitAll and log the result", async () => {
    mockInvoke.mockImplementation(
      async (
        tool: string,
        method: string,
        argArray1?: any[],
        argArray2?: any[]
      ) => {
        if (tool === "git" && method === "status") return mockDirtyStatus;
        if (tool === "git" && method === "diff") return mockDiffResult;
        if (tool === "git" && method === "commitAll") return; // No return value
        if (
          tool === "git" &&
          method === "rebase" &&
          argArray1?.[0] === mockCwd &&
          argArray2?.[0] === mockRepositoryBranch
        ) {
          return mockRebaseResult;
        }
        // Handle merge call
        if (
          tool === "git" &&
          method === "merge" &&
          argArray1?.length === 0 &&
          argArray2?.[0] === mockTaskId
        ) {
          return mockMergeResult;
        }
        throw new Error(
          `Unexpected invoke call: ${tool}.${method} with args ${JSON.stringify(
            argArray1
          )} ${JSON.stringify(argArray2)}`
        );
      }
    );

    await task.initTask();

    expect(mockInvoke).toHaveBeenCalledWith("git", "status", [mockCwd]);
    expect(mockInvoke).toHaveBeenCalledWith("git", "diff", [mockCwd]);
    expect(mockInvoke).toHaveBeenCalledWith(
      "git",
      "commitAll",
      [mockCwd],
      [`${mockTaskIdShort}: ${mockGeneratedMessage}`]
    );
    expect(mockInvoke).toHaveBeenCalledWith(
      "git",
      "rebase",
      [mockCwd],
      [mockRepositoryBranch]
    );
    expect(task.getCwd).toHaveBeenCalledTimes(4); // status, diff, commitAll, rebase
    expect(mockGetTaskIdShort).toHaveBeenCalledTimes(1);
    expect(mockGetTaskId).toHaveBeenCalledTimes(1); // For the merge call
    expect(mockGetWorkTree).toHaveBeenCalledTimes(1);
  });

  it("should be an instance of Task", () => {
    expect(new GitCommitMerge(mockCassi)).toBeInstanceOf(Task);
  });

  it("should throw an error if rebase result contains 'CONFLICT'", async () => {
    // Simplified mock implementation for this specific test case
    mockInvoke.mockImplementation(
      async (
        tool: string,
        method: string,
        argArray1?: any[],
        argArray2?: any[]
      ) => {
        if (tool === "git" && method === "status") return mockDirtyStatus;
        if (tool === "git" && method === "diff") return mockDiffResult;
        if (tool === "git" && method === "commitAll") return; // No return value needed
        if (
          tool === "git" &&
          method === "rebase" &&
          argArray1?.[0] === mockCwd &&
          argArray2?.[0] === mockRepositoryBranch
        ) {
          // Simulate invoke throwing an error on conflict
          throw new Error(mockRebaseConflictResult);
        }
        // Throw for any unexpected calls within this specific test
        throw new Error(
          `Unexpected invoke call in conflict test: ${tool}.${method}`
        );
      }
    );

    try {
      // This test now behaves like the 'invoke call fails' test,
      // but we expect the specific conflict error message wrapped.
      await expect(task.initTask()).rejects.toThrowError(
        `Error during rebase for ${mockCwd}: ${mockRebaseConflictResult}`
      );
    } catch (error) {
      // This catch block might not be strictly necessary anymore with rejects.toThrowError,
      // but we keep the structure for clarity and potential debugging.
      // If rejects.toThrowError fails, this catch won't execute as expected.
      // If it passes, this catch is also bypassed.
      // We rely on rejects.toThrowError for the primary assertion.
      console.error("Caught unexpected error in test:", error); // Should not happen if rejects works
      throw error; // Re-throw if something unexpected is caught
    }

    // Verify mocks were called as expected up to the point of failure
    expect(mockInvoke).toHaveBeenCalledWith("git", "status", [mockCwd]);
    expect(mockInvoke).toHaveBeenCalledWith("git", "diff", [mockCwd]);
    expect(mockInvoke).toHaveBeenCalledWith(
      "git",
      "commitAll",
      [mockCwd],
      [`${mockTaskIdShort}: ${mockGeneratedMessage}`]
    );
    expect(mockInvoke).toHaveBeenCalledWith(
      "git",
      "rebase",
      [mockCwd],
      [mockRepositoryBranch]
    );
    // status, diff, commitAll, rebase, error message
    expect(task.getCwd).toHaveBeenCalledTimes(5);
    expect(mockGetTaskIdShort).toHaveBeenCalledTimes(1);
    expect(mockGetWorkTree).toHaveBeenCalledTimes(1);
    expect(mockGetTaskId).not.toHaveBeenCalled(); // Merge should not be attempted if rebase fails
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "git",
      "merge",
      expect.anything(),
      expect.anything()
    ); // Merge should not be called if rebase fails
  });

  it("should call git merge after successful rebase", async () => {
    mockInvoke.mockImplementation(
      async (
        tool: string,
        method: string,
        argArray1?: any[],
        argArray2?: any[]
      ) => {
        if (tool === "git" && method === "status") return mockDirtyStatus;
        if (tool === "git" && method === "diff") return mockDiffResult;
        if (tool === "git" && method === "commitAll") return;
        if (tool === "git" && method === "rebase") return mockRebaseResult;
        if (
          tool === "git" &&
          method === "merge" &&
          argArray1?.length === 0 &&
          argArray2?.[0] === mockTaskId
        ) {
          return mockMergeResult;
        }
        throw new Error(
          `Unexpected invoke call: ${tool}.${method} with args ${JSON.stringify(
            argArray1
          )} ${JSON.stringify(argArray2)}`
        );
      }
    );

    await task.initTask();

    expect(mockInvoke).toHaveBeenCalledWith("git", "status", [mockCwd]);
    expect(mockInvoke).toHaveBeenCalledWith("git", "diff", [mockCwd]);
    expect(mockInvoke).toHaveBeenCalledWith(
      "git",
      "commitAll",
      [mockCwd],
      [`${mockTaskIdShort}: ${mockGeneratedMessage}`]
    );
    expect(mockInvoke).toHaveBeenCalledWith(
      "git",
      "rebase",
      [mockCwd],
      [mockRepositoryBranch]
    );
    expect(mockInvoke).toHaveBeenCalledWith("git", "merge", [], [mockTaskId]); // Verify merge call
    expect(task.getCwd).toHaveBeenCalledTimes(4); // status, diff, commitAll, rebase
    expect(mockGetTaskIdShort).toHaveBeenCalledTimes(1);
    expect(mockGetTaskId).toHaveBeenCalledTimes(1); // For the merge call
    expect(mockGetWorkTree).toHaveBeenCalledTimes(1);
  });

  it("should throw an error if the invoke call for rebase fails", async () => {
    const rebaseError = new Error("Git rebase command failed");
    mockInvoke.mockImplementation(
      async (
        tool: string,
        method: string,
        argArray1?: any[],
        argArray2?: any[]
      ) => {
        if (tool === "git" && method === "status") return mockDirtyStatus;
        if (tool === "git" && method === "diff") return mockDiffResult;
        if (tool === "git" && method === "commitAll") return;
        if (
          tool === "git" &&
          method === "rebase" &&
          argArray1?.[0] === mockCwd &&
          argArray2?.[0] === mockRepositoryBranch
        ) {
          throw rebaseError; // Simulate invoke throwing an error
        }
        throw new Error(
          `Unexpected invoke call: ${tool}.${method} with args ${JSON.stringify(
            argArray1
          )} ${JSON.stringify(argArray2)}`
        );
      }
    );

    await expect(task.initTask()).rejects.toThrowError(
      `Error during rebase for ${mockCwd}: ${rebaseError.message}`
    );

    expect(mockInvoke).toHaveBeenCalledWith("git", "status", [mockCwd]);
    expect(mockInvoke).toHaveBeenCalledWith("git", "diff", [mockCwd]);
    expect(mockInvoke).toHaveBeenCalledWith(
      "git",
      "commitAll",
      [mockCwd],
      [`${mockTaskIdShort}: ${mockGeneratedMessage}`]
    );
    expect(mockInvoke).toHaveBeenCalledWith(
      "git",
      "rebase",
      [mockCwd],
      [mockRepositoryBranch]
    );
    // status, diff, commitAll, rebase, error message
    expect(task.getCwd).toHaveBeenCalledTimes(5);
    expect(mockGetTaskIdShort).toHaveBeenCalledTimes(1);
    expect(mockGetWorkTree).toHaveBeenCalledTimes(1);
    expect(mockGetTaskId).not.toHaveBeenCalled(); // Merge should not be attempted if rebase fails
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "git",
      "merge",
      expect.anything(),
      expect.anything()
    );
  });
});
