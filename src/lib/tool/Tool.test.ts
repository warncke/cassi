import { describe, it, expect, vi, Mocked, beforeEach, Mock } from "vitest"; // Import Mocked, beforeEach, and Mock
import { Tool } from "./Tool.js";
import { User } from "../user/User.js";
import { Config } from "../config/Config.js";
import { Task } from "../task/Task.js"; // Import Task
import { Cassi } from "../cassi/Cassi.js"; // Import Cassi for mocking Task
import LocalFS from "../tools/fs/LocalFS.js";
import * as fsPromises from "fs/promises";
import { Stats, PathLike } from "fs";
import { Invocation } from "./Invocation.js"; // Import Invocation for spying
import * as path from "path"; // Need path for resolving paths in mocks
import { fileURLToPath } from "url"; // Need this for __dirname equivalent

// Mock the dependencies
vi.mock("../user/User.js");
vi.mock("../config/Config.js");
vi.mock("../tools/fs/LocalFS.js"); // Mock the original module (Vitest replaces with mock)
vi.mock("fs/promises"); // Mock the fs/promises module
// Mock the dynamic import target to return the already mocked LocalFS constructor
vi.mock("../tools/fs/index.js", () => ({ default: LocalFS }));
// REMOVE: vi.mock("./Invocation.js"); // No longer mocking Invocation

// Define a mock tool class that accepts constructor args
class MockToolWithArgs {
  user: User;
  config: Config;
  toolArg1: string;
  toolArg2: boolean;
  // mockMethod: Mock = vi.fn(); // Remove instance property

  constructor(user: User, config: Config, toolArg1: string, toolArg2: boolean) {
    this.user = user;
    this.config = config;
    this.toolArg1 = toolArg1;
    this.toolArg2 = toolArg2;
  }

  // Define mockMethod as an actual method
  async mockMethod(...args: any[]): Promise<any> {
    // Default implementation (can be overridden by spyOn)
    return "default mockMethod result";
  }
}
// Mock the dynamic import for this new tool type
vi.mock("../tools/mockTool/MockToolWithArgs.js", () => ({
  default: MockToolWithArgs,
}));

// Helper to get __dirname in ES Modules for test file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); // Use standard path import

describe("Tool", () => {
  let mockUser: User; // Use non-mocked type for constructor args
  let mockConfig: Config; // Use non-mocked type for constructor args
  let mockLocalFSInstance: Mocked<LocalFS>;
  let mockToolWithArgsInstance: Mocked<MockToolWithArgs>;
  let toolInstance: Tool;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create fresh instances (not deeply mocked) for constructor args
    mockUser = new User();
    mockConfig = new Config("", mockUser);
    // Instantiate Tool with these instances
    toolInstance = new Tool(mockUser, mockConfig);

    // Mock the LocalFS constructor and its methods directly
    mockLocalFSInstance = {
      // Correctly type the mock function signature
      readFile:
        vi.fn<
          ([path, encoding]: [string, string?]) => Promise<string | Buffer>
        >(),
      writeFile: vi.fn(),
      // Add mocks for other LocalFS methods if needed for tests
    } as unknown as Mocked<LocalFS>;

    // Configure the implementation of the *mocked* LocalFS constructor
    vi.mocked(LocalFS).mockImplementation(() => mockLocalFSInstance);

    // We don't need to mock MockToolWithArgs here anymore,
    // as it will be handled within the specific test case.
  });

  // Remove the instantiation test as constructor logic changed significantly
  // it("should instantiate correctly...", () => { ... });

  it("should initialize correctly, loading tools and ignoring test files", async () => {
    // Mock fs operations for init
    // Use standard path import for setting up test conditions
    const toolsRootPath = path.resolve(__dirname, "../tools");
    const fsToolPath = path.join(toolsRootPath, "fs");

    // Mock readdir for the main tools directory
    vi.mocked(fsPromises.readdir).mockImplementation(
      async (dirPath: PathLike) => {
        if (dirPath === toolsRootPath) {
          // The Tool class expects string[], but the mock type might expect Dirent[]
          // Return as 'any' to satisfy the mock type if necessary, while providing the expected data type.
          return ["fs"] as any;
        }
        if (dirPath === fsToolPath) {
          // Simulate finding the tool file and its test file
          return ["LocalFS.js", "LocalFS.test.js", "index.js"];
        }
        throw new Error(`Unexpected readdir path: ${dirPath}`);
      }
    );

    // Mock stat for directories and files
    vi.mocked(fsPromises.stat).mockImplementation(
      async (itemPath: PathLike) => {
        if (itemPath === fsToolPath) {
          return { isDirectory: () => true } as Stats; // 'fs' is a directory
        }
        if (
          itemPath === path.join(fsToolPath, "LocalFS.js") ||
          itemPath === path.join(fsToolPath, "LocalFS.test.js") ||
          itemPath === path.join(fsToolPath, "index.js") // Treat index.js as a file too
        ) {
          return { isDirectory: () => false } as Stats; // Files are not directories
        }
        throw new Error(`Unexpected stat path: ${itemPath}`);
      }
    );

    // NOTE: Dynamic import mock handled at top level

    // Reset and configure the *mocked* LocalFS constructor implementation *right before* init
    vi.mocked(LocalFS).mockClear();
    vi.mocked(LocalFS).mockImplementation(() => mockLocalFSInstance);

    // Reset static availableTools before testing init
    Tool["availableTools"] = null;

    // Spy on console.log
    const consoleSpy = vi.spyOn(console, "log");

    // Call init on the instance
    await toolInstance.init();

    // Assertions
    expect(consoleSpy).toHaveBeenCalledWith("Initializing tools...");
    expect(consoleSpy).toHaveBeenCalledWith("Found tool type directory: fs");
    // Check that it attempts to load index.js first due to the logic in Tool.ts
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Attempting to load tool: fs from ../tools/fs/index.js"
      )
    );
    // Check that the correct tool class (LocalFS from index.js) was loaded and logged
    expect(consoleSpy).toHaveBeenCalledWith(
      "Successfully loaded tool class: fs (index)" // Expect base filename and "class" in log
    );
    // Check the final log message (checking the exact stringified output of constructors is brittle)
    expect(consoleSpy).toHaveBeenCalledWith(
      "Tool initialization complete. Available tools:",
      expect.any(String) // Check that it logs *something* as the stringified map
    );

    // Verify that the mocked LocalFS constructor was NOT called during init (only stored)
    expect(LocalFS).not.toHaveBeenCalled();
    // Verify the constructor in the static availableTools using the two-level structure
    expect(Tool["availableTools"]).toHaveProperty("fs");
    expect(Tool["availableTools"]!["fs"]).toHaveProperty("index");
    // Check that the stored value is the mocked constructor itself
    expect(Tool["availableTools"]!["fs"]["index"]).toBe(LocalFS);

    // Clean up spy
    consoleSpy.mockRestore();
    // Restore default mock implementations if needed, though beforeEach handles resets
  });

  // Tests for the instance method 'invoke'
  describe("invoke", () => {
    // toolInstance is created in the outer beforeEach
    let mockTask: Task; // Declare mockTask variable

    // Create a mock Task instance to be used in invoke tests
    // We need a mock Cassi instance for the Task constructor
    const mockCassiForTask = {
      // Mock necessary Cassi properties/methods if Task uses them
      // Assuming Task constructor only needs a Cassi-like object shape
    } as Cassi;

    beforeEach(() => {
      // Create a fresh mock task for each test
      mockTask = new Task(mockCassiForTask);

      // Reset the mocked constructor implementation
      vi.mocked(LocalFS).mockClear();
      vi.mocked(LocalFS).mockImplementation(() => mockLocalFSInstance);

      // Manually populate static availableTools with mocked constructors
      Tool["availableTools"] = {
        fs: { index: LocalFS },
        mockTool: { MockToolWithArgs: MockToolWithArgs }, // Add the new mock tool
      };
      // No need to clear Invocation mock as it's not mocked anymore
    });

    it("should invoke a method on a valid tool", async () => {
      const filePath = "test.txt";
      const fileContent = "hello world";
      // Use 'as any' to bypass strict type checking for mockResolvedValue with overloaded return types
      mockLocalFSInstance.readFile.mockResolvedValue(fileContent as any);

      // Call invoke on the instance, passing the mock task
      const result = await toolInstance.invoke(
        mockTask, // Pass mock task
        "fs",
        "readFile",
        [], // Add empty toolArgs
        [filePath, "utf8"] // Pass method args as an array
      );

      // Verify the result and that the method on the *instance* was called
      expect(result).toBe(fileContent);
      // The actual tool method (readFile) no longer receives the task as the first arg from Invocation.invoke
      expect(mockLocalFSInstance.readFile).toHaveBeenCalledWith(
        // mockTask, // Task is no longer passed by Invocation
        filePath,
        "utf8"
      );
      expect(mockLocalFSInstance.readFile).toHaveBeenCalledTimes(1);
      // Verify that the constructor was called *during* invoke
      expect(LocalFS).toHaveBeenCalledTimes(1);
      // Verify constructor was called with the correct user and config
      expect(LocalFS).toHaveBeenCalledWith(mockUser, mockConfig);
    });

    it("should pass toolArgs to the tool constructor and Invocation", async () => {
      const toolName = "mockTool";
      const methodName = "mockMethod";
      const mockToolArgs = ["constructorArg", true];
      const mockMethodArgs = [123, { data: "payload" }];
      const mockResult = "mock tool result";

      // --- Test Setup ---
      // Spy on the prototype method *before* invoke is called
      const methodSpy = vi
        .spyOn(MockToolWithArgs.prototype, "mockMethod")
        .mockResolvedValue(mockResult);

      // Ensure Tool uses the class (mocked at the top level)
      Tool["availableTools"] = {
        fs: { index: LocalFS },
        mockTool: { MockToolWithArgs: MockToolWithArgs },
      };
      // --- End Test Setup ---

      // Call invoke with toolArgs
      const result = await toolInstance.invoke(
        mockTask,
        toolName,
        methodName,
        mockToolArgs,
        mockMethodArgs // Pass method args as an array (no spread)
      );

      // 1. Verify Tool Constructor Call (Indirectly)
      // We can't reliably assert on the constructor call itself with this setup.
      // We'll verify the instance properties via the method spy context below.

      // 2. Verify Tool Method Call (using the prototype spy)
      expect(methodSpy).toHaveBeenCalledTimes(1);
      // Task is no longer passed by Invocation
      expect(methodSpy).toHaveBeenCalledWith(...mockMethodArgs);

      // 3. Verify Constructor Args via Method Spy Context ('this')
      // Check that the 'this' context within the method spy call corresponds to an instance
      // that received the correct constructor arguments.
      const methodCallContext = methodSpy.mock.contexts[0];
      expect(methodCallContext).toBeInstanceOf(MockToolWithArgs);
      // Add type assertions before accessing properties
      expect((methodCallContext as MockToolWithArgs).toolArg1).toBe(
        mockToolArgs[0]
      );
      expect((methodCallContext as MockToolWithArgs).toolArg2).toBe(
        mockToolArgs[1]
      );
      expect((methodCallContext as MockToolWithArgs).user).toBe(mockUser);
      expect((methodCallContext as MockToolWithArgs).config).toBe(mockConfig);

      // 4. Verify Invocation Constructor Call (No longer mocked)

      // 4. Verify Result
      expect(result).toBe(mockResult);
    });

    it("should throw an error if tool type is not found", async () => {
      // Ensure init is called if needed, or rely on beforeEach setup
      // Spy on the instance init method if necessary, but usually covered by beforeEach
      // const initSpy = vi.spyOn(toolInstance, 'init').mockResolvedValue(Tool["availableTools"] ?? {});

      // Reset constructor mock count before this specific test
      vi.mocked(LocalFS).mockClear();

      // Invoke without toolArgs, relying on optional parameter default
      await expect(
        toolInstance.invoke(mockTask, "nonexistent", "someMethod")
      ).rejects.toThrow(
        'Tool type "nonexistent" not found or failed to initialize.' // Updated error message
      );
      // Ensure constructor wasn't called if tool type doesn't exist
      expect(LocalFS).not.toHaveBeenCalled();
    });

    it("should throw an error if method is not found on the tool", async () => {
      // Ensure init is called if needed, or rely on beforeEach setup
      // const initSpy = vi.spyOn(toolInstance, 'init').mockResolvedValue(Tool["availableTools"] ?? {});

      // Reset constructor mock count before this specific test
      vi.mocked(LocalFS).mockClear();

      // Invoke without toolArgs, relying on optional parameter default
      await expect(
        toolInstance.invoke(mockTask, "fs", "nonexistentMethod")
      ).rejects.toThrow(
        'Method "nonexistentMethod" not found on tool "fs" (implementation "index").' // Updated error message
      );
      // Ensure constructor *was* called because the tool type exists
      expect(LocalFS).toHaveBeenCalledTimes(1);
    });

    it("should pass arguments correctly to the invoked method", async () => {
      // Ensure init is called if needed, or rely on beforeEach setup
      // const initSpy = vi.spyOn(toolInstance, 'init').mockResolvedValue(Tool["availableTools"] ?? {});

      const filePath = "path/to/file.txt";
      const content = "some data";
      mockLocalFSInstance.writeFile.mockResolvedValue(undefined);

      // Call invoke on the instance
      // Reset constructor mock count before this specific test
      vi.mocked(LocalFS).mockClear();

      // Removed duplicate declarations below

      mockLocalFSInstance.writeFile.mockResolvedValue(undefined);

      // Call invoke on the instance, passing the mock task
      await toolInstance.invoke(
        mockTask,
        "fs",
        "writeFile",
        [], // Add empty toolArgs
        [filePath, content] // Pass method args as an array
      ); // Pass mock task and empty toolArgs

      // Verify the method on the instance was called correctly
      // The actual tool method (writeFile) no longer receives the task as the first arg from Invocation.invoke
      expect(mockLocalFSInstance.writeFile).toHaveBeenCalledWith(
        // mockTask, // Task is no longer passed by Invocation
        filePath,
        content
      );
      expect(mockLocalFSInstance.writeFile).toHaveBeenCalledTimes(1);
      // Verify constructor was called
      expect(LocalFS).toHaveBeenCalledTimes(1);
      // Verify constructor was called with the correct user and config
      expect(LocalFS).toHaveBeenCalledWith(mockUser, mockConfig);
    });
  });
});
