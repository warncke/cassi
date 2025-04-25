import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Model } from "./Model.js";
import { Models, GenerateModelOptions } from "./Models.js";
import { User } from "../user/User.js";
import { Config } from "../config/Config.js";
import { Task } from "../task/Task.js"; // Import Task
import fs from "fs/promises";
import path from "path";
// Removed ModelReference import as it's not directly used here anymore

// Mock the dependencies
vi.mock("../user/User.js");
vi.mock("../config/Config.js");
vi.mock("../task/Task.js"); // Mock Task
vi.mock("fs/promises");

// Mock genkit imports - define mocks *inside* the factory function
vi.mock("@genkit-ai/googleai", () => {
  // Mock googleAI to return a simple function, as genkit likely expects a plugin function/object
  const mockGoogleAI = vi.fn(() => () => "mockGoogleAIPlugin"); // Return a function
  // Removed mockGemini20Flash as it's not used in newInstance anymore
  return {
    googleAI: mockGoogleAI, // googleAI() now returns a function
  };
});

vi.mock("path", async (importOriginal) => {
  const actualPath = await importOriginal<typeof path>();
  const mockFunctions = {
    join: vi.fn((...args: string[]) => actualPath.join(...args)),
    dirname: vi.fn((file: string) => actualPath.dirname(file)),
    // Include other common path functions to ensure compatibility
    sep: actualPath.sep,
    resolve: actualPath.resolve,
    basename: actualPath.basename,
    extname: actualPath.extname,
    isAbsolute: actualPath.isAbsolute,
    normalize: actualPath.normalize,
    relative: actualPath.relative,
    parse: actualPath.parse,
    format: actualPath.format,
    // Add any other path functions if needed by the code under test
  };
  // Return both the individual functions and a 'default' object containing them
  return {
    ...mockFunctions,
    default: mockFunctions,
  };
});

// --- Mock Model Classes ---
// Define these *before* they are used in vi.mock below
// Update constructors to accept new signature (plugin, task) and extend Models
class MockModel1 extends Models {
  public plugin: any;
  constructor(plugin: any, task: Task) {
    // Add task parameter
    super(plugin, task); // Pass task to super
    this.plugin = plugin;
  }
  // Implement abstract generate method
  async generate(options: GenerateModelOptions): Promise<string> {
    // Simple mock implementation
    return `MockModel1 generated: ${
      typeof options.prompt === "string"
        ? options.prompt
        : JSON.stringify(options.prompt)
    }`;
  }
}
class MockModel2 extends Models {
  public plugin: any;
  constructor(plugin: any, task: Task) {
    // Add task parameter
    super(plugin, task); // Pass task to super
    this.plugin = plugin;
  }
  // Implement abstract generate method
  async generate(options: GenerateModelOptions): Promise<string> {
    // Simple mock implementation
    return `MockModel2 generated: ${
      typeof options.prompt === "string"
        ? options.prompt
        : JSON.stringify(options.prompt)
    }`;
  }
}
const notAModel = { foo: "bar" };
const SomeOtherClass = class {};
const someFunction = () => {};
// --- End Mock Model Classes ---

// Mock the dynamically imported modules using string literals directly (now with .js)
vi.mock("/fake/path/to/lib/model/models/MockModel1.js", () => ({ MockModel1 }));
vi.mock("/fake/path/to/lib/model/models/MockModel2.js", () => ({ MockModel2 }));
vi.mock("/fake/path/to/lib/model/models/helper.js", () => ({ notAModel }));
vi.mock("/fake/path/to/lib/model/models/FailingModel.js", () => {
  throw new Error("Failed to import"); // Simulate import failure
});
vi.mock("/fake/path/to/lib/model/models/NotAModel.js", () => ({
  SomeOtherClass,
  someFunction,
}));

vi.mock("url", async (importOriginal) => {
  const actualUrl = await importOriginal<typeof import("url")>();
  return {
    ...actualUrl,
    fileURLToPath: (url: string | URL) => {
      // Simple mock for fileURLToPath, adjust if needed for complex paths
      if (typeof url === "string" && url.startsWith("file://")) {
        return url.substring(7);
      }
      return actualUrl.fileURLToPath(url);
    },
  };
});
// No longer using vi.stubGlobal("import", mockImport);

describe("Model", () => {
  let mockUser: User;
  let mockConfig: Config;
  let mockTask: Task; // Declare mock task variable

  let model: Model; // Declare model instance

  beforeEach(() => {
    // Reset mocks and state before each test
    vi.resetAllMocks();
    // No need to clear static map anymore

    mockUser = new User(); // Keep these for potential other uses if needed, or remove if truly unused
    mockConfig = new Config("test-config.json", mockUser); // Keep these for potential other uses if needed, or remove if truly unused
    // Instantiate mockTask using the mocked Task constructor
    mockTask = new (Task as any)("mock-task-id") as Task;
    model = new Model(); // Revert: No task needed in Model constructor

    // Default mock for path.join to return a predictable models directory path
    vi.mocked(path.join).mockImplementation((...args) => {
      // A simple join mock, adjust if more complex paths are needed
      if (args[1] === "models") {
        return "/fake/path/to/lib/model/models";
      }
      return args.join("/"); // Fallback basic join
    });
    // Mock path.dirname to return the directory for Model.ts
    vi.mocked(path.dirname).mockReturnValue("/fake/path/to/lib/model");
  });

  afterEach(() => {
    vi.restoreAllMocks(); // Restore original implementations
  });

  // Removed test for user/config properties

  describe("init", () => {
    it("should initialize availableModels by reading the models directory", async () => {
      // Arrange
      const mockFiles = [
        "MockModel1.js", // Changed to .js
        "MockModel2.js", // Changed to .js
        "helper.js", // Changed to .js
        "ignore.test.js", // Changed to .js
      ];
      vi.mocked(fs.readdir).mockResolvedValue(mockFiles as any); // Type assertion needed

      // No need to mock mockImport implementation anymore
      const modelInstance = new Model(); // Revert: No task needed

      // Act
      await modelInstance.init(); // Call instance method

      // Assert
      expect(fs.readdir).toHaveBeenCalledWith("/fake/path/to/lib/model/models");
      // Remove assertions for mockImport calls
      // Assert the result based on the vi.mock setup on the instance
      expect(modelInstance.availableModels.size).toBe(2);
      // Check if the stored item is the constructor function
      expect(modelInstance.availableModels.get("MockModel1")).toBe(
        MockModel1 as any // Cast needed due to complex type
      );
      expect(modelInstance.availableModels.get("MockModel2")).toBe(
        MockModel2 as any // Cast needed due to complex type
      );
    });

    it("should skip .test.js files", async () => {
      // Test description updated
      // Arrange
      const mockFiles = ["MockModel1.js", "MockModel1.test.js"]; // Changed to .js
      vi.mocked(fs.readdir).mockResolvedValue(mockFiles as any);
      // No need to mock mockImport implementation
      const modelInstance = new Model(); // Revert: No task needed

      // Act
      await modelInstance.init(); // Call instance method

      // Assert
      // Remove assertions for mockImport calls
      // Assert the result based on the vi.mock setup on the instance
      expect(modelInstance.availableModels.size).toBe(1);
      expect(modelInstance.availableModels.get("MockModel1")).toBe(
        MockModel1 as any // Cast needed
      );
    });

    it("should handle errors when reading the directory", async () => {
      // Arrange
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const testError = new Error("Failed to read directory");
      vi.mocked(fs.readdir).mockRejectedValue(testError);
      const modelInstance = new Model(); // Revert: No task needed

      // Act
      await modelInstance.init(); // Call instance method

      // Assert
      expect(modelInstance.availableModels.size).toBe(0); // Check instance map
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error reading models directory:",
        testError
      );

      consoleErrorSpy.mockRestore(); // Clean up spy
    });

    it("should handle errors during dynamic import", async () => {
      // Arrange
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const mockFiles = ["FailingModel.js"]; // Changed to .js
      const expectedError = new Error("Failed to import"); // Error defined in vi.mock
      vi.mocked(fs.readdir).mockResolvedValue(mockFiles as any);
      // No need to mock mockImport implementation
      const modelInstance = new Model(); // Revert: No task needed

      // Act
      await modelInstance.init(); // Call instance method

      // Assert
      expect(modelInstance.availableModels.size).toBe(0); // Check instance map
      // Check that the specific error from the mock was caught and logged
      // Vitest wraps errors from mock factories, so we check the cause
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error importing model from /fake/path/to/lib/model/models/FailingModel.js:", // Changed to .js
        expect.objectContaining({
          // Match the wrapper error
          cause: expectedError, // Check that the cause is our original error
        })
      );

      consoleErrorSpy.mockRestore();
    });

    it("should only add classes that extend Model", async () => {
      // Arrange
      const mockFiles = ["MockModel1.js", "NotAModel.js"]; // Changed to .js
      vi.mocked(fs.readdir).mockResolvedValue(mockFiles as any);
      // No need to mock mockImport implementation
      const modelInstance = new Model(); // Revert: No task needed

      // Act
      await modelInstance.init(); // Call instance method

      // Assert
      expect(modelInstance.availableModels.size).toBe(1); // Check instance map
      expect(modelInstance.availableModels.get("MockModel1")).toBe(
        MockModel1 as any // Cast needed
      );
      expect(modelInstance.availableModels.has("SomeOtherClass")).toBe(false);
    });

    it("should not re-initialize if called multiple times", async () => {
      // Arrange
      const mockFiles = ["MockModel1.js"];
      vi.mocked(fs.readdir).mockResolvedValue(mockFiles as any);
      const consoleLogSpy = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});

      // Use the model instance created in beforeEach
      // Reset the spy *before* the calls within this specific test
      consoleLogSpy.mockClear();

      // Act
      await model.init(); // First call (using the instance from beforeEach)
      await model.init(); // Second call

      // Assert
      expect(model.availableModels.size).toBe(1);
      // Check that the initialization log message was called exactly once *during this test's execution*
      const initLogCalls = consoleLogSpy.mock.calls.filter(
        (call) => call[0] === "Initializing available models for instance..."
      );
      expect(initLogCalls.length).toBeLessThanOrEqual(1); // Should be 0 or 1

      consoleLogSpy.mockRestore();
    });
  });

  describe("newInstance", () => {
    beforeEach(async () => {
      // Ensure models are initialized before each newInstance test using the instance from the outer beforeEach
      const mockFiles = ["MockModel1.js", "MockModel2.js"];
      vi.mocked(fs.readdir).mockResolvedValue(mockFiles as any);
      await model.init(); // Initialize the instance's availableModels
    });

    // Mark test as async
    it("should create a new instance of the specified model class", async () => {
      // Arrange
      // No need to re-import gemini20Flash

      // Act
      // Use the model instance from beforeEach
      const newInstance = model.newInstance("MockModel1", mockTask); // Pass mockTask here

      // Assert
      expect(newInstance).toBeInstanceOf(MockModel1);
      expect(newInstance).toBeInstanceOf(Models); // Should be instance of base Models
      // Check if the plugin was passed (specific to MockModel1 structure)
      expect(typeof (newInstance as MockModel1).plugin).toBe("function");
      // Check if the task was passed (accessing protected member for test)
      expect((newInstance as any).task).toBe(mockTask);
    });

    // Removed redundant test that spied on the constructor

    it("should throw an error if the model class name is not found", () => {
      // Arrange
      const modelName = "NonExistentModel";

      // Act & Assert
      // Use the model instance from beforeEach
      expect(() => model.newInstance(modelName, mockTask)).toThrow(
        // Pass mockTask here
        `Model class '${modelName}' not found.`
      );
    });

    it("should throw an error if init() has not been called", () => {
      // Arrange
      const freshModel = new Model(); // Revert: No task needed in constructor

      // Act & Assert
      expect(() => freshModel.newInstance("MockModel1", mockTask)).toThrow(
        // Pass mockTask here
        `Model class 'MockModel1' not found.` // Because availableModels is empty
      );
    });
  });
});
