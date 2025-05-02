import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { CacheEntry, CacheMetadata } from "./types.js";

const CACHE_DIR_NAME = ".cassi/cache";
const REPOSITORY_CACHE_DIR = "repository";
const WORKTREES_CACHE_DIR = "worktrees";
const PATH_SEPARATOR_REPLACEMENT = "__";

export class FileInfoCache {
  private readonly baseCachePath: string;
  private readonly repositoryCachePath: string;

  constructor(projectRootDir: string) {
    this.baseCachePath = path.join(projectRootDir, CACHE_DIR_NAME);
    this.repositoryCachePath = path.join(
      this.baseCachePath,
      REPOSITORY_CACHE_DIR
    );
  }

  private encodePath(relativePath: string): string {
    return relativePath.replace(
      new RegExp(`\\${path.sep}`, "g"),
      PATH_SEPARATOR_REPLACEMENT
    );
  }

  private getContextCachePath(worktreeDir?: string): string {
    if (worktreeDir) {
      const worktreeName = path.basename(worktreeDir);
      return path.join(this.baseCachePath, WORKTREES_CACHE_DIR, worktreeName);
    } else {
      return this.repositoryCachePath;
    }
  }

  public getCachePath(
    infoType: string,
    relativePath: string,
    worktreeDir?: string
  ): string {
    const contextCachePath = this.getContextCachePath(worktreeDir);
    const encodedFileName = `${this.encodePath(
      relativePath
    )}_${infoType}_.info`;
    return path.join(contextCachePath, encodedFileName);
  }

  public async calculateFileStatsAndHash(
    filePath: string
  ): Promise<{ mtime: number; size: number; hash: string } | null> {
    try {
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        return null;
      }
      const content = await fs.readFile(filePath);
      const hash = crypto.createHash("sha1").update(content).digest("hex");
      return {
        mtime: stats.mtimeMs,
        size: stats.size,
        hash: hash,
      };
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return null;
      }
      console.error(`Error calculating stats/hash for ${filePath}:`, error);
      throw error;
    }
  }

  public async readCache(cachePath: string): Promise<CacheEntry | null> {
    try {
      const content = await fs.readFile(cachePath, "utf-8");
      const entry: CacheEntry = JSON.parse(content);
      if (entry && entry.metadata && typeof entry.metadata.hash === "string") {
        return entry;
      }
      return null;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return null;
      }
      console.error(`Error reading cache file ${cachePath}:`, error);
      return null;
    }
  }

  public async writeCache(cachePath: string, entry: CacheEntry): Promise<void> {
    try {
      const dir = path.dirname(cachePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(cachePath, JSON.stringify(entry, null, 2), "utf-8");
    } catch (error) {
      console.error(`Error writing cache file ${cachePath}:`, error);
    }
  }

  public async deleteWorktreeCache(worktreeDir: string): Promise<void> {
    const worktreeName = path.basename(worktreeDir);
    const worktreeCachePath = path.join(
      this.baseCachePath,
      WORKTREES_CACHE_DIR,
      worktreeName
    );
    try {
      await fs.rm(worktreeCachePath, { recursive: true, force: true });
      console.log(`Deleted cache for worktree: ${worktreeName}`);
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return;
      }
      console.error(
        `Error deleting cache for worktree ${worktreeName} at ${worktreeCachePath}:`,
        error
      );
    }
  }
}
