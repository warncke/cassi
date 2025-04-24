import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { Cassi } from "../lib/cassi/Cassi.js";
import { User } from "../lib/user/User.js";
import { InitializeRepository } from "../lib/task/tasks/InitializeRepository.js";
import Input from "../lib/prompt/prompts/Input.js";
import { Prompt } from "../lib/prompt/Prompt.js";

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
vi.mock("../lib/prompt/prompts/Input.js");
vi.mock("../lib/prompt/Prompt.js");
vi.mock("../lib/cli-prompt-handler/CLIPromptHandler.js", () => ({
  CLIPromptHandler: vi.fn().mockImplementation(() => ({
    handlePrompt: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe("cassi bin script", () => {
  let mockCassiInstance: any;
  let mockUserInstance: any;
  let promptCallCount = 0;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    // Reset mocks and counters before each test
    vi.clearAllMocks();
    promptCallCount = 0;
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {}); // Spy and suppress output

    // Setup mock instances and methods
    mockUserInstance = {
      prompt: vi.fn().mockImplementation(async () => {
        promptCallCount++;
        if (promptCallCount > 0) {
          // Throw after the first call inside the loop simulation
          throw new Error("Simulated prompt break");
        }
      }),
    };
    (User as any).mockImplementation(() => mockUserInstance);

    mockCassiInstance = {
      init: vi.fn().mockResolvedValue(undefined),
      newTask: vi.fn().mockResolvedValue(undefined),
      runTasks: vi.fn().mockResolvedValue(undefined),
      user: mockUserInstance, // Link mock user to mock cassi
    };
    (Cassi as any).mockImplementation(() => mockCassiInstance);

    // Based on the original file, it seems run is not exported, let's adjust the approach.
    // We need to execute the script's logic. Since it's top-level, importing might trigger it.
    // Let's rethink: We need to import the file which executes `run()`.
    // The import within the 'it' block will trigger the execution.
  });

  afterEach(() => {
    // Restore console.error spy
    consoleErrorSpy.mockRestore();
  });

  // Reworking the test structure slightly as `run` is called at the top level.
  // We'll import the script and let Vitest handle the execution context with mocks.

  it("should initialize Cassi, add initial task, and enter the run/prompt loop", async () => {
    // Mock the top-level run execution by importing the module.
    // The error thrown by the mocked prompt should be caught by the script's catch block.
    await import("../bin/cassi.js");

    // Verify initialization
    expect(User).toHaveBeenCalledTimes(1);
    expect(Cassi).toHaveBeenCalledTimes(1);
    expect(mockCassiInstance.init).toHaveBeenCalledTimes(1);
    expect(mockCassiInstance.newTask).toHaveBeenCalledTimes(1);
    expect(mockCassiInstance.newTask).toHaveBeenCalledWith(
      expect.any(InitializeRepository)
    );

    // Verify loop execution (at least one iteration)
    expect(mockCassiInstance.runTasks).toHaveBeenCalledTimes(1); // Called once before prompt breaks
    expect(mockUserInstance.prompt).toHaveBeenCalledTimes(1); // Called once before throwing

    // Verify the error was caught and logged
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      new Error("Simulated prompt break")
    );

    // Verify the prompt content
    expect(Input).toHaveBeenCalledWith("Enter your next request:");
    expect(Prompt).toHaveBeenCalledWith([expect.any(Input)]);
    expect(mockUserInstance.prompt).toHaveBeenCalledWith(expect.any(Prompt));
  });
});
