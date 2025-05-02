import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitCommitMerge } from "./GitCommitMerge.js";
import { Task } from "../Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import { StatusResult } from "simple-git";
import { CommitMessage } from "../../model/models/CommitMessage.js";
import { Prompt } from "../../prompt/Prompt.js";
import Confirm from "../../prompt/prompts/Confirm.js";
import { User } from "../../user/User.js";
import { gemini25FlashPreview0417 } from "@genkit-ai/googleai";

const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});

const mockUserPrompt = vi.fn();
const mockUser = {
  prompt: mockUserPrompt,
} as unknown as User;

const mockCassi = {
  user: mockUser,
} as Cassi;

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
    vi.clearAllMocks();
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

    mockUserPrompt.mockResolvedValue(undefined);
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

    expect(mockUserPrompt).not.toHaveBeenCalled();

    expect(mockInvoke).toHaveBeenCalledWith("git", "status", [mockCwd]);
    expect(consoleLogSpy).toHaveBeenCalledWith("No changes to commit");
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "git",
      "diff",
      expect.anything()
    );
    expect(task.getCwd).toHaveBeenCalledTimes(1);
    expect(mockUserPrompt).not.toHaveBeenCalled();
  });

  it("should call git diff, generate commit message, prompt, commit, rebase, and merge if status is not clean and user confirms", async () => {
    mockInvoke.mockImplementation(
      async (
        tool: string,
        method: string,
        argArray1?: any[],
        argArray2?: any[]
      ) => {
        if (
          tool === "git" &&
          method === "status" &&
          argArray1?.[0] === mockCwd
        ) {
          return mockDirtyStatus;
        }
        if (tool === "git" && method === "diff" && argArray1?.[0] === mockCwd) {
          return mockDiffResult;
        }
        if (
          tool === "git" &&
          method === "commitAll" &&
          argArray1?.[0] === mockCwd &&
          argArray2?.[0] === `${mockTaskIdShort}: ${mockGeneratedMessage}`
        ) {
          return;
        }
        if (
          tool === "git" &&
          method === "rebase" &&
          argArray1?.[0] === mockCwd &&
          argArray2?.[0] === mockRepositoryBranch
        ) {
          return mockRebaseResult;
        }
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
    expect(mockNewModel).toHaveBeenCalledWith("CommitMessage");
    expect(mockGenerate).toHaveBeenCalledWith({
      model: gemini25FlashPreview0417,
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
    expect(task.getCwd).toHaveBeenCalledTimes(4);
    expect(mockGetTaskIdShort).toHaveBeenCalledTimes(1);
    expect(mockGetTaskId).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith(
      "git",
      "rebase",
      [mockCwd],
      [mockRepositoryBranch]
    );
    expect(mockUserPrompt).toHaveBeenCalledTimes(1);
    const promptArg = mockUserPrompt.mock.calls[0][0] as Prompt;
    expect(promptArg).toBeInstanceOf(Confirm);
    expect((promptArg as Confirm).message).toContain(mockDiffResult);
    expect((promptArg as Confirm).message).toContain(
      `${mockTaskIdShort}: ${mockGeneratedMessage}`
    );

    expect(mockInvoke).toHaveBeenCalledWith(
      "git",
      "rebase",
      [mockCwd],
      [mockRepositoryBranch]
    );
    expect(mockInvoke).toHaveBeenCalledWith("git", "merge", [], [mockTaskId]);
    expect(mockGetWorkTree).toHaveBeenCalledTimes(1);
    expect(mockGetTaskId).toHaveBeenCalledTimes(1);
    expect(mockUserPrompt).toHaveBeenCalledTimes(1);
  });

  it("should not commit, rebase, or merge if prompt handler throws (simulating denial)", async () => {
    const promptError = new Error("User denied confirmation");
    mockUserPrompt.mockRejectedValue(promptError);

    mockInvoke.mockImplementation(
      async (
        tool: string,
        method: string,
        argArray1?: any[],
        argArray2?: any[]
      ) => {
        if (
          tool === "git" &&
          method === "status" &&
          argArray1?.[0] === mockCwd
        ) {
          return mockDirtyStatus;
        }
        if (tool === "git" && method === "diff" && argArray1?.[0] === mockCwd) {
          return mockDiffResult;
        }
        throw new Error(
          `Unexpected invoke call when commit denied: ${tool}.${method}`
        );
      }
    );

    expect(mockInvoke).not.toHaveBeenCalledWith(
      "git",
      "commitAll",
      expect.anything(),
      expect.anything()
    );
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "git",
      "rebase",
      expect.anything(),
      expect.anything()
    );
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "git",
      "merge",
      expect.anything(),
      expect.anything()
    );

    await expect(task.initTask()).rejects.toThrow(promptError);

    expect(mockUserPrompt).toHaveBeenCalledTimes(1);

    expect(consoleLogSpy).not.toHaveBeenCalledWith("Commit cancelled by user.");
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      "Commit confirmed by user (or prompt handler allows proceeding). Committing..."
    );

    expect(task.getCwd).toHaveBeenCalledTimes(2);
    expect(mockGetTaskIdShort).toHaveBeenCalledTimes(1);
    expect(mockGetWorkTree).not.toHaveBeenCalled();
    expect(mockGetTaskId).not.toHaveBeenCalled();
  });

  it("should call git rebase after commitAll if user confirms", async () => {
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
          return mockRebaseResult;
        }
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
    expect(task.getCwd).toHaveBeenCalledTimes(4);
    expect(mockGetTaskIdShort).toHaveBeenCalledTimes(1);
    expect(mockGetTaskId).toHaveBeenCalledTimes(1);
    expect(mockGetWorkTree).toHaveBeenCalledTimes(1);
    expect(mockUserPrompt).toHaveBeenCalledTimes(1);
  });

  it("should be an instance of Task", () => {
    expect(new GitCommitMerge(mockCassi)).toBeInstanceOf(Task);
  });

  it("should throw an error if rebase result contains 'CONFLICT'", async () => {
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
          throw new Error(mockRebaseConflictResult);
        }
        throw new Error(
          `Unexpected invoke call in conflict test: ${tool}.${method}`
        );
      }
    );

    try {
      await expect(task.initTask()).rejects.toThrowError(
        `Error during rebase for ${mockCwd}: ${mockRebaseConflictResult}`
      );
    } catch (error) {
      console.error("Caught unexpected error in test:", error);
      throw error;
    }

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
    expect(task.getCwd).toHaveBeenCalledTimes(5);
    expect(mockGetTaskIdShort).toHaveBeenCalledTimes(1);
    expect(mockGetWorkTree).toHaveBeenCalledTimes(1);
    expect(mockGetTaskId).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "git",
      "merge",
      expect.anything(),
      expect.anything()
    );
    expect(mockUserPrompt).toHaveBeenCalledTimes(1);
  });

  it("should call git merge after successful rebase if user confirms", async () => {
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
    expect(mockInvoke).toHaveBeenCalledWith("git", "merge", [], [mockTaskId]);
    expect(task.getCwd).toHaveBeenCalledTimes(4);
    expect(mockGetTaskIdShort).toHaveBeenCalledTimes(1);
    expect(mockGetTaskId).toHaveBeenCalledTimes(1);
    expect(mockGetWorkTree).toHaveBeenCalledTimes(1);
    expect(mockUserPrompt).toHaveBeenCalledTimes(1);
  });

  it("should throw an error if the invoke call for rebase fails (after user confirmation)", async () => {
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
          throw rebaseError;
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
    expect(task.getCwd).toHaveBeenCalledTimes(5);
    expect(mockGetTaskIdShort).toHaveBeenCalledTimes(1);
    expect(mockGetWorkTree).toHaveBeenCalledTimes(1);
    expect(mockGetTaskId).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "git",
      "merge",
      expect.anything(),
      expect.anything()
    );
    expect(mockUserPrompt).toHaveBeenCalledTimes(1);
  });
});
