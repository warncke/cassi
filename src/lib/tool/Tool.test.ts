import { describe, it, expect, vi, Mocked, beforeEach, Mock } from "vitest"; // Import Mocked, beforeEach, and Mock
import { Tool } from "./Tool.js";
import { User } from "../user/User.js";
import { Config } from "../config/Config.js";
import { Task } from "../task/Task.js"; // Import Task
import { Cassi } from "../cassi/Cassi.js"; // Import Cassi for mocking Task
import LocalFS from "../tools/fs/Local.js"; // Re-import LocalFS
import * as fsPromises from "fs/promises"; // Use alias to avoid conflict
import { Stats, PathLike } from "fs"; // Import Stats and PathLike types from base 'fs'
import * as path from "path"; // Need path for resolving paths in mocks
import { fileURLToPath } from "url"; // Need this for __dirname equivalent

// Mock the dependencies
vi.mock("../user/User.js");
vi.mock("../config/Config.js");
vi.mock("../tools/fs/Local.js"); // Mock the original module (Vitest replaces with mock)
vi.mock("fs/promises"); // Mock the fs/promises module
// Mock the dynamic import target to return the already mocked LocalFS constructor
vi.mock("../tools/fs/index.js", () => {
  // LocalFS identifier here should refer to the mock created by vi.mock("../tools/fs/Local.js")
  return { default: LocalFS };
});

// Helper to get __dirname in ES Modules for test file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); // Use standard path import

describe("Tool", () => {
  let mockUser: Mocked<User>;
  let mockConfig: Mocked<Config>;
  let mockLocalFSInstance: Mocked<LocalFS>;
  let toolInstance: Tool; // Add instance variable for Tool

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create fresh mocks for each test
    mockUser = new User() as Mocked<User>;
    mockConfig = new Config("", mockUser) as Mocked<Config>;
    // Instantiate Tool with mocks
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
          return ["Local.js", "Local.test.js", "index.js"];
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
          itemPath === path.join(fsToolPath, "Local.js") ||
          itemPath === path.join(fsToolPath, "Local.test.js") ||
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

      // Manually populate static availableTools with the mocked *constructor*
      Tool["availableTools"] = { fs: { index: LocalFS } }; // Store the mocked constructor
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
        filePath,
        "utf8"
      );

      // Verify the result and that the method on the *instance* was called
      expect(result).toBe(fileContent);
      // The actual tool method (readFile) receives the task as the first arg from Invocation.invoke
      expect(mockLocalFSInstance.readFile).toHaveBeenCalledWith(
        mockTask, // Expect task as first arg passed by Invocation
        filePath,
        "utf8"
      );
      expect(mockLocalFSInstance.readFile).toHaveBeenCalledTimes(1);
      // Verify that the constructor was called *during* invoke
      expect(LocalFS).toHaveBeenCalledTimes(1);
      // Verify constructor was called with the correct user and config
      expect(LocalFS).toHaveBeenCalledWith(mockUser, mockConfig);
    });

    it("should throw an error if tool type is not found", async () => {
      // Ensure init is called if needed, or rely on beforeEach setup
      // Spy on the instance init method if necessary, but usually covered by beforeEach
      // const initSpy = vi.spyOn(toolInstance, 'init').mockResolvedValue(Tool["availableTools"] ?? {});

      // Reset constructor mock count before this specific test
      vi.mocked(LocalFS).mockClear();

      await expect(
        toolInstance.invoke(mockTask, "nonexistent", "someMethod") // Pass mock task
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

      await expect(
        toolInstance.invoke(mockTask, "fs", "nonexistentMethod") // Pass mock task
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
      await toolInstance.invoke(mockTask, "fs", "writeFile", filePath, content); // Pass mock task

      // Verify the method on the instance was called correctly
      // The actual tool method (writeFile) receives the task as the first arg from Invocation.invoke
      expect(mockLocalFSInstance.writeFile).toHaveBeenCalledWith(
        mockTask, // Expect task as first arg passed by Invocation
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
