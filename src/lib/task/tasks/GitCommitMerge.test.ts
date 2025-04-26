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
  let mockGetTaskIdShort: ReturnType<typeof vi.fn>;

  const mockCwd = "/mock/cwd";
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
    task.getTaskIdShort = mockGetTaskIdShort;
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
        throw new Error(`Unexpected invoke call: ${tool}.${method}`);
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
    expect(task.getCwd).toHaveBeenCalledTimes(3); // status, diff, commitAll
    expect(mockGetTaskIdShort).toHaveBeenCalledTimes(1);
  });

  it("should be an instance of Task", () => {
    expect(new GitCommitMerge(mockCassi)).toBeInstanceOf(Task);
  });
});
