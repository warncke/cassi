import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { FileInfoCache } from "./FileInfoCache.js";
import type { CacheEntry } from "./types.js";

vi.mock("node:fs/promises");
vi.mock("node:crypto");

const MOCK_PROJECT_ROOT = "/fake/project";
const MOCK_CACHE_BASE = path.join(MOCK_PROJECT_ROOT, ".cassi/cache");
const MOCK_REPO_CACHE = path.join(MOCK_CACHE_BASE, "repository");
const MOCK_WT_CACHE = path.join(MOCK_CACHE_BASE, "worktrees/test-wt");

describe("FileInfoCache", () => {
  let fileInfoCache: FileInfoCache;

  beforeEach(() => {
    fileInfoCache = new FileInfoCache(MOCK_PROJECT_ROOT);
    vi.resetAllMocks();
  });

  it("should construct correct base paths", () => {
    expect((fileInfoCache as any).baseCachePath).toBe(MOCK_CACHE_BASE);
    expect((fileInfoCache as any).repositoryCachePath).toBe(MOCK_REPO_CACHE);
  });

  it("should encode path separators", () => {
    const relativePath = "src/lib/utils.ts";
    const expectedEncoded = "src__lib__utils.ts";
    expect((fileInfoCache as any).encodePath(relativePath)).toBe(
      expectedEncoded
    );
  });

  it("should get correct context cache path for repository", () => {
    expect((fileInfoCache as any).getContextCachePath()).toBe(MOCK_REPO_CACHE);
  });

  it("should get correct context cache path for worktree", () => {
    const worktreeDir = "/fake/project/.cassi/worktrees/test-wt";
    expect((fileInfoCache as any).getContextCachePath(worktreeDir)).toBe(
      MOCK_WT_CACHE
    );
  });

  it("should construct correct cache path for repository file", () => {
    const infoType = "ast";
    const relativePath = "src/component.ts";
    const expectedPath = path.join(
      MOCK_REPO_CACHE,
      `src__component.ts_${infoType}_.info`
    );
    expect(fileInfoCache.getCachePath(infoType, relativePath)).toBe(
      expectedPath
    );
  });

  it("should construct correct cache path for worktree file", () => {
    const infoType = "interface";
    const relativePath = "styles/main.css";
    const worktreeDir = "/fake/project/.cassi/worktrees/test-wt";
    const expectedPath = path.join(
      MOCK_WT_CACHE,
      `styles__main.css_${infoType}_.info`
    );
    expect(
      fileInfoCache.getCachePath(infoType, relativePath, worktreeDir)
    ).toBe(expectedPath);
  });

  describe("calculateFileStatsAndHash", () => {
    const mockFilePath = "/fake/project/src/index.ts";
    const mockFileContent = Buffer.from('console.log("hello");');
    const mockHash = "mockSha1Hash";
    const mockStats = {
      isFile: () => true,
      mtimeMs: 1234567890,
      size: mockFileContent.length,
    };

    beforeEach(() => {
      const mockHashInstance = {
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue(mockHash),
      };
      vi.mocked(crypto.createHash).mockReturnValue(mockHashInstance as any);
    });

    it("should return stats and hash for a valid file", async () => {
      vi.mocked(fs.stat).mockResolvedValue(mockStats as any);
      vi.mocked(fs.readFile).mockResolvedValue(mockFileContent);

      const result = await fileInfoCache.calculateFileStatsAndHash(
        mockFilePath
      );

      expect(fs.stat).toHaveBeenCalledWith(mockFilePath);
      expect(fs.readFile).toHaveBeenCalledWith(mockFilePath);
      expect(crypto.createHash).toHaveBeenCalledWith("sha1");
      expect(result).toEqual({
        mtime: mockStats.mtimeMs,
        size: mockStats.size,
        hash: mockHash,
      });
    });

    it("should return null if fs.stat fails (e.g., ENOENT)", async () => {
      const error = new Error("File not found") as any;
      error.code = "ENOENT";
      vi.mocked(fs.stat).mockRejectedValue(error);

      const result = await fileInfoCache.calculateFileStatsAndHash(
        mockFilePath
      );

      expect(result).toBeNull();
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    it("should return null if path is not a file", async () => {
      const dirStats = { ...mockStats, isFile: () => false };
      vi.mocked(fs.stat).mockResolvedValue(dirStats as any);

      const result = await fileInfoCache.calculateFileStatsAndHash(
        mockFilePath
      );

      expect(result).toBeNull();
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    it("should throw error if fs.readFile fails", async () => {
      vi.mocked(fs.stat).mockResolvedValue(mockStats as any);
      const error = new Error("Read error");
      vi.mocked(fs.readFile).mockRejectedValue(error);

      await expect(
        fileInfoCache.calculateFileStatsAndHash(mockFilePath)
      ).rejects.toThrow("Read error");
    });
  });

  describe("readCache", () => {
    const cachePath = "/fake/cache/file.info";
    const mockMetadata = {
      sourceFilePath: "/src/file.ts",
      mtime: 1,
      size: 10,
      hash: "abc",
    };
    const mockData = { key: "value" };
    const mockCacheEntry: CacheEntry = {
      metadata: mockMetadata,
      data: mockData,
    };

    it("should return parsed cache entry for valid file", async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockCacheEntry));
      const result = await fileInfoCache.readCache(cachePath);
      expect(fs.readFile).toHaveBeenCalledWith(cachePath, "utf-8");
      expect(result).toEqual(mockCacheEntry);
    });

    it("should return null if readFile fails with ENOENT", async () => {
      const error = new Error("Not found") as any;
      error.code = "ENOENT";
      vi.mocked(fs.readFile).mockRejectedValue(error);
      const result = await fileInfoCache.readCache(cachePath);
      expect(result).toBeNull();
    });

    it("should return null if JSON parsing fails", async () => {
      vi.mocked(fs.readFile).mockResolvedValue("{invalid json");
      const result = await fileInfoCache.readCache(cachePath);
      expect(result).toBeNull();
    });

    it("should return null if cache entry structure is invalid", async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ metadata: null, data: {} })
      );
      const result = await fileInfoCache.readCache(cachePath);
      expect(result).toBeNull();
    });

    it("should return null and log error for other readFile errors", async () => {
      const error = new Error("Read permission denied");
      vi.mocked(fs.readFile).mockRejectedValue(error);
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const result = await fileInfoCache.readCache(cachePath);
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("writeCache", () => {
    const cachePath = "/fake/cache/dir/file.info";
    const cacheDir = "/fake/cache/dir";
    const mockMetadata = {
      sourceFilePath: "/src/file.ts",
      mtime: 1,
      size: 10,
      hash: "abc",
    };
    const mockData = { key: "value" };
    const mockCacheEntry: CacheEntry = {
      metadata: mockMetadata,
      data: mockData,
    };

    it("should create directory and write file", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await fileInfoCache.writeCache(cachePath, mockCacheEntry);

      expect(fs.mkdir).toHaveBeenCalledWith(cacheDir, { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        cachePath,
        JSON.stringify(mockCacheEntry, null, 2),
        "utf-8"
      );
    });

    it("should log error if mkdir fails", async () => {
      const error = new Error("Mkdir failed");
      vi.mocked(fs.mkdir).mockRejectedValue(error);
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await fileInfoCache.writeCache(cachePath, mockCacheEntry);

      expect(consoleSpy).toHaveBeenCalledWith(
        `Error writing cache file ${cachePath}:`,
        error
      );
      expect(fs.writeFile).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should log error if writeFile fails", async () => {
      const error = new Error("Write failed");
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockRejectedValue(error);
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await fileInfoCache.writeCache(cachePath, mockCacheEntry);

      expect(consoleSpy).toHaveBeenCalledWith(
        `Error writing cache file ${cachePath}:`,
        error
      );
      consoleSpy.mockRestore();
    });
  });

  describe("deleteWorktreeCache", () => {
    const worktreeDir = "/fake/project/.cassi/worktrees/test-wt";
    const worktreeCachePath = MOCK_WT_CACHE;

    it("should remove the worktree cache directory", async () => {
      vi.mocked(fs.rm).mockResolvedValue(undefined);
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await fileInfoCache.deleteWorktreeCache(worktreeDir);

      expect(fs.rm).toHaveBeenCalledWith(worktreeCachePath, {
        recursive: true,
        force: true,
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        "Deleted cache for worktree: test-wt"
      );
      consoleSpy.mockRestore();
    });

    it("should not throw if directory does not exist (ENOENT)", async () => {
      const error = new Error("Not found") as any;
      error.code = "ENOENT";
      vi.mocked(fs.rm).mockRejectedValue(error);
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await expect(
        fileInfoCache.deleteWorktreeCache(worktreeDir)
      ).resolves.toBeUndefined();
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should log error for other rm errors", async () => {
      const error = new Error("Permission denied");
      vi.mocked(fs.rm).mockRejectedValue(error);
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await fileInfoCache.deleteWorktreeCache(worktreeDir);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error deleting cache for worktree test-wt"),
        error
      );
      consoleSpy.mockRestore();
    });
  });
});
