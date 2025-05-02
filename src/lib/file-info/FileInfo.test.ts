import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { FileInfo } from "./FileInfo.js";
import { FileInfoCache } from "./FileInfoCache.js";
import { AstProvider } from "./providers/AstProvider.js";
import { InterfaceProvider } from "./providers/InterfaceProvider.js";
import type { FileInfoProvider } from "./providers/FileInfoProvider.js";
import type { CacheEntry } from "./types.js";

vi.mock("node:fs/promises");
vi.mock("./FileInfoCache.js");
vi.mock("./providers/AstProvider.js");
vi.mock("./providers/InterfaceProvider.js");

const MOCK_REPO_ROOT = "/fake/repo";
const MOCK_WT_ROOT = "/fake/repo/.cassi/worktrees/test-wt";
const MOCK_RELATIVE_PATH = "src/index.ts";
const MOCK_ABSOLUTE_REPO_PATH = path.join(MOCK_REPO_ROOT, MOCK_RELATIVE_PATH);
const MOCK_ABSOLUTE_WT_PATH = path.join(MOCK_WT_ROOT, MOCK_RELATIVE_PATH);

describe("FileInfo", () => {
  let repoFileInfo: FileInfo;
  let worktreeFileInfo: FileInfo;
  let mockCacheInstance: FileInfoCache;
  let mockAstProviderInstance: AstProvider;
  let mockInterfaceProviderInstance: InterfaceProvider;

  const mockAstProvider: FileInfoProvider = {
    extractInfo: vi.fn().mockResolvedValue({ type: "ast", content: "parsed" }),
  };
  const mockInterfaceProvider: FileInfoProvider = {
    extractInfo: vi.fn().mockResolvedValue({ imports: [], exports: [] }),
  };

  beforeEach(() => {

    (FileInfo as any).providerRegistry?.clear();
    (FileInfo as any).providersRegistered = false;
    (FileInfo as any).globalFileInfoCache = null;

    mockCacheInstance = new FileInfoCache(MOCK_REPO_ROOT);
    mockAstProviderInstance = new AstProvider();
    mockInterfaceProviderInstance = new InterfaceProvider();

    (AstProvider as Mock).mockImplementation(() => mockAstProvider);
    (InterfaceProvider as Mock).mockImplementation(() => mockInterfaceProvider);

    repoFileInfo = new FileInfo(MOCK_REPO_ROOT);
    mockCacheInstance = (repoFileInfo as any).fileInfoCache;

    worktreeFileInfo = new FileInfo(MOCK_REPO_ROOT, MOCK_WT_ROOT, repoFileInfo);

    vi.clearAllMocks();

    vi.mocked(fs.readFile).mockResolvedValue("file content");
    vi.mocked(mockCacheInstance.readCache).mockResolvedValue(null);
    vi.mocked(mockCacheInstance.calculateFileStatsAndHash).mockResolvedValue({
      mtime: 1000,
      size: 100,
      hash: "initialHash",
    });
    vi.mocked(mockCacheInstance.writeCache).mockResolvedValue(undefined);
    vi.mocked(mockCacheInstance.deleteWorktreeCache).mockResolvedValue(
      undefined
    );
  });

  afterEach(() => {
  });

  it("should create repository FileInfo instance correctly", async () => {
    expect(repoFileInfo).toBeInstanceOf(FileInfo);
    expect(repoFileInfo.repositoryDir).toBe(MOCK_REPO_ROOT);
    expect(repoFileInfo.worktreeDir).toBeUndefined();
    expect((repoFileInfo as any).repositoryFileInfo).toBeUndefined();
    expect((repoFileInfo as any).fileInfoCache).toBeInstanceOf(FileInfoCache);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    await repoFileInfo.getInfo("ast", "dummy.ts");
    await repoFileInfo.getInfo("interface", "dummy.ts");
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("No provider registered for infoType: ast")
    );
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("No provider registered for infoType: interface")
    );
    consoleErrorSpy.mockRestore();
  });

  it("should create worktree FileInfo instance correctly", () => {
    expect(worktreeFileInfo).toBeInstanceOf(FileInfo);
    expect(worktreeFileInfo.repositoryDir).toBe(MOCK_REPO_ROOT);
    expect(worktreeFileInfo.worktreeDir).toBe(MOCK_WT_ROOT);
    expect((worktreeFileInfo as any).repositoryFileInfo).toBe(repoFileInfo);
    expect((worktreeFileInfo as any).fileInfoCache).toBe(
      (repoFileInfo as any).fileInfoCache
    );
  });

  describe("getFileContent", () => {
    it("should read content from repository path", async () => {
      const content = "repo content";
      vi.mocked(fs.readFile).mockResolvedValue(content);
      const result = await repoFileInfo.getFileContent(MOCK_RELATIVE_PATH);
      expect(fs.readFile).toHaveBeenCalledWith(
        MOCK_ABSOLUTE_REPO_PATH,
        "utf-8"
      );
      expect(result).toBe(content);
    });

    it("should read content from worktree path", async () => {
      const content = "worktree content";
      vi.mocked(fs.readFile).mockResolvedValue(content);
      const result = await worktreeFileInfo.getFileContent(MOCK_RELATIVE_PATH);
      expect(fs.readFile).toHaveBeenCalledWith(MOCK_ABSOLUTE_WT_PATH, "utf-8");
      expect(result).toBe(content);
    });

    it("should return null if file not found (ENOENT)", async () => {
      const error = new Error("Not found") as any;
      error.code = "ENOENT";
      vi.mocked(fs.readFile).mockRejectedValue(error);
      const result = await repoFileInfo.getFileContent(MOCK_RELATIVE_PATH);
      expect(result).toBeNull();
    });

    it("should throw other read errors", async () => {
      const error = new Error("Permission denied");
      vi.mocked(fs.readFile).mockRejectedValue(error);
      await expect(
        repoFileInfo.getFileContent(MOCK_RELATIVE_PATH)
      ).rejects.toThrow("Permission denied");
    });
  });

  describe("getInfo", () => {
    const infoType = "ast";
    const mockAstData = { type: "ast", content: "parsed" };
    const mockCachePathRepo = "/cache/repo/src__index.ts_ast_.info";
    const mockCachePathWt = "/cache/wt/src__index.ts_ast_.info";
    const currentRepoStats = { mtime: 1000, size: 100, hash: "repoHash1" };
    const currentWtStats = { mtime: 2000, size: 110, hash: "wtHash1" };

    beforeEach(() => {
      vi.mocked(mockCacheInstance.getCachePath).mockImplementation(
        (type, relPath, wtDir) => {
          const encoded = relPath.replace(/\
          const filename = `${encoded}_${type}_.info`;
          return wtDir
            ? path.join("/cache/wt", filename)
            : path.join("/cache/repo", filename);
        }
      );

      vi.mocked(mockCacheInstance.calculateFileStatsAndHash).mockImplementation(
        async (absolutePath) => {
          if (absolutePath === MOCK_ABSOLUTE_REPO_PATH) return currentRepoStats;
          if (absolutePath === MOCK_ABSOLUTE_WT_PATH) return currentWtStats;
          return null;
        }
      );

      vi.mocked(mockAstProvider.extractInfo)
        .mockClear()
        .mockResolvedValue(mockAstData);
    });

    it("should return cached data if mtime/size match", async () => {
      const cachedEntry: CacheEntry = {
        metadata: {
          ...currentRepoStats,
          sourceFilePath: MOCK_ABSOLUTE_REPO_PATH,
        },
        data: mockAstData,
      };
      vi.mocked(mockCacheInstance.readCache).mockResolvedValue(cachedEntry);

      const result = await repoFileInfo.getInfo(infoType, MOCK_RELATIVE_PATH);

      expect(result).toEqual(mockAstData);
      expect(mockCacheInstance.readCache).toHaveBeenCalledWith(
        mockCachePathRepo
      );
      expect(mockCacheInstance.calculateFileStatsAndHash).toHaveBeenCalledWith(
        MOCK_ABSOLUTE_REPO_PATH
      );
      expect(mockAstProvider.extractInfo).not.toHaveBeenCalled();
      expect(mockCacheInstance.writeCache).not.toHaveBeenCalled();
    });

    it("should return cached data if hash matches (mtime/size differ)", async () => {
      const cachedEntry: CacheEntry = {
        metadata: {
          ...currentRepoStats,
          mtime: 999,
          size: 99,
          sourceFilePath: MOCK_ABSOLUTE_REPO_PATH,
        },
        data: mockAstData,
      };
      vi.mocked(mockCacheInstance.readCache).mockResolvedValue(cachedEntry);

      const result = await repoFileInfo.getInfo(infoType, MOCK_RELATIVE_PATH);

      expect(result).toEqual(mockAstData);
      expect(mockCacheInstance.readCache).toHaveBeenCalledWith(
        mockCachePathRepo
      );
      expect(mockCacheInstance.calculateFileStatsAndHash).toHaveBeenCalledWith(
        MOCK_ABSOLUTE_REPO_PATH
      );
      expect(mockAstProvider.extractInfo).not.toHaveBeenCalled();
    });

    it("should call provider and write cache if cache is invalid (stats mismatch)", async () => {
      const cachedEntry: CacheEntry = {
        metadata: {
          mtime: 500,
          size: 50,
          hash: "oldHash",
          sourceFilePath: MOCK_ABSOLUTE_REPO_PATH,
        },
        data: { type: "old data" },
      };
      vi.mocked(mockCacheInstance.readCache).mockResolvedValue(cachedEntry);

      const result = await repoFileInfo.getInfo(infoType, MOCK_RELATIVE_PATH);

      expect(result).toEqual(mockAstData);
      expect(mockCacheInstance.readCache).toHaveBeenCalledWith(
        mockCachePathRepo
      );
      expect(mockCacheInstance.calculateFileStatsAndHash).toHaveBeenCalledWith(
        MOCK_ABSOLUTE_REPO_PATH
      );
      expect(mockAstProvider.extractInfo).toHaveBeenCalledWith(
        MOCK_RELATIVE_PATH,
        repoFileInfo
      );
      expect(mockCacheInstance.writeCache).toHaveBeenCalledWith(
        mockCachePathRepo,
        {
          metadata: {
            ...currentRepoStats,
            sourceFilePath: MOCK_ABSOLUTE_REPO_PATH,
          },
          data: mockAstData,
        }
      );
    });

    it("should call provider and write cache if cache is missing", async () => {
      vi.mocked(mockCacheInstance.readCache).mockResolvedValue(null);

      const result = await repoFileInfo.getInfo(infoType, MOCK_RELATIVE_PATH);

      expect(result).toEqual(mockAstData);
      expect(mockCacheInstance.readCache).toHaveBeenCalledWith(
        mockCachePathRepo
      );
      expect(mockCacheInstance.calculateFileStatsAndHash).toHaveBeenCalledWith(
        MOCK_ABSOLUTE_REPO_PATH
      );
      expect(mockAstProvider.extractInfo).toHaveBeenCalledWith(
        MOCK_RELATIVE_PATH,
        repoFileInfo
      );
      expect(mockCacheInstance.writeCache).toHaveBeenCalledWith(
        mockCachePathRepo,
        {
          metadata: {
            ...currentRepoStats,
            sourceFilePath: MOCK_ABSOLUTE_REPO_PATH,
          },
          data: mockAstData,
        }
      );
    });

    it("should return null if source file stats cannot be calculated", async () => {
      vi.mocked(mockCacheInstance.calculateFileStatsAndHash).mockResolvedValue(
        null
      );
      vi.mocked(mockCacheInstance.readCache).mockResolvedValue(null);

      const result = await repoFileInfo.getInfo(infoType, MOCK_RELATIVE_PATH);

      expect(result).toBeNull();
      expect(mockAstProvider.extractInfo).not.toHaveBeenCalled();
      expect(mockCacheInstance.writeCache).not.toHaveBeenCalled();
    });

    it("should return null if provider returns null", async () => {
      vi.mocked(mockCacheInstance.readCache).mockResolvedValue(null);
      vi.mocked(mockAstProvider.extractInfo).mockResolvedValue(null);

      const result = await repoFileInfo.getInfo(infoType, MOCK_RELATIVE_PATH);

      expect(result).toBeNull();
      expect(mockAstProvider.extractInfo).toHaveBeenCalledWith(
        MOCK_RELATIVE_PATH,
        repoFileInfo
      );
      expect(mockCacheInstance.writeCache).not.toHaveBeenCalled();
    });

    it("should return null if no provider is registered", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const result = await repoFileInfo.getInfo(
        "unregisteredType",
        MOCK_RELATIVE_PATH
      );
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "No provider registered for infoType: unregisteredType"
      );
      consoleSpy.mockRestore();
    });

    it("should throw on circular dependency", async () => {
      vi.mocked(mockAstProvider.extractInfo).mockImplementationOnce(
        async (relPath, fi) => {
          return fi.getInfo(infoType, relPath);
        }
      );
      vi.mocked(mockCacheInstance.readCache).mockResolvedValue(null);

      await expect(
        repoFileInfo.getInfo(infoType, MOCK_RELATIVE_PATH)
      ).rejects.toThrow(/Circular dependency detected/);
    });


    it("WT: should use repo cache and promote if WT file matches repo", async () => {
      const repoStats = { mtime: 1000, size: 100, hash: "sharedHash" };
      const wtStats = { mtime: 2000, size: 100, hash: "sharedHash" };
      const repoAstData = { type: "ast", content: "from repo" };

      vi.mocked(mockCacheInstance.calculateFileStatsAndHash).mockImplementation(
        async (absolutePath) => {
          if (absolutePath === MOCK_ABSOLUTE_REPO_PATH) return repoStats;
          if (absolutePath === MOCK_ABSOLUTE_WT_PATH) return wtStats;
          return null;
        }
      );

      const getFileStatsSpy = vi
        .spyOn(repoFileInfo, "getFileStats")
        .mockResolvedValue(repoStats);

      const repoGetInfoSpy = vi
        .spyOn(repoFileInfo, "getInfo")
        .mockResolvedValue(repoAstData);

      vi.mocked(mockCacheInstance.readCache).mockResolvedValue(null);

      const result = await worktreeFileInfo.getInfo(
        infoType,
        MOCK_RELATIVE_PATH
      );

      expect(result).toEqual(repoAstData);
      expect(mockCacheInstance.readCache).toHaveBeenCalledWith(mockCachePathWt);
      expect(mockCacheInstance.calculateFileStatsAndHash).toHaveBeenCalledWith(
        MOCK_ABSOLUTE_WT_PATH
      );
      expect(getFileStatsSpy).toHaveBeenCalledWith(MOCK_RELATIVE_PATH);
      expect(repoGetInfoSpy).toHaveBeenCalledWith(infoType, MOCK_RELATIVE_PATH);
      expect(mockAstProvider.extractInfo).not.toHaveBeenCalled();
      expect(mockCacheInstance.writeCache).toHaveBeenCalledWith(
        mockCachePathWt,
        {
          metadata: { ...wtStats, sourceFilePath: MOCK_ABSOLUTE_WT_PATH },
          data: repoAstData,
        }
      );

      getFileStatsSpy.mockRestore();
      repoGetInfoSpy.mockRestore();
    });

    it("WT: should use own provider if WT file differs from repo", async () => {
      const repoStats = { mtime: 1000, size: 100, hash: "repoHashOnly" };
      const wtStats = { mtime: 2000, size: 110, hash: "wtHashOnly" };
      const wtAstData = { type: "ast", content: "from worktree" };

      vi.mocked(mockCacheInstance.calculateFileStatsAndHash).mockImplementation(
        async (absolutePath) => {
          if (absolutePath === MOCK_ABSOLUTE_REPO_PATH) return repoStats;
          if (absolutePath === MOCK_ABSOLUTE_WT_PATH) return wtStats;
          return null;
        }
      );
      const getFileStatsSpy = vi
        .spyOn(repoFileInfo, "getFileStats")
        .mockResolvedValue(repoStats);
      const repoGetInfoSpy = vi.spyOn(repoFileInfo, "getInfo");
      vi.mocked(mockAstProvider.extractInfo).mockResolvedValue(wtAstData);
      vi.mocked(mockCacheInstance.readCache).mockResolvedValue(null);

      const result = await worktreeFileInfo.getInfo(
        infoType,
        MOCK_RELATIVE_PATH
      );

      expect(result).toEqual(wtAstData);
      expect(mockCacheInstance.readCache).toHaveBeenCalledWith(mockCachePathWt);
      expect(mockCacheInstance.calculateFileStatsAndHash).toHaveBeenCalledWith(
        MOCK_ABSOLUTE_WT_PATH
      );
      expect(getFileStatsSpy).toHaveBeenCalledWith(MOCK_RELATIVE_PATH);
      expect(repoGetInfoSpy).not.toHaveBeenCalled();
      expect(mockAstProvider.extractInfo).toHaveBeenCalledWith(
        MOCK_RELATIVE_PATH,
        worktreeFileInfo
      );
      expect(mockCacheInstance.writeCache).toHaveBeenCalledWith(
        mockCachePathWt,
        {
          metadata: { ...wtStats, sourceFilePath: MOCK_ABSOLUTE_WT_PATH },
          data: wtAstData,
        }
      );

      getFileStatsSpy.mockRestore();
    });
  });

  describe("deleteCache", () => {
    it("should call FileInfoCache.deleteWorktreeCache for worktree instance", async () => {
      await worktreeFileInfo.deleteCache();
      expect(mockCacheInstance.deleteWorktreeCache).toHaveBeenCalledWith(
        MOCK_WT_ROOT
      );
    });

    it("should warn and not call delete for repository instance", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      await repoFileInfo.deleteCache();
      expect(mockCacheInstance.deleteWorktreeCache).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("non-worktree FileInfo instance")
      );
      consoleSpy.mockRestore();
    });
  });
});
