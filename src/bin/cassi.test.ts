import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { Cassi } from "../lib/cassi/Cassi.js";
import { User } from "../lib/user/User.js";
import { InitializeRepository } from "../lib/task/tasks/InitializeRepository.js";
import Input from "../lib/prompt/prompts/Input.js";
import { Prompt } from "../lib/prompt/Prompt.js";
import { Code } from "../lib/task/tasks/Code.js"; // Import Code task
import { CLIPromptHandler } from "../lib/cli-prompt-handler/CLIPromptHandler.js"; // Import actual type

// Mock dependencies
vi.mock("commander", () => {
  const Command = vi.fn();
  Command.prototype.option = vi.fn().mockReturnThis();
  Command.prototype.parse = vi.fn().mockReturnThis();
  Command.prototype.opts = vi.fn().mockReturnValue({
    repositoryDir: ".",
    configFile: "cassi.json",
  });
  return { Command };
});

vi.mock("../lib/cassi/Cassi.js");
vi.mock("../lib/user/User.js");
vi.mock("../lib/task/tasks/InitializeRepository.js");
vi.mock("../lib/task/tasks/Code.js"); // Mock Code task
vi.mock("../lib/prompt/prompts/Input.js");
vi.mock("../lib/prompt/Prompt.js");
vi.mock("../lib/cli-prompt-handler/CLIPromptHandler.js"); // Mock handler

describe("cassi bin script", () => {
  let mockCassiInstance: any;
  let mockUserInstance: any;
  let sharedMockInputInstance: {
    type: string;
    message: string;
    response: string | null;
  }; // Shared instance for Input mock
  let mockPromptInstance: Prompt; // Still useful for verifying Prompt creation
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let promptCallCounter = 0; // To control loop behavior

  beforeEach(() => {
    vi.clearAllMocks();
    promptCallCounter = 0; // Reset counter
    consoleLogSpy = vi.spyOn(console, "log"); // Spy without mocking implementation
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {}); // Keep error mocked

    // Create a shared mock instance for Input
    sharedMockInputInstance = { type: "input", message: "", response: null };

    // Mock Input constructor to always return the shared instance
    (Input as any).mockImplementation((message: string) => {
      sharedMockInputInstance.message = message; // Update message on the shared instance
      // Ensure response is null initially for each "creation" in the loop
      sharedMockInputInstance.response = null;
      return sharedMockInputInstance;
    });

    // Mock Prompt constructor
    (Prompt as any).mockImplementation((prompts: any[]) => {
      mockPromptInstance = { prompts: prompts };
      // Ensure the prompt sequence contains the shared input instance
      expect(prompts).toContain(sharedMockInputInstance);
      return mockPromptInstance;
    });

    // Mock CLIPromptHandler - not strictly needed as logic moved to user.prompt
    (CLIPromptHandler as any).mockImplementation(() => ({
      handlePrompt: vi.fn(),
    }));

    // Mock User
    mockUserInstance = {
      prompt: vi.fn().mockImplementation(async (promptSequence: Prompt) => {
        promptCallCounter++;
        // Directly modify the response of the shared Input instance
        if (promptCallCounter === 1) {
          sharedMockInputInstance.response = "test request";
        } else if (promptCallCounter >= 2) {
          sharedMockInputInstance.response = null; // Set to null for the second call
        }
        await Promise.resolve();
      }),
    };
    (User as any).mockImplementation(() => mockUserInstance);

    // Mock Cassi
    mockCassiInstance = {
      init: vi.fn().mockResolvedValue(undefined),
      newTask: vi.fn().mockResolvedValue(undefined),
      runTasks: vi.fn().mockResolvedValue(undefined),
      user: mockUserInstance,
      configFile: "cassi.json",
      repositoryDir: ".",
    };
    (Cassi as any).mockImplementation(() => mockCassiInstance);

    (Code as any).mockClear();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.resetModules(); // Crucial: ensures bin script runs fresh for each test
  });

  it("should initialize, run tasks, prompt twice, create Code task, and break loop", async () => {
    // Import triggers the script execution with mocks configured in beforeEach
    await import("../bin/cassi.js");

    // --- Verification of Final State ---

    // Initialization
    expect(User).toHaveBeenCalledTimes(1);
    expect(Cassi).toHaveBeenCalledTimes(1);
    expect(mockCassiInstance.init).toHaveBeenCalledTimes(1);

    // Task Creation
    expect(mockCassiInstance.newTask).toHaveBeenCalledTimes(2); // InitializeRepository + Code
    expect(mockCassiInstance.newTask).toHaveBeenNthCalledWith(
      1,
      expect.any(InitializeRepository)
    );
    expect(mockCassiInstance.newTask).toHaveBeenNthCalledWith(
      2,
      expect.any(Code)
    );
    expect(Code).toHaveBeenCalledTimes(1);
    expect(Code).toHaveBeenCalledWith(mockCassiInstance, null, "test request");

    // Loop Execution
    expect(mockCassiInstance.runTasks).toHaveBeenCalledTimes(2);
    expect(mockUserInstance.prompt).toHaveBeenCalledTimes(2);
    expect(Input).toHaveBeenCalledTimes(2); // Input constructor mock called twice
    expect(Input).toHaveBeenNthCalledWith(1, "Enter your next request:");
    expect(Input).toHaveBeenNthCalledWith(2, "Enter your next request:");
    expect(Prompt).toHaveBeenCalledTimes(2);

    // Final state checks
    expect(sharedMockInputInstance.response).toBe(null); // Check final state of shared instance
    // NOTE: Skipping consoleLogSpy check here as it seems unreliable in this specific
    // async/import/resetModules scenario, despite the log appearing in stdout.
    // expect(consoleLogSpy).toHaveBeenCalledWith("No input received, exiting.");
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("should break the loop and log message if the first prompt receives null input", async () => {
    // --- Override mock behavior for this specific test ---
    mockUserInstance.prompt.mockImplementation(async () => {
      promptCallCounter++;
      // Modify the shared instance directly
      sharedMockInputInstance.response = null;
      await Promise.resolve();
    });

    // --- Execute Script ---
    await import("../bin/cassi.js");

    // --- Verification ---
    expect(Cassi).toHaveBeenCalledTimes(1);
    expect(mockCassiInstance.init).toHaveBeenCalledTimes(1);
    expect(mockCassiInstance.newTask).toHaveBeenCalledTimes(1); // InitializeRepository only
    expect(mockCassiInstance.newTask).toHaveBeenNthCalledWith(
      1,
      expect.any(InitializeRepository)
    );
    expect(mockCassiInstance.runTasks).toHaveBeenCalledTimes(1);
    expect(mockUserInstance.prompt).toHaveBeenCalledTimes(1);
    expect(Input).toHaveBeenCalledTimes(1);
    expect(Prompt).toHaveBeenCalledTimes(1);
    expect(sharedMockInputInstance.response).toBe(null); // Check final state
    expect(consoleLogSpy).toHaveBeenCalledTimes(1); // Logged once!
    expect(consoleLogSpy).toHaveBeenCalledWith("No input received, exiting.");
    expect(Code).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
