import * as path from "node:path";
import * as fs from "node:fs/promises";
import { FileInfoCache } from "./FileInfoCache.js";
import type { FileInfoProvider } from "./providers/FileInfoProvider.js";
import { AstProvider } from "./providers/AstProvider.js";
import { InterfaceProvider } from "./providers/InterfaceProvider.js";
import type { CacheEntry } from "./types.js";

let globalFileInfoCache: FileInfoCache | null = null;
const providerRegistry = new Map<string, FileInfoProvider>();
let providersRegistered = false;

export class FileInfo {
  public readonly repositoryDir: string;
  public readonly worktreeDir?: string;
  private readonly repositoryFileInfo?: FileInfo;
  private readonly currentGetInfoCalls = new Set<string>();

  private readonly fileInfoCache: FileInfoCache;

  constructor(
    repositoryDir: string,
    worktreeDir?: string,
    repositoryFileInfo?: FileInfo
  ) {
    this.repositoryDir = path.resolve(repositoryDir);
    this.worktreeDir = worktreeDir ? path.resolve(worktreeDir) : undefined;
    this.repositoryFileInfo = repositoryFileInfo;

    if (!globalFileInfoCache) {
      globalFileInfoCache = new FileInfoCache(this.repositoryDir);
      FileInfo.registerProvidersInternal();
    }
    this.fileInfoCache = globalFileInfoCache;

    if (this.worktreeDir && !this.repositoryFileInfo) {
      throw new Error(
        "Worktree FileInfo instances must be provided with a repository FileInfo instance."
      );
    }
    if (!this.worktreeDir && this.repositoryFileInfo) {
      throw new Error(
        "Repository FileInfo instances should not have a repositoryFileInfo link."
      );
    }
  }

  private getAbsoluteSourcePath(relativePath: string): string {
    const baseDir = this.worktreeDir || this.repositoryDir;
    return path.resolve(baseDir, relativePath);
  }

  private static registerProvidersInternal(): void {
    if (providersRegistered) return;
    FileInfo.registerProvider("ast", new AstProvider());
    FileInfo.registerProvider("interface", new InterfaceProvider());
    console.log("Registered FileInfo providers: ast, interface");
    providersRegistered = true;
  }

  public static registerProvider(
    infoType: string,
    provider: FileInfoProvider
  ): void {
    if (providerRegistry.has(infoType)) {
      console.warn(`Overwriting provider for infoType: ${infoType}`);
    }
    providerRegistry.set(infoType, provider);
    providersRegistered = true;
  }

  public async getFileContent(relativePath: string): Promise<string | null> {
    const absolutePath = this.getAbsoluteSourcePath(relativePath);
    try {
      return await fs.readFile(absolutePath, "utf-8");
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return null;
      }
      console.error(`Error reading file content for ${absolutePath}:`, error);
      throw error;
    }
  }

  public async getInfo<T>(
    infoType: string,
    relativePath: string
  ): Promise<T | null> {
    const callSignature = `${infoType}:${relativePath}`;
    if (this.currentGetInfoCalls.has(callSignature)) {
      console.error(
        `Circular dependency detected: ${[
          ...this.currentGetInfoCalls,
          callSignature,
        ].join(" -> ")}`
      );
      throw new Error(
        `Circular dependency detected while getting infoType ${infoType} for ${relativePath}`
      );
    }
    this.currentGetInfoCalls.add(callSignature);

    try {
      const provider = providerRegistry.get(infoType);
      if (!provider) {
        console.error(`No provider registered for infoType: ${infoType}`);
        return null;
      }

      const absolutePath = this.getAbsoluteSourcePath(relativePath);
      const cachePath = this.fileInfoCache.getCachePath(
        infoType,
        relativePath,
        this.worktreeDir
      );

      const cachedEntry = await this.fileInfoCache.readCache(cachePath);
      const currentStats = await this.fileInfoCache.calculateFileStatsAndHash(
        absolutePath
      );

      if (cachedEntry && currentStats) {
        if (
          cachedEntry.metadata.mtime === currentStats.mtime &&
          cachedEntry.metadata.size === currentStats.size
        ) {
          return cachedEntry.data as T;
        }
        if (cachedEntry.metadata.hash === currentStats.hash) {
          return cachedEntry.data as T;
        }
      } else {
      }

      if (this.worktreeDir && this.repositoryFileInfo && currentStats) {
        const repoStats = await this.repositoryFileInfo.getFileStats(
          relativePath
        );
        if (repoStats && repoStats.hash === currentStats.hash) {
          const repoData = await this.repositoryFileInfo.getInfo<T>(
            infoType,
            relativePath
          );
          if (repoData !== null) {
            const newEntry: CacheEntry = {
              metadata: {
                sourceFilePath: absolutePath,
                mtime: currentStats.mtime,
                size: currentStats.size,
                hash: currentStats.hash,
              },
              data: repoData,
            };
            await this.fileInfoCache.writeCache(cachePath, newEntry);
            return repoData;
          }
        } else {
        }
      }

      if (!currentStats) {
        return null;
      }

      const extractedData = await provider.extractInfo(relativePath, this);

      if (extractedData !== null && extractedData !== undefined) {
        const newEntry: CacheEntry = {
          metadata: {
            sourceFilePath: absolutePath,
            mtime: currentStats.mtime,
            size: currentStats.size,
            hash: currentStats.hash,
          },
          data: extractedData,
        };
        await this.fileInfoCache.writeCache(cachePath, newEntry);
        return extractedData as T;
      } else {
        return null;
      }
    } catch (error: any) {
      if (error.message.includes("Circular dependency detected")) {
        throw error;
      }
      console.error(`Error in getInfo for ${infoType}:${relativePath}:`, error);
      return null;
    } finally {
      this.currentGetInfoCalls.delete(callSignature);
    }
  }

  public async getFileStats(
    relativePath: string
  ): Promise<{ mtime: number; size: number; hash: string } | null> {
    if (this.worktreeDir) {
      throw new Error(
        "getFileStats should only be called on repository FileInfo instances."
      );
    }
    const absolutePath = this.getAbsoluteSourcePath(relativePath);
    return this.fileInfoCache.calculateFileStatsAndHash(absolutePath);
  }

  public async deleteCache(): Promise<void> {
    if (!this.worktreeDir) {
      console.warn(
        "Attempted to delete cache on a non-worktree FileInfo instance."
      );
      return;
    }
    await this.fileInfoCache.deleteWorktreeCache(this.worktreeDir);
  }
}
