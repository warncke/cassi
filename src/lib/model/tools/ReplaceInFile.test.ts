import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import path from "path";
import { ReplaceInFile } from "./ReplaceInFile.js";
import { Models, GenerateModelOptions } from "../Models.js";
import { Task } from "../../task/Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import { Repository } from "../../repository/Repository.js";

class MockRepository {
  repositoryDir = "/mock/repo";
}

class MockCassi {
  repository = new MockRepository() as Repository;
}
class MockTask extends Task {
  invoke = vi.fn();
  getCwd = vi.fn(() => "/mock/cwd");

  constructor(cassi: Cassi) {
    super(cassi, null);
    this.cassi = cassi;
  }
}

class MockCoderModel extends Models {
  constructor(task: Task) {
    const mockPlugin = () => ({ name: "mockPlugin", tools: [] });
    super(mockPlugin, task);
  }
  async generate(options: GenerateModelOptions): Promise<string> {
    return `mock coder response for ${options.prompt}`;
  }
}

const mockCassi = new MockCassi() as Cassi;
const mockTask = new MockTask(mockCassi);
const mockModelInstance = new MockCoderModel(mockTask);

describe("ReplaceInFile", () => {
  const testFilePath = "some/dir/file.txt";
  const fullTestPath = path.join(mockTask.getCwd(), testFilePath);
  const testDir = path.dirname(fullTestPath);
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockTask.getCwd).mockReturnValue("/mock/cwd");
    vi.mocked(mockTask.invoke).mockReset();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have correct toolDefinition", () => {
    expect(ReplaceInFile.toolDefinition).toBeDefined();
    expect(ReplaceInFile.toolDefinition.name).toBe("REPLACE_IN_FILE");
    expect(ReplaceInFile.toolDefinition.description).toBeDefined();
    expect(ReplaceInFile.toolDefinition.inputSchema).toBeDefined();
    const inputSchema = ReplaceInFile.toolDefinition
      .inputSchema as z.ZodObject<any>;
    expect(inputSchema.shape).toHaveProperty("path");
    expect(inputSchema.shape).toHaveProperty("diff");
  });

  it("modelToolArgs should return correct structure", () => {
    const toolArgs = ReplaceInFile.modelToolArgs(mockModelInstance);
    expect(toolArgs).toBeInstanceOf(Array);
    expect(toolArgs.length).toBe(2);
    expect(toolArgs[0]).toEqual(ReplaceInFile.toolDefinition);
    const toolMethod = toolArgs[1];
    expect(typeof toolMethod).toBe("function");
  });

  it("toolMethod should successfully replace content with a single block", async () => {
    const initialContent = "Hello world!\nThis is a test.";
    const finalContent = "Hello universe!\nThis is a test.";
    const diff = `<<<<<<< SEARCH
Hello world!
=======
Hello universe!
>>>>>>> REPLACE`;
    mockTask.invoke.mockImplementation(async (tool, method, _types, args) => {
      if (tool === "fs" && method === "readFile" && args[0] === fullTestPath) {
        return initialContent;
      }
      if (tool === "fs" && method === "mkdir") {
        return undefined;
      }
      if (tool === "fs" && method === "writeFile") {
        return undefined;
      }
      throw new Error(`Unexpected invoke call: ${tool}.${method}`);
    });

    const toolArgs = ReplaceInFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const input = { path: testFilePath, diff };
    const result = await toolMethod(input);

    expect(mockTask.invoke).toHaveBeenCalledWith(
      "fs",
      "readFile",
      [],
      [fullTestPath]
    );
    expect(mockTask.invoke).toHaveBeenCalledWith(
      "fs",
      "writeFile",
      [],
      [fullTestPath, finalContent]
    );
    expect(result).toBe(finalContent);
  });

  it("toolMethod should successfully replace content with multiple blocks", async () => {
    const initialContent = "Line 1\nLine 2\nLine 3\nLine 4";
    const finalContent = "First Line\nLine 2\nThird Line\nLine 4";
    const diff = `<<<<<<< SEARCH
Line 1
=======
First Line
>>>>>>> REPLACE
<<<<<<< SEARCH
Line 3
=======
Third Line
>>>>>>> REPLACE`;
    mockTask.invoke.mockImplementation(async (tool, method, _types, args) => {
      if (tool === "fs" && method === "readFile" && args[0] === fullTestPath) {
        return initialContent;
      }
      if (tool === "fs" && method === "mkdir") {
        return undefined;
      }
      if (tool === "fs" && method === "writeFile") {
        return undefined;
      }
      throw new Error(`Unexpected invoke call: ${tool}.${method}`);
    });

    const toolArgs = ReplaceInFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const input = { path: testFilePath, diff };
    const result = await toolMethod(input);

    expect(mockTask.invoke).toHaveBeenCalledWith(
      "fs",
      "readFile",
      [],
      [fullTestPath]
    );
    expect(mockTask.invoke).toHaveBeenCalledWith(
      "fs",
      "writeFile",
      [],
      [fullTestPath, finalContent]
    );
    expect(result).toBe(finalContent);
  });

  it("toolMethod should handle deletion using an empty REPLACE block", async () => {
    const initialContent = "Line 1\nLine 2 to delete\nLine 3";
    const finalContent = "Line 1\n\nLine 3";
    const diff = `<<<<<<< SEARCH
Line 2 to delete
=======
>>>>>>> REPLACE`;
    mockTask.invoke.mockImplementation(async (tool, method, _types, args) => {
      if (tool === "fs" && method === "readFile" && args[0] === fullTestPath) {
        return initialContent;
      }
      if (tool === "fs" && method === "mkdir") {
        return undefined;
      }
      if (tool === "fs" && method === "writeFile" && args[0] === fullTestPath) {
        return undefined;
      }
      throw new Error(
        `Unexpected invoke call: ${tool}.${method} with args ${JSON.stringify(
          args
        )}`
      );
    });

    const toolArgs = ReplaceInFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const input = { path: testFilePath, diff };
    const result = await toolMethod(input);

    expect(mockTask.invoke).toHaveBeenNthCalledWith(
      1,
      "fs",
      "readFile",
      [],
      [fullTestPath]
    );
    expect(mockTask.invoke).toHaveBeenNthCalledWith(
      2,
      "fs",
      "writeFile",
      [],
      [fullTestPath, finalContent]
    );

    expect(result).toBe(finalContent);
  });

  it("toolMethod should return error if file not found", async () => {
    const diff = `<<<<<<< SEARCH\nfind me\n=======\nreplace me\n>>>>>>> REPLACE`;
    mockTask.invoke.mockImplementation(async (tool, method, _types, args) => {
      if (tool === "fs" && method === "readFile" && args[0] === fullTestPath) {
        return null;
      }
      throw new Error(`Unexpected invoke call: ${tool}.${method}`);
    });

    const toolArgs = ReplaceInFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const result = await toolMethod({ path: testFilePath, diff });

    expect(mockTask.invoke).toHaveBeenCalledWith(
      "fs",
      "readFile",
      [],
      [fullTestPath]
    );
    expect(mockTask.invoke).not.toHaveBeenCalledWith(
      "fs",
      "writeFile",
      [],
      expect.anything()
    );
    expect(result).toBe(
      `ERROR: REPLACE_IN_FILE failed. use WRITE_FILE with the full file contents instead`
    );
  });

  it("toolMethod should return error on other read errors", async () => {
    const diff = `<<<<<<< SEARCH\nfind me\n=======\nreplace me\n>>>>>>> REPLACE`;
    const error = new Error("Permission denied");
    mockTask.invoke.mockImplementation(async (tool, method, _types, args) => {
      if (tool === "fs" && method === "readFile" && args[0] === fullTestPath) {
        throw error;
      }
      throw new Error(`Unexpected invoke call: ${tool}.${method}`);
    });

    const toolArgs = ReplaceInFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const result = await toolMethod({ path: testFilePath, diff });

    expect(mockTask.invoke).toHaveBeenCalledWith(
      "fs",
      "readFile",
      [],
      [fullTestPath]
    );
    expect(mockTask.invoke).not.toHaveBeenCalledWith(
      "fs",
      "writeFile",
      [],
      expect.anything()
    );
    expect(result).toBe(
      `ERROR: REPLACE_IN_FILE failed. use WRITE_FILE with the full file contents instead`
    );
  });

  it("toolMethod should return error on write error", async () => {
    const initialContent = "Content to replace";
    const diff = `<<<<<<< SEARCH\nContent to replace\n=======\nNew Content\n>>>>>>> REPLACE`;
    const error = new Error("Disk full");
    mockTask.invoke.mockImplementation(async (tool, method, _types, args) => {
      if (tool === "fs" && method === "readFile" && args[0] === fullTestPath) {
        return initialContent;
      }
      if (tool === "fs" && method === "mkdir") {
        return undefined;
      }
      if (tool === "fs" && method === "writeFile") {
        throw error;
      }
      throw new Error(`Unexpected invoke call: ${tool}.${method}`);
    });

    const toolArgs = ReplaceInFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const input = { path: testFilePath, diff };
    const result = await toolMethod(input);

    expect(mockTask.invoke).toHaveBeenCalledWith(
      "fs",
      "readFile",
      [],
      [fullTestPath]
    );
    expect(mockTask.invoke).toHaveBeenCalledWith(
      "fs",
      "writeFile",
      [],
      [fullTestPath, "New Content"]
    );
    expect(result).toBe(
      `ERROR: REPLACE_IN_FILE failed. use WRITE_FILE with the full file contents instead`
    );
  });

  it("toolMethod should return error if SEARCH content not found", async () => {
    const initialContent = "Some other content";
    const diff = `<<<<<<< SEARCH
Content not present
=======
Replacement
>>>>>>> REPLACE`;
    mockTask.invoke.mockResolvedValue(initialContent);

    const toolArgs = ReplaceInFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const input = { path: testFilePath, diff };
    const result = await toolMethod(input);

    expect(mockTask.invoke).toHaveBeenCalledWith(
      "fs",
      "readFile",
      [],
      [fullTestPath]
    );
    expect(mockTask.invoke).not.toHaveBeenCalledWith(
      "fs",
      "writeFile",
      [],
      expect.anything()
    );
    expect(result).toBe(
      `ERROR: REPLACE_IN_FILE failed. use WRITE_FILE with the full file contents instead`
    );
  });

  it("toolMethod should return error if SEARCH content not found in second block", async () => {
    const initialContent = "Line 1\nLine 2\nLine 3";
    const diff = `<<<<<<< SEARCH
Line 1
=======
First Line
>>>>>>> REPLACE
<<<<<<< SEARCH
Line 4 not present
=======
Fourth Line
>>>>>>> REPLACE`;
    mockTask.invoke.mockResolvedValue(initialContent);

    const toolArgs = ReplaceInFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const result = await toolMethod({ path: testFilePath, diff });

    expect(mockTask.invoke).toHaveBeenCalledWith(
      "fs",
      "readFile",
      [],
      [fullTestPath]
    );
    expect(mockTask.invoke).not.toHaveBeenCalledWith(
      "fs",
      "writeFile",
      [],
      expect.anything()
    );
    expect(result).toBe(
      `ERROR: REPLACE_IN_FILE failed. use WRITE_FILE with the full file contents instead`
    );
  });

  it("toolMethod should return message if no effective changes were made", async () => {
    const initialContent = "Hello world!";
    const diff = `<<<<<<< SEARCH
Hello world!
=======
Hello world!
>>>>>>> REPLACE`; // Replace with identical content
    mockTask.invoke.mockResolvedValue(initialContent);

    const toolArgs = ReplaceInFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const result = await toolMethod({ path: testFilePath, diff });

    expect(mockTask.invoke).toHaveBeenCalledWith(
      "fs",
      "readFile",
      [],
      [fullTestPath]
    );
    expect(mockTask.invoke).not.toHaveBeenCalledWith(
      "fs",
      "writeFile",
      [],
      expect.anything()
    );
    expect(result).toBe(
      `Warning: No effective changes resulted from the replacements in ${testFilePath}. File content remains identical.`
    );
  });

  it("toolMethod should return error for invalid diff format (malformed block)", async () => {
    const initialContent = "Some content";
    const diff = `<<<&;<<< SEARCH\nfind me\n=======\nreplace me\n>>>>>>> REPLACE\n some extra text \n<<<<<<< SEARCH\nno end marker`;
    mockTask.invoke.mockResolvedValue(initialContent);

    const toolArgs = ReplaceInFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const result = await toolMethod({ path: testFilePath, diff });

    expect(mockTask.invoke).toHaveBeenCalledWith(
      "fs",
      "readFile",
      [],
      [fullTestPath]
    );
    expect(mockTask.invoke).not.toHaveBeenCalledWith(
      "fs",
      "writeFile",
      [],
      expect.anything()
    );
    expect(result).toBe(
      `ERROR: REPLACE_IN_FILE failed. use WRITE_FILE with the full file contents instead`
    );
  });

  it("toolMethod should ignore whitespace between valid blocks", async () => {
    const initialContent = "Line 1\nLine 2\nLine 3\nLine 4";
    const finalContent = "First Line\nLine 2\nThird Line\nLine 4";
    const diff = `
<<<<<<< SEARCH
Line 1
=======
First Line
>>>>>>> REPLACE

   \t
<<<<<<< SEARCH
Line 3
=======
Third Line
>>>>>>> REPLACE
`; // Whitespace between blocks
    mockTask.invoke.mockImplementation(async (tool, method, _types, args) => {
      if (tool === "fs" && method === "readFile" && args[0] === fullTestPath) {
        return initialContent;
      }
      if (tool === "fs" && method === "mkdir") {
        return undefined;
      }
      if (tool === "fs" && method === "writeFile") {
        return undefined;
      }
      throw new Error(`Unexpected invoke call: ${tool}.${method}`);
    });

    const toolArgs = ReplaceInFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const input = { path: testFilePath, diff };
    const result = await toolMethod(input);

    expect(mockTask.invoke).toHaveBeenCalledWith(
      "fs",
      "readFile",
      [],
      [fullTestPath]
    );
    expect(mockTask.invoke).toHaveBeenCalledWith(
      "fs",
      "writeFile",
      [],
      [fullTestPath, finalContent]
    );
    expect(result).toBe(finalContent);
  });
});
