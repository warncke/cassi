import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdir, writeFile, readFile, rm } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_DIR = path.join(__dirname, "remove-comments-test-temp");
const SUB_DIR = path.join(TEST_DIR, "subdir");
const NODE_MODULES_DIR = path.join(TEST_DIR, "node_modules");
const NODE_MODULES_SUB_DIR = path.join(NODE_MODULES_DIR, "some-package");

const FILE_WITH_COMMENTS = path.join(TEST_DIR, "fileWithComments.ts");
const FILE_WITHOUT_COMMENTS = path.join(TEST_DIR, "fileWithoutComments.ts");
const FILE_IN_SUBDIR = path.join(SUB_DIR, "fileInSubdir.ts");
const FILE_IN_NODE_MODULES = path.join(NODE_MODULES_SUB_DIR, "ignoredFile.ts");

const CONTENT_WITH_COMMENTS = `
// This is a top-level comment
import fs from 'fs';

function hello() {
  // This is a comment inside a function
  console.log('Hello'); // Trailing comment
}

// Another comment
export default hello;
`;

const CONTENT_WITHOUT_COMMENTS = `
import fs from 'fs';

function hello() {
  console.log('Hello');
}

export default hello;
`;

const CONTENT_NO_COMMENTS = `
import path from 'path';

const x = 5;
console.log(x);
`;

describe("remove-comments script", () => {
  let removeComments: () => Promise<void>;
  let originalCwd: () => string;

  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
    await mkdir(SUB_DIR, { recursive: true });
    await mkdir(NODE_MODULES_SUB_DIR, { recursive: true });

    await writeFile(FILE_WITH_COMMENTS, CONTENT_WITH_COMMENTS);
    await writeFile(FILE_WITHOUT_COMMENTS, CONTENT_NO_COMMENTS);
    await writeFile(FILE_IN_SUBDIR, CONTENT_WITH_COMMENTS);
    await writeFile(FILE_IN_NODE_MODULES, CONTENT_WITH_COMMENTS);

    originalCwd = process.cwd;
    vi.stubGlobal("process", { ...process, cwd: () => TEST_DIR });

    // Dynamically import the module to get the exported function
    const module = await import("./remove-comments.js");
    if (!module.removeComments) {
      throw new Error("removeComments function not found in module");
    }
    removeComments = module.removeComments;
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    process.cwd = originalCwd;
    try {
      await rm(TEST_DIR, { recursive: true, force: true });
    } catch (e) {
      console.error("Failed to remove test directory:", e);
    }
  });

  it("should remove single-line comments from .ts files", async () => {
    await removeComments();
    const content = await readFile(FILE_WITH_COMMENTS, "utf-8");
    expect(content.trim()).toEqual(CONTENT_WITHOUT_COMMENTS.trim());
  });

  it("should process files in subdirectories", async () => {
    await removeComments();
    const content = await readFile(FILE_IN_SUBDIR, "utf-8");
    expect(content.trim()).toEqual(CONTENT_WITHOUT_COMMENTS.trim());
  });

  it("should not modify files without comments", async () => {
    const originalContent = await readFile(FILE_WITHOUT_COMMENTS, "utf-8");
    await removeComments();
    const newContent = await readFile(FILE_WITHOUT_COMMENTS, "utf-8");
    expect(newContent).toEqual(originalContent);
  });

  it("should ignore files in node_modules", async () => {
    const originalContent = await readFile(FILE_IN_NODE_MODULES, "utf-8");
    await removeComments();
    const newContent = await readFile(FILE_IN_NODE_MODULES, "utf-8");
    expect(newContent).toEqual(originalContent);
  });
});
