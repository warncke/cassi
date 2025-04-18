import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import LocalFS from "./Local.js"; // Import the .ts file directly

describe("LocalFS", () => {
  const localFs = new LocalFS();
  // Vitest doesn't have __dirname by default in ESM, use import.meta.url
  const testDir = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "test_temp_dir"
  ); // Create a temporary directory for testing

  // Clean up before all tests and after all tests
  beforeAll(async () => {
    // Ensure the test directory doesn't exist before starting
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {}); // Add catch for initial cleanup
  });

  afterAll(async () => {
    // Clean up the temporary directory after all tests are done
    await fs.rm(testDir, { recursive: true, force: true });
  });

  // Clean up specific test files/dirs after each test if needed
  afterEach(async () => {
    // Example: remove a specific file if created in a test
    // await localFs.deleteFile(path.join(testDir, 'some_test_file.txt')).catch(() => {});
  });

  describe("Directory Operations", () => {
    const subDir = path.join(testDir, "subDir");

    test("should create a directory", async () => {
      await localFs.createDirectory(subDir);
      const stats = await fs.stat(subDir);
      expect(stats.isDirectory()).toBe(true);
    });

    test("should list directory contents", async () => {
      // Create a dummy file inside the subDir to list
      const dummyFilePath = path.join(subDir, "dummy.txt");
      await fs.writeFile(dummyFilePath, "dummy content");

      const contents = await localFs.listDirectory(subDir);
      expect(contents).toContain("dummy.txt");

      // Clean up the dummy file
      await fs.unlink(dummyFilePath);
    });

    test("should delete a directory", async () => {
      // Ensure directory exists first
      await localFs.createDirectory(subDir);
      await localFs.deleteDirectory(subDir);

      // Check if directory still exists (it shouldn't)
      await expect(fs.stat(subDir)).rejects.toThrow(); // Expect stat to fail
    });

    test("createDirectory should handle nested paths", async () => {
      const nestedDir = path.join(testDir, "nested", "deeply");
      await localFs.createDirectory(nestedDir);
      const stats = await fs.stat(nestedDir);
      expect(stats.isDirectory()).toBe(true);
      // Clean up nested structure
      await localFs.deleteDirectory(path.join(testDir, "nested"));
    });
  });

  describe("File Operations", () => {
    const testFile = path.join(testDir, "testFile.txt");
    const testContent = "Hello, World!";
    const testBufferContent = Buffer.from("Buffer Content");

    beforeEach(async () => {
      // Ensure the base test directory exists for file operations
      await localFs.createDirectory(testDir);
    });

    afterEach(async () => {
      // Clean up the test file after each file operation test
      await localFs.deleteFile(testFile).catch(() => {}); // Ignore errors if file doesn't exist
    });

    test("should create a file with string content", async () => {
      await localFs.createFile(testFile, testContent);
      const content = await fs.readFile(testFile, "utf8");
      expect(content).toBe(testContent);
    });

    test("should create a file with buffer content", async () => {
      await localFs.createFile(testFile, testBufferContent);
      const content = await fs.readFile(testFile); // Read as buffer
      expect(content).toEqual(testBufferContent);
    });

    test("should read a file as string", async () => {
      // Create file first
      await fs.writeFile(testFile, testContent, "utf8");
      const content = await localFs.readFile(testFile); // Default is utf8
      expect(content).toBe(testContent);
    });

    test("should read a file as buffer", async () => {
      await fs.writeFile(testFile, testBufferContent);
      const content = await localFs.readFile(testFile, null); // Specify null for buffer
      expect(content).toEqual(testBufferContent);
    });

    test("should write (overwrite) a file with string content", async () => {
      // Create initial file
      await fs.writeFile(testFile, "initial content", "utf8");
      // Use writeFile to overwrite
      await localFs.writeFile(testFile, testContent);
      const content = await fs.readFile(testFile, "utf8");
      expect(content).toBe(testContent);
    });

    test("should write (overwrite) a file with buffer content", async () => {
      await fs.writeFile(testFile, "initial content", "utf8");
      await localFs.writeFile(testFile, testBufferContent);
      const content = await fs.readFile(testFile);
      expect(content).toEqual(testBufferContent);
    });

    test("should delete a file", async () => {
      // Create file first
      await fs.writeFile(testFile, testContent, "utf8");
      await localFs.deleteFile(testFile);

      // Check if file still exists (it shouldn't)
      await expect(fs.stat(testFile)).rejects.toThrow(); // Expect stat to fail
    });

    test("deleteFile should not throw if file does not exist", async () => {
      const nonExistentFile = path.join(testDir, "non_existent.txt");
      // Ensure it doesn't exist
      await localFs.deleteFile(nonExistentFile).catch(() => {});
      // Attempt deletion and expect no error
      await expect(localFs.deleteFile(nonExistentFile)).resolves.not.toThrow();
    });

    test("createFile should create parent directories", async () => {
      const nestedFile = path.join(testDir, "new_dir", "nested_file.txt");
      await localFs.createFile(nestedFile, "nested content");
      const content = await fs.readFile(nestedFile, "utf8");
      expect(content).toBe("nested content");
      // Clean up
      await localFs.deleteDirectory(path.join(testDir, "new_dir"));
    });
  });
});
