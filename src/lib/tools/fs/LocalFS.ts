import * as fs from "fs/promises";
import * as path from "path";
import { glob, GlobOptions } from "glob";

/**
 * Provides methods for interacting with the local file system using Node.js standard libraries.
 */
export default class LocalFS {
  /**
   * Lists the contents of a directory.
   * @param dirPath - The path to the directory.
   * @param options - Optional settings for reading the directory.
   * @returns A promise that resolves with an array of directory entry names.
   */
  async listDirectory(
    dirPath: string,
    options?:
      | {
          encoding?: BufferEncoding | null | undefined;
          withFileTypes?: false | undefined; // Explicitly false for string[] return
          recursive?: boolean | undefined;
        }
      | BufferEncoding
      | null
      | undefined
  ): Promise<string[]> {
    try {
      // Assuming options will not have withFileTypes: true for now
      const entries = await fs.readdir(dirPath, options);
      // If options could include withFileTypes: true, the return type and handling would need adjustment.
      return entries as string[]; // Ensure return type matches signature
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Creates a directory, including any necessary parent directories.
   * @param dirPath - The path of the directory to create.
   * @returns A promise that resolves when the directory is created.
   */
  async createDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Deletes a directory recursively.
   * @param dirPath - The path of the directory to delete.
   * @returns A promise that resolves when the directory is deleted.
   */
  async deleteDirectory(dirPath: string): Promise<void> {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Creates a file and writes content to it. Creates parent directories if they don't exist.
   * @param filePath - The path of the file to create.
   * @param content - The content to write to the file.
   * @returns A promise that resolves when the file is created and written.
   */
  async createFile(filePath: string, content: string | Buffer): Promise<void> {
    try {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, content);
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Deletes a file.
   * @param filePath - The path of the file to delete.
   * @returns A promise that resolves when the file is deleted.
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      } else {
      }
    }
  }

  /**
   * Reads the content of a file.
   * @param filePath - The path of the file to read.
   * @param encoding - The encoding to use (default: 'utf8').
   * @returns A promise that resolves with the file content as a string or Buffer.
   */
  async readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
  async readFile(filePath: string, encoding?: null): Promise<Buffer>;
  async readFile(
    filePath: string,
    encoding: BufferEncoding | null = "utf8"
  ): Promise<string | Buffer> {
    try {
      const content = await fs.readFile(filePath, { encoding });
      return content;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Writes content to a file. Overwrites the file if it exists, creates it if it doesn't.
   * This is functionally similar to createFile but named for clarity when overwriting.
   * @param filePath - The path of the file to write to.
   * @param content - The content to write.
   * @returns A promise that resolves when the file is written.
   */
  async writeFile(filePath: string, content: string | Buffer): Promise<void> {
    try {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, content);
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Gets the current working directory of the Node.js process.
   * @returns The current working directory path.
   */
  getCurrentWorkingDirectory(): string {
    return process.cwd();
  }

  /**
   * Sets the current working directory of the Node.js process.
   * @param dirPath - The path to the new working directory.
   * @throws An error if changing the directory fails.
   */
  setCurrentWorkingDirectory(dirPath: string): void {
    try {
      process.chdir(dirPath);
    } catch (error: any) {
      throw new Error(
        `Failed to change directory to ${dirPath}: ${error.message}`
      );
    }
  }

  /**
   * Finds files matching a glob pattern.
   * @param pattern - The glob pattern to match.
   * @param options - Optional settings for glob.
   * @returns A promise that resolves with an array of matching file paths.
   */
  async glob(
    pattern: string | string[],
    options?: GlobOptions
  ): Promise<string[]> {
    try {
      const mergedOptions = { ...(options ?? {}), withFileTypes: false };
      const files = await glob(pattern, mergedOptions);
      return files as string[];
    } catch (error: any) {
      throw error;
    }
  }
}
