import { describe, it, expect, vi, beforeEach } from "vitest"; // Added beforeEach
import { Coder } from "./Coder.js";
import { Cassi } from "../../cassi/Cassi.js";
import { Task } from "../Task.js";
import { User } from "../../user/User.js"; // Import User

// Mock dependencies
vi.mock("../../cassi/Cassi");
vi.mock("../../user/User"); // Mock User dependency
vi.mock("../Task"); // Use Vitest's auto-mocking for the base class

describe("Coder Task", () => {
  // Get the auto-mocked Task constructor
  const MockTask = vi.mocked(Task, true); // Use deep mocking

  // Clear mocks before each test
  beforeEach(() => {
    // MockTask.mockClear(); // May not work the same with auto-mock
    vi.clearAllMocks(); // Clear all mocks instead
  });

  it("should initialize with the correct prompt", () => {
    // Create mock arguments for Cassi constructor
    const mockUser = new User() as User; // Mock User instance
    const mockConfigFile = "mock-config.json";
    const mockRepoDir = "/mock/repo/dir";
    // Instantiate Cassi with mock arguments
    const mockCassi = new Cassi(mockUser, mockConfigFile, mockRepoDir) as Cassi;
    const mockParentTask = null; // No parent task for this test
    const testPrompt = "Test prompt for Coder task";

    const coderTask = new Coder(mockCassi, mockParentTask, testPrompt);

    expect(coderTask).toBeInstanceOf(Coder);
    expect(coderTask.prompt).toBe(testPrompt);
    // Check if it's also an instance of the base Task class (might be tricky with mocks)
    // Check if it's also an instance of the base Task class
    expect(coderTask).toBeInstanceOf(Task); // This might work better now
    // Verify the mock constructor was called correctly
    expect(MockTask).toHaveBeenCalledTimes(1);
    expect(MockTask).toHaveBeenCalledWith(mockCassi, mockParentTask);
  });

  it("should have an initTask method", async () => {
    // Create mock arguments for Cassi constructor
    const mockUser = new User() as User; // Mock User instance
    const mockConfigFile = "mock-config.json";
    const mockRepoDir = "/mock/repo/dir";
    // Instantiate Cassi with mock arguments
    const mockCassi = new Cassi(mockUser, mockConfigFile, mockRepoDir) as Cassi;
    const mockParentTask = null;
    const testPrompt = "Another test prompt";
    const coderTask = new Coder(mockCassi, mockParentTask, testPrompt);

    // --- Mock the newModel method for this specific instance ---
    const mockGenerate = vi.fn().mockResolvedValue("mock generated code");
    const mockCoderModelInstance = {
      generate: mockGenerate,
      // Add any other properties/methods of CoderModel if needed by initTask
    };
    // Mock the inherited newModel method directly on the instance
    coderTask.newModel = vi.fn().mockReturnValue(mockCoderModelInstance);
    // --- End Mock ---

    // Check if the method exists
    expect(coderTask.initTask).toBeDefined();

    // Call the method and check that it resolves (doesn't throw the TypeError)
    await expect(coderTask.initTask()).resolves.toBeUndefined();

    // Verify that newModel was called within initTask
    expect(coderTask.newModel).toHaveBeenCalledWith("Coder");
    // Verify that the mock model's generate method was called
    expect(mockGenerate).toHaveBeenCalledWith(testPrompt);
  });
});
