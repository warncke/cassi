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
import LocalFS from "./LocalFS.js";

describe("LocalFS", () => {
  const localFs = new LocalFS();
  const testDir = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "test_temp_dir"
  );

  beforeAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  afterEach(async () => {
  });

  describe("Directory Operations", () => {
    const subDir = path.join(testDir, "subDir");

    test("should create a directory", async () => {
      await localFs.createDirectory(subDir);
      const stats = await fs.stat(subDir);
      expect(stats.isDirectory()).toBe(true);
    });

    test("should list directory contents", async () => {
      const dummyFilePath = path.join(subDir, "dummy.txt");
      await fs.writeFile(dummyFilePath, "dummy content");

      const contents = await localFs.listDirectory(subDir);
      expect(contents).toContain("dummy.txt");

      await fs.unlink(dummyFilePath);
    });

    test("should delete a directory", async () => {
      await localFs.createDirectory(subDir);
      await localFs.deleteDirectory(subDir);

      await expect(fs.stat(subDir)).rejects.toThrow();
    });

    test("createDirectory should handle nested paths", async () => {
      const nestedDir = path.join(testDir, "nested", "deeply");
      await localFs.createDirectory(nestedDir);
      const stats = await fs.stat(nestedDir);
      expect(stats.isDirectory()).toBe(true);
      await localFs.deleteDirectory(path.join(testDir, "nested"));
    });
  });

  describe("File Operations", () => {
    const testFile = path.join(testDir, "testFile.txt");
    const testContent = "Hello, World!";
    const testBufferContent = Buffer.from("Buffer Content");

    beforeEach(async () => {
      await localFs.createDirectory(testDir);
    });

    afterEach(async () => {
      await localFs.deleteFile(testFile).catch(() => {});
    });

    test("should create a file with string content", async () => {
      await localFs.createFile(testFile, testContent);
      const content = await fs.readFile(testFile, "utf8");
      expect(content).toBe(testContent);
    });

    test("should create a file with buffer content", async () => {
      await localFs.createFile(testFile, testBufferContent);
      const content = await fs.readFile(testFile);
      expect(content).toEqual(testBufferContent);
    });

    test("should read a file as string", async () => {
      await fs.writeFile(testFile, testContent, "utf8");
      const content = await localFs.readFile(testFile);
      expect(content).toBe(testContent);
    });

    test("should read a file as buffer", async () => {
      await fs.writeFile(testFile, testBufferContent);
      const content = await localFs.readFile(testFile, null);
      expect(content).toEqual(testBufferContent);
    });

    test("should write (overwrite) a file with string content", async () => {
      await fs.writeFile(testFile, "initial content", "utf8");
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
      await fs.writeFile(testFile, testContent, "utf8");
      await localFs.deleteFile(testFile);

      await expect(fs.stat(testFile)).rejects.toThrow();
    });

    test("deleteFile should not throw if file does not exist", async () => {
      const nonExistentFile = path.join(testDir, "non_existent.txt");
      await localFs.deleteFile(nonExistentFile).catch(() => {});
      await expect(localFs.deleteFile(nonExistentFile)).resolves.not.toThrow();
    });

    test("createFile should create parent directories", async () => {
      const nestedFile = path.join(testDir, "new_dir", "nested_file.txt");
      await localFs.createFile(nestedFile, "nested content");
      const content = await fs.readFile(nestedFile, "utf8");
      expect(content).toBe("nested content");
      await localFs.deleteDirectory(path.join(testDir, "new_dir"));
    });
  });

  test("should return the current working directory", () => {
    const cwd = localFs.getCurrentWorkingDirectory();
    expect(cwd).toBe(process.cwd());
  });

  describe("Working Directory Operations", () => {
    const originalCwd = process.cwd();
    const tempDirForCwd = path.join(testDir, "cwd_test_dir");

    beforeAll(async () => {
      await localFs.createDirectory(tempDirForCwd);
    });

    afterAll(async () => {
      await localFs.deleteDirectory(tempDirForCwd);
    });

    afterEach(() => {
      process.chdir(originalCwd);
    });

    test("should set the current working directory", () => {
      localFs.setCurrentWorkingDirectory(tempDirForCwd);
      expect(process.cwd()).toBe(tempDirForCwd);
    });

    test("should throw an error when setting CWD to a non-existent directory", () => {
      const nonExistentDir = path.join(testDir, "non_existent_cwd_dir");
      expect(() => localFs.setCurrentWorkingDirectory(nonExistentDir)).toThrow(
        /Failed to change directory/
      );
      expect(process.cwd()).toBe(originalCwd);
    });

    test("should throw an error when setting CWD to a file path", async () => {
      const filePath = path.join(tempDirForCwd, "temp_file.txt");
      await localFs.createFile(filePath, "content");

      expect(() => localFs.setCurrentWorkingDirectory(filePath)).toThrow(
        /Failed to change directory/
      );
      expect(process.cwd()).toBe(originalCwd);

      await localFs.deleteFile(filePath);
    });
  });
});
