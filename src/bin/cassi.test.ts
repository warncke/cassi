import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { Cassi } from "../lib/cassi/Cassi.js";
import { User } from "../lib/user/User.js";
import Input from "../lib/prompt/prompts/Input.js";
import { Prompt } from "../lib/prompt/Prompt.js";
import { CLIPromptHandler } from "../lib/cli-prompt-handler/CLIPromptHandler.js";

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
// No longer need to mock specific task classes directly here
vi.mock("../lib/prompt/prompts/Input.js");
vi.mock("../lib/prompt/Prompt.js");
vi.mock("../lib/cli-prompt-handler/CLIPromptHandler.js");

describe("cassi bin script", () => {
  let mockCassiInstance: any;
  let mockUserInstance: any;
  let sharedMockInputInstance: {
    type: string;
    message: string;
    response: string | null;
  };
  let mockPromptInstance: Prompt;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let promptCallCounter = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    promptCallCounter = 0;
    consoleLogSpy = vi.spyOn(console, "log");
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    sharedMockInputInstance = { type: "input", message: "", response: null };

    (Input as any).mockImplementation((message: string) => {
      sharedMockInputInstance.message = message;
      sharedMockInputInstance.response = null;
      return sharedMockInputInstance;
    });

    (Prompt as any).mockImplementation((prompts: any[]) => {
      mockPromptInstance = { prompts: prompts };
      expect(prompts).toContain(sharedMockInputInstance);
      return mockPromptInstance;
    });

    (CLIPromptHandler as any).mockImplementation(() => ({
      handlePrompt: vi.fn(),
    }));

    mockUserInstance = {
      prompt: vi.fn().mockImplementation(async (promptSequence: Prompt) => {
        promptCallCounter++;
        if (promptCallCounter === 1) {
          sharedMockInputInstance.response = "test request";
        } else if (promptCallCounter >= 2) {
          sharedMockInputInstance.response = null;
        }
        await Promise.resolve();
      }),
    };
    (User as any).mockImplementation(() => mockUserInstance);

    mockCassiInstance = {
      init: vi.fn().mockResolvedValue(undefined),
      // Mock newTask to return an object with a mock setRequest if needed
      newTask: vi.fn().mockImplementation((taskName: string) => {
        if (taskName === "Code") {
          return { setRequest: vi.fn() };
        }
        return {}; // Return empty object for other tasks like InitializeRepository
      }),
      runTasks: vi.fn().mockResolvedValue(undefined),
      user: mockUserInstance,
      configFile: "cassi.json",
      repositoryDir: ".",
    };
    (Cassi as any).mockImplementation(() => mockCassiInstance);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.resetModules();
  });

  it("should initialize, run tasks, prompt twice, create Code task, and break loop", async () => {
    await import("../bin/cassi.js");

    expect(User).toHaveBeenCalledTimes(1);
    expect(Cassi).toHaveBeenCalledTimes(1);
    expect(mockCassiInstance.init).toHaveBeenCalledTimes(1);

    expect(mockCassiInstance.newTask).toHaveBeenCalledTimes(2);
    expect(mockCassiInstance.newTask).toHaveBeenNthCalledWith(
      1,
      "InitializeRepository"
    );
    expect(mockCassiInstance.newTask).toHaveBeenNthCalledWith(2, "Code");

    // Check if the setRequest method on the mocked Code task was called
    const mockCodeTask = mockCassiInstance.newTask.mock.results[1].value;
    expect(mockCodeTask.setRequest).toHaveBeenCalledWith("test request");

    expect(mockCassiInstance.runTasks).toHaveBeenCalledTimes(2);
    expect(mockUserInstance.prompt).toHaveBeenCalledTimes(2);
    expect(Input).toHaveBeenCalledTimes(2);
    expect(Input).toHaveBeenNthCalledWith(1, "Enter your next request:");
    expect(Input).toHaveBeenNthCalledWith(2, "Enter your next request:");
    expect(Prompt).toHaveBeenCalledTimes(2);

    expect(sharedMockInputInstance.response).toBe(null);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("should break the loop and log message if the first prompt receives null input", async () => {
    mockUserInstance.prompt.mockImplementation(async () => {
      promptCallCounter++;
      sharedMockInputInstance.response = null;
      await Promise.resolve();
    });

    await import("../bin/cassi.js");

    expect(Cassi).toHaveBeenCalledTimes(1);
    expect(mockCassiInstance.init).toHaveBeenCalledTimes(1);
    expect(mockCassiInstance.newTask).toHaveBeenCalledTimes(1);
    expect(mockCassiInstance.newTask).toHaveBeenNthCalledWith(
      1,
      "InitializeRepository"
    );
    expect(mockCassiInstance.runTasks).toHaveBeenCalledTimes(1);
    expect(mockUserInstance.prompt).toHaveBeenCalledTimes(1);
    expect(Input).toHaveBeenCalledTimes(1);
    expect(Prompt).toHaveBeenCalledTimes(1);
    expect(sharedMockInputInstance.response).toBe(null);
    expect(consoleLogSpy).toHaveBeenCalledTimes(1); // cassi starting + No input...
    expect(consoleLogSpy).toHaveBeenCalledWith("No input received, exiting.");
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
