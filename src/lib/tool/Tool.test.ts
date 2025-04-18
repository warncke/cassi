import { describe, it, expect, vi, Mocked, beforeEach, Mock } from "vitest"; // Import Mocked, beforeEach, and Mock
import { Tool } from "./Tool.js";
import { User } from "../user/User.js";
import { Config } from "../config/Config.js";
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
  let mockUser: Mocked<User>; // Use Mocked<T>
  let mockConfig: Mocked<Config>; // Use Mocked<T>
  // Use the imported LocalFS type again
  let mockLocalFSInstance: Mocked<LocalFS>;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create fresh mocks for each test
    mockUser = new User() as Mocked<User>; // Use Mocked<T>
    mockConfig = new Config("", mockUser) as Mocked<Config>; // Use Mocked<T>

    // Mock the LocalFS constructor and its methods directly
    // Use 'any' cast for readFile mock assignment remains as a precaution
    mockLocalFSInstance = {
      readFile: vi.fn() as any,
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

    await Tool.init(); // Run static initialization which should use the mocks

    // Assertions
    expect(consoleSpy).toHaveBeenCalledWith("Initializing tools...");
    expect(consoleSpy).toHaveBeenCalledWith("Found tool type directory: fs");
    // Check that it attempts to load index.js first due to the logic in Tool.ts
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Attempting to load tool: fs from ../tools/fs/index.js"
      )
    );
    // Check that the correct tool (LocalFS from index.js/Local.js) was loaded
    expect(consoleSpy).toHaveBeenCalledWith(
      "Successfully loaded and initialized tool: fs"
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      "Tool initialization complete. Available tools:",
      ["fs"]
    );

    // Verify that the mocked LocalFS constructor was called during init
    expect(LocalFS).toHaveBeenCalledTimes(1);
    // Verify the instance in the static availableTools is the one created by the mock constructor
    expect(Tool["availableTools"]).toHaveProperty("fs");
    expect(Tool["availableTools"]!["fs"]).toBe(mockLocalFSInstance); // Use non-null assertion

    // Clean up spy
    consoleSpy.mockRestore();
    // Restore default mock implementations if needed, though beforeEach handles resets
  });

  describe("invoke", () => {
    // No tool instance needed for static methods

    beforeEach(() => {
      // Reset the mocked constructor implementation
      vi.mocked(LocalFS).mockClear();
      vi.mocked(LocalFS).mockImplementation(() => mockLocalFSInstance);

      // Manually populate static availableTools for invoke tests, bypassing init()
      Tool["availableTools"] = { fs: mockLocalFSInstance };
    });

    it("should invoke a method on a valid tool", async () => {
      const filePath = "test.txt";
      const fileContent = "hello world";
      // Cast the mockResolvedValue *call* itself to any
      (mockLocalFSInstance.readFile.mockResolvedValue as any)(fileContent);

      // Call static invoke
      const result = await Tool.invoke("fs", "readFile", filePath, "utf8");

      expect(result).toBe(fileContent);
      expect(mockLocalFSInstance.readFile).toHaveBeenCalledWith(
        filePath,
        "utf8"
      );
      expect(mockLocalFSInstance.readFile).toHaveBeenCalledTimes(1);
    });

    it("should throw an error if tool type is not found", async () => {
      // Ensure init is mocked or bypassed if invoke calls it internally
      vi.spyOn(Tool, "init").mockResolvedValue(Tool["availableTools"] ?? {}); // Mock init to return current static tools

      await expect(Tool.invoke("nonexistent", "someMethod")).rejects.toThrow(
        'Tool type "nonexistent" not found or tools failed to initialize.' // Updated error message
      );
    });

    it("should throw an error if method is not found on the tool", async () => {
      vi.spyOn(Tool, "init").mockResolvedValue(Tool["availableTools"] ?? {}); // Mock init

      await expect(Tool.invoke("fs", "nonexistentMethod")).rejects.toThrow(
        'Method "nonexistentMethod" not found on tool type "fs".'
      );
    });

    it("should pass arguments correctly to the invoked method", async () => {
      vi.spyOn(Tool, "init").mockResolvedValue(Tool["availableTools"] ?? {}); // Mock init

      const filePath = "path/to/file.txt";
      const content = "some data";
      // Mock writeFile
      mockLocalFSInstance.writeFile.mockResolvedValue(undefined);

      await Tool.invoke("fs", "writeFile", filePath, content);

      expect(mockLocalFSInstance.writeFile).toHaveBeenCalledWith(
        filePath,
        content
      );
      expect(mockLocalFSInstance.writeFile).toHaveBeenCalledTimes(1);
    });
  });
});
