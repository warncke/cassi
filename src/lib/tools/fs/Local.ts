import * as fs from "fs/promises";
import * as path from "path";

/**
 * Provides methods for interacting with the local file system using Node.js standard libraries.
 */
export default class LocalFS {
  /**
   * Lists the contents of a directory.
   * @param dirPath - The path to the directory.
   * @returns A promise that resolves with an array of directory entry names.
   */
  async listDirectory(dirPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dirPath);
      return entries;
    } catch (error: any) {
      // Handle specific errors like 'ENOENT' (directory not found) if needed
      throw error; // Re-throw the error for the caller to handle
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
      // Handle specific errors like 'EEXIST' (directory already exists) if needed
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
      // Use rm for modern Node.js versions, which handles recursive deletion well
      await fs.rm(dirPath, { recursive: true, force: true }); // force: true suppresses errors if path doesn't exist
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
      // Ensure the directory exists before writing the file
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
      // Handle specific errors like 'ENOENT' (file not found) gracefully
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      } else {
        // Optionally log that the file didn't exist if needed
        // console.log(`File not found, skipping deletion: ${filePath}`);
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
    // This can reuse the createFile logic as writeFile handles creation/overwriting
    // Ensure the directory exists first
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
      // Handle specific errors like 'ENOENT' (directory not found)
      throw new Error(
        `Failed to change directory to ${dirPath}: ${error.message}`
      );
    }
  }
}
