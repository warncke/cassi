import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExecuteCommand } from "./ExecuteCommand.js";
import { Models, GenerateModelOptions } from "../Models.js";
import { Task } from "../../task/Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import { genkit } from "genkit";

// --- Mocks ---
vi.mock("genkit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("genkit")>();
  return {
    ...actual,
    genkit: vi.fn(() => ({
      ai: {
        generate: vi.fn(async (options: GenerateModelOptions) => ({
          text: () => `mock ai response for ${options.prompt}`,
          usage: () => ({ totalTokens: 10 }),
        })),
      },
    })),
  };
});

class MockCassi {}
class MockTask extends Task {
  public tools: any; // Declare the tools property

  constructor(cassi: Cassi) {
    super(cassi);
    // Mock the console tool if needed by the actual toolMethod implementation
    this.tools = {
      console: {
        execute: vi.fn(async (command: string) => {
          return { stdout: `mock output for ${command}`, stderr: "" };
        }),
      },
    } as any; // Cast to any to simplify mocking structure
  }
}

class MockCoderModel extends Models {
  constructor(task: Task) {
    super({}, task); // Pass dummy plugin, real task
  }
  async generate(options: GenerateModelOptions): Promise<string> {
    return `mock coder response for ${options.prompt}`;
  }
}

const mockCassi = new MockCassi() as Cassi;
const mockTask = new MockTask(mockCassi);
const mockModelInstance = new MockCoderModel(mockTask);

describe("ExecuteCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset genkit mock if needed
    (genkit as any).mockImplementation(() => ({
      ai: {
        generate: vi.fn(async (options: GenerateModelOptions) => ({
          text: () => `mock ai response for ${options.prompt}`,
          usage: () => ({ totalTokens: 10 }),
        })),
      },
    }));
    // Reset console execute mock if toolMethod calls it
    if (mockTask.tools?.console?.execute) {
      vi.mocked(mockTask.tools.console.execute).mockClear();
    }
  });

  it("should have correct toolDefinition", () => {
    expect(ExecuteCommand.toolDefinition).toBeDefined();
    expect(ExecuteCommand.toolDefinition.name).toBe("execute_command");
    expect(ExecuteCommand.toolDefinition.description).toBeDefined();
    expect(ExecuteCommand.toolDefinition.parameters).toBeDefined();
    expect(ExecuteCommand.toolDefinition.parameters.properties).toHaveProperty(
      "command"
    );
    expect(ExecuteCommand.toolDefinition.parameters.properties).toHaveProperty(
      "requires_approval"
    );
    expect(ExecuteCommand.toolDefinition.parameters.required).toEqual([
      "command",
      "requires_approval",
    ]);
  });

  it("modelToolArgs should return correct structure", () => {
    const toolArgs = ExecuteCommand.modelToolArgs(mockModelInstance);
    expect(toolArgs).toBeInstanceOf(Array);
    expect(toolArgs).toHaveLength(2); // Expect tuple of length 2
    const toolDefinition = toolArgs[0];
    const toolMethod = toolArgs[1];
    expect(toolDefinition).toEqual(ExecuteCommand.toolDefinition);
    expect(typeof toolMethod).toBe("function");
  });

  it("toolMethod should return simulated output (placeholder)", async () => {
    const input = { command: "ls -l", requires_approval: false };
    // Spy on the static toolMethod before getting the wrapped one
    const toolMethodSpy = vi.spyOn(ExecuteCommand, "toolMethod");

    const toolArgs = ExecuteCommand.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1]; // Get method from index 1
    const result = await toolMethod(input); // Call the method

    expect(toolMethodSpy).toHaveBeenCalledTimes(1);
    expect(toolMethodSpy).toHaveBeenCalledWith(mockModelInstance, input);
    expect(result).toBe(`Simulated output for command: ${input.command}`);

    // TODO: When actual implementation is added, update test:
    // expect(mockTask.tools.console.execute).toHaveBeenCalledWith(input.command, { requiresApproval: input.requires_approval });
    // expect(result).toBe(`mock output for ${input.command}`);

    toolMethodSpy.mockRestore(); // Clean up spy
  });
});
