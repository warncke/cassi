import { describe, it, expect, vi, Mocked, beforeEach, Mock } from "vitest";
import { Tool } from "./Tool.js";
import { User } from "../user/User.js";
import { Config } from "../config/Config.js";
import { Task } from "../task/Task.js";
import { Cassi } from "../cassi/Cassi.js";
import LocalFS from "../tools/fs/LocalFS.js";
import * as fsPromises from "fs/promises";
import { Stats, PathLike } from "fs";
import { Invocation } from "./Invocation.js";
import * as path from "path";
import { fileURLToPath } from "url";

vi.mock("../user/User.js");
vi.mock("../config/Config.js");
vi.mock("../tools/fs/LocalFS.js");
vi.mock("fs/promises");
vi.mock("../tools/fs/index.js", () => ({ default: LocalFS }));

class MockToolWithArgs {
  toolArg1: string;
  toolArg2: boolean;

  constructor(toolArg1: string, toolArg2: boolean) {
    this.toolArg1 = toolArg1;
    this.toolArg2 = toolArg2;
  }

  async mockMethod(...args: any[]): Promise<any> {
    return "default mockMethod result";
  }
}
vi.mock("../tools/mockTool/MockToolWithArgs.js", () => ({
  default: MockToolWithArgs,
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Tool", () => {
  let mockUser: User;
  let mockConfig: Config;
  let mockLocalFSInstance: Mocked<LocalFS>;
  let mockToolWithArgsInstance: Mocked<MockToolWithArgs>;
  let toolInstance: Tool;

  beforeEach(() => {
    vi.clearAllMocks();

    mockUser = new User();
    mockConfig = new Config("", mockUser);
    toolInstance = new Tool(mockUser, mockConfig);

    mockLocalFSInstance = {
      readFile:
        vi.fn<
          ([path, encoding]: [string, string?]) => Promise<string | Buffer>
        >(),
      writeFile: vi.fn(),
    } as unknown as Mocked<LocalFS>;

    vi.mocked(LocalFS).mockImplementation(() => mockLocalFSInstance);
  });

  it("should initialize correctly, loading tools and ignoring test files", async () => {
    const toolsRootPath = path.resolve(__dirname, "../tools");
    const fsToolPath = path.join(toolsRootPath, "fs");

    vi.mocked(fsPromises.readdir).mockImplementation(
      async (dirPath: PathLike) => {
        if (dirPath === toolsRootPath) {
          return ["fs"] as any;
        }
        if (dirPath === fsToolPath) {
          return ["LocalFS.js", "LocalFS.test.js", "index.js"];
        }
        throw new Error(`Unexpected readdir path: ${dirPath}`);
      }
    );

    vi.mocked(fsPromises.stat).mockImplementation(
      async (itemPath: PathLike) => {
        if (itemPath === fsToolPath) {
          return { isDirectory: () => true } as Stats;
        }
        if (
          itemPath === path.join(fsToolPath, "LocalFS.js") ||
          itemPath === path.join(fsToolPath, "LocalFS.test.js") ||
          itemPath === path.join(fsToolPath, "index.js")
        ) {
          return { isDirectory: () => false } as Stats;
        }
        throw new Error(`Unexpected stat path: ${itemPath}`);
      }
    );

    vi.mocked(LocalFS).mockClear();
    vi.mocked(LocalFS).mockImplementation(() => mockLocalFSInstance);

    Tool["availableTools"] = null;

    await toolInstance.init();

    expect(LocalFS).not.toHaveBeenCalled();
    expect(Tool["availableTools"]).toHaveProperty("fs");
    expect(Tool["availableTools"]!["fs"]).toHaveProperty("index");
    expect(Tool["availableTools"]!["fs"]["index"]).toBe(LocalFS);
  });

  describe("invoke", () => {
    let mockTask: Task;

    const mockCassiForTask = {} as Cassi;

    beforeEach(() => {
      mockTask = new Task(mockCassiForTask);

      vi.mocked(LocalFS).mockClear();
      vi.mocked(LocalFS).mockImplementation(() => mockLocalFSInstance);

      Tool["availableTools"] = {
        fs: { index: LocalFS },
        mockTool: { MockToolWithArgs: MockToolWithArgs },
      };
    });

    it("should invoke a method on a valid tool", async () => {
      const filePath = "test.txt";
      const fileContent = "hello world";
      mockLocalFSInstance.readFile.mockResolvedValue(fileContent as any);

      const result = await toolInstance.invoke(
        mockTask,
        "fs",
        "readFile",
        [],
        [filePath, "utf8"]
      );

      expect(result).toBe(fileContent);
      expect(mockLocalFSInstance.readFile).toHaveBeenCalledWith(
        filePath,
        "utf8"
      );
      expect(mockLocalFSInstance.readFile).toHaveBeenCalledTimes(1);
      expect(LocalFS).toHaveBeenCalledTimes(1);
      expect(LocalFS).toHaveBeenCalledWith();
    });

    it("should pass toolArgs to the tool constructor and Invocation", async () => {
      const toolName = "mockTool";
      const methodName = "mockMethod";
      const mockToolArgs = ["constructorArg", true];
      const mockMethodArgs = [123, { data: "payload" }];
      const mockResult = "mock tool result";

      const methodSpy = vi
        .spyOn(MockToolWithArgs.prototype, "mockMethod")
        .mockResolvedValue(mockResult);

      Tool["availableTools"] = {
        fs: { index: LocalFS },
        mockTool: { MockToolWithArgs: MockToolWithArgs },
      };

      const result = await toolInstance.invoke(
        mockTask,
        toolName,
        methodName,
        mockToolArgs,
        mockMethodArgs
      );

      expect(methodSpy).toHaveBeenCalledTimes(1);
      expect(methodSpy).toHaveBeenCalledWith(...mockMethodArgs);

      const methodCallContext = methodSpy.mock.contexts[0];
      expect(methodCallContext).toBeInstanceOf(MockToolWithArgs);
      expect((methodCallContext as MockToolWithArgs).toolArg1).toBe(
        mockToolArgs[0]
      );
      expect((methodCallContext as MockToolWithArgs).toolArg2).toBe(
        mockToolArgs[1]
      );

      expect(result).toBe(mockResult);
    });

    it("should throw an error if tool type is not found", async () => {
      vi.mocked(LocalFS).mockClear();

      await expect(
        toolInstance.invoke(mockTask, "nonexistent", "someMethod")
      ).rejects.toThrow(
        'Tool type "nonexistent" not found or failed to initialize.'
      );
      expect(LocalFS).not.toHaveBeenCalled();
    });

    it("should throw an error if method is not found on the tool", async () => {
      vi.mocked(LocalFS).mockClear();

      await expect(
        toolInstance.invoke(mockTask, "fs", "nonexistentMethod")
      ).rejects.toThrow(
        'Method "nonexistentMethod" not found on tool "fs" (implementation "index").'
      );
      expect(LocalFS).toHaveBeenCalledTimes(1);
    });

    it("should pass arguments correctly to the invoked method", async () => {
      const filePath = "path/to/file.txt";
      const content = "some data";
      mockLocalFSInstance.writeFile.mockResolvedValue(undefined);

      vi.mocked(LocalFS).mockClear();

      mockLocalFSInstance.writeFile.mockResolvedValue(undefined);

      await toolInstance.invoke(
        mockTask,
        "fs",
        "writeFile",
        [],
        [filePath, content]
      );

      expect(mockLocalFSInstance.writeFile).toHaveBeenCalledWith(
        filePath,
        content
      );
      expect(mockLocalFSInstance.writeFile).toHaveBeenCalledTimes(1);
      expect(LocalFS).toHaveBeenCalledTimes(1);
      expect(LocalFS).toHaveBeenCalledWith();
    });
  });

  describe("allow", () => {
    let mockTask: Task;
    let mockInvocation: Invocation;

    beforeEach(() => {
      const mockCassiForTask = {} as Cassi;
      mockTask = new Task(mockCassiForTask);
      const mockToolInstance = {};
      const mockMethod = vi.fn();
      mockInvocation = new Invocation(
        mockTask,
        "testTool",
        "testImpl",
        "testMethod",
        mockMethod,
        mockToolInstance,
        [],
        []
      );
    });

    it("should return true for any invocation", async () => {
      const result = await toolInstance.allow(mockInvocation);
      expect(result).toBe(true);
    });
  });
});
