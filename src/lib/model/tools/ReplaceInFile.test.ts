import { describe, it, expect, vi, beforeEach } from "vitest";
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

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockTask.getCwd).mockReturnValue("/mock/cwd");
    vi.mocked(mockTask.invoke).mockReset();
  });

  it("should have correct toolDefinition", () => {
    expect(ReplaceInFile.toolDefinition).toBeDefined();
    expect(ReplaceInFile.toolDefinition.name).toBe("ReplaceInFile");
    expect(ReplaceInFile.toolDefinition.description).toBeDefined();
    expect(ReplaceInFile.toolDefinition.inputSchema).toBeDefined();
    const inputSchema = ReplaceInFile.toolDefinition.inputSchema as z.ZodObject<
      any,
      any,
      any
    >;
    expect(inputSchema.shape).toHaveProperty("path");
    expect(inputSchema.shape).toHaveProperty("find");
    expect(inputSchema.shape).toHaveProperty("replace");
    expect(ReplaceInFile.toolDefinition.outputSchema).toBeDefined();
    const outputSchema = ReplaceInFile.toolDefinition.outputSchema as any;
    expect(outputSchema._def.typeName).toBe("ZodUnion");
    expect(outputSchema._def.options[0]._def.value).toBe("OK");
    expect(outputSchema._def.options[1]._def.value).toBe("ERROR");
  });

  it("modelToolArgs should return correct structure", () => {
    const toolArgs = ReplaceInFile.modelToolArgs(mockModelInstance);
    expect(toolArgs).toBeInstanceOf(Array);
    expect(toolArgs.length).toBe(2);
    expect(toolArgs[0]).toEqual(ReplaceInFile.toolDefinition);
    const toolMethod = toolArgs[1];
    expect(typeof toolMethod).toBe("function");
  });

  it("toolMethod should successfully replace content and return OK", async () => {
    const initialContent = "Hello world!\nThis is a test.";
    const findString = "world";
    const replaceString = "universe";
    const finalContent = "Hello universe!\nThis is a test.";

    mockTask.invoke.mockImplementation(async (tool, method, _types, args) => {
      if (tool === "fs" && method === "readFile" && args[0] === fullTestPath) {
        return initialContent;
      }
      if (tool === "fs" && method === "writeFile") {
        expect(args[0]).toBe(fullTestPath);
        expect(args[1]).toBe(finalContent);
        return undefined;
      }
      throw new Error(`Unexpected invoke call: ${tool}.${method}`);
    });

    const toolArgs = ReplaceInFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const input = {
      path: testFilePath,
      find: findString,
      replace: replaceString,
    };
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
    expect(result).toBe("OK");
  });

  it("toolMethod should return OK even if replacement results in identical content", async () => {
    const initialContent = "Hello world!";
    const findString = "world";
    const replaceString = "world";

    mockTask.invoke.mockImplementation(async (tool, method, _types, args) => {
      if (tool === "fs" && method === "readFile" && args[0] === fullTestPath) {
        return initialContent;
      }
      if (tool === "fs" && method === "writeFile") {
        expect(args[0]).toBe(fullTestPath);
        expect(args[1]).toBe(initialContent);
        return undefined;
      }
      throw new Error(`Unexpected invoke call: ${tool}.${method}`);
    });

    const toolArgs = ReplaceInFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const input = {
      path: testFilePath,
      find: findString,
      replace: replaceString,
    };
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
      [fullTestPath, initialContent]
    );
    expect(result).toBe("OK");
  });

  it("toolMethod should return ERROR if file not found (readFile returns null)", async () => {
    mockTask.invoke.mockImplementation(async (tool, method, _types, args) => {
      if (tool === "fs" && method === "readFile" && args[0] === fullTestPath) {
        return null;
      }
      throw new Error(`Unexpected invoke call: ${tool}.${method}`);
    });

    const toolArgs = ReplaceInFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const result = await toolMethod({
      path: testFilePath,
      find: "a",
      replace: "b",
    });

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
    expect(result).toBe("ERROR");
  });

  it("toolMethod should return ERROR on other readFile errors", async () => {
    const error = new Error("Permission denied");
    mockTask.invoke.mockImplementation(async (tool, method, _types, args) => {
      if (tool === "fs" && method === "readFile" && args[0] === fullTestPath) {
        throw error;
      }
      throw new Error(`Unexpected invoke call: ${tool}.${method}`);
    });

    const toolArgs = ReplaceInFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const result = await toolMethod({
      path: testFilePath,
      find: "a",
      replace: "b",
    });

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
    expect(result).toBe("ERROR");
  });

  it("toolMethod should return ERROR on writeFile error", async () => {
    const initialContent = "Content to replace";
    const findString = "replace";
    const replaceString = "New Content";
    const error = new Error("Disk full");

    mockTask.invoke.mockImplementation(async (tool, method, _types, args) => {
      if (tool === "fs" && method === "readFile" && args[0] === fullTestPath) {
        return initialContent;
      }
      if (tool === "fs" && method === "writeFile") {
        throw error;
      }
      throw new Error(`Unexpected invoke call: ${tool}.${method}`);
    });

    const toolArgs = ReplaceInFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const input = {
      path: testFilePath,
      find: findString,
      replace: replaceString,
    };
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
      [fullTestPath, "Content to New Content"]
    );
    expect(result).toBe("ERROR");
  });

  it("toolMethod should return ERROR if 'find' string is not found", async () => {
    const initialContent = "Some other content";
    const findString = "Content not present";
    const replaceString = "Replacement";

    mockTask.invoke.mockResolvedValue(initialContent);

    const toolArgs = ReplaceInFile.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const input = {
      path: testFilePath,
      find: findString,
      replace: replaceString,
    };
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
    expect(result).toBe("ERROR");
  });
});
