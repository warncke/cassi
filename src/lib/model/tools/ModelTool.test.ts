import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { ModelTool } from "./ModelTool.js";
import { z } from "zod";
import { Model, ModelConstructor } from "../Model.js";
import { Models, GenerateModelOptions } from "../Models.js";
import { ToolDefinition } from "../../tool/Tool.js";
import { Task } from "../../task/Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import { genkit } from "genkit";

vi.mock("genkit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("genkit")>();
  return {
    ...actual,
    genkit: vi.fn(() => ({
      ai: {
        generate: vi.fn(async (options: GenerateModelOptions) => {
          return {
            text: () => `mock ai response for ${options.prompt}`,
            usage: () => ({ totalTokens: 10 }),
          };
        }),
      },
    })),
  };
});

class MockCassi {}
class MockTask extends Task {
  constructor(cassi: Cassi) {
    super(cassi);
  }
}

class MockModelInstance extends Models {
  public name: string = "mock-model-instance";

  constructor(task: Task) {
    super({}, task);
  }

  async generate(options: GenerateModelOptions): Promise<string> {
    return `mock model instance response for ${options.prompt}`;
  }
}

class MockModelFactory extends Model {
  newInstance(modelClassName: string, task: Task): Models {
    if (modelClassName === "MockModelInstance") {
      return new MockModelInstance(task);
    }
    throw new Error(`MockModelFactory cannot create ${modelClassName}`);
  }
  async init(): Promise<void> {
    this.availableModels.set(
      "MockModelInstance",
      MockModelInstance as unknown as ModelConstructor
    );
  }
}

class ConcreteModelTool extends ModelTool {
  static toolDefinition: ToolDefinition = {
    name: "concreteTestTool",
    description: "A concrete test tool",
    inputSchema: z.object({
      param1: z.string().describe("Test parameter 1"),
    }),
    outputSchema: z.string(),
  };

  static toolMethod = vi.fn(
    async (model: Models, input: { param1: string }) => {
      const { param1 } = input;
      const modelName = model.constructor.name;
      return `Called with model ${modelName} and param1: ${param1}`;
    }
  );
}

const mockCassi = new MockCassi() as Cassi;
const mockTask = new MockTask(mockCassi);

describe("ModelTool", () => {
  const mockModelInstance = new MockModelInstance(mockTask);

  beforeEach(() => {
    vi.clearAllMocks();
    (genkit as any).mockImplementation(() => ({
      ai: {
        generate: vi.fn(async (options: GenerateModelOptions) => ({
          text: () => `mock ai response for ${options.prompt}`,
          usage: () => ({ totalTokens: 10 }),
        })),
      },
    }));
  });

  it("modelToolArgs should return correct structure and call static toolMethod", async () => {
    const toolArgs = ConcreteModelTool.modelToolArgs(mockModelInstance);

    expect(toolArgs).toBeInstanceOf(Array);
    expect(toolArgs).toHaveLength(2);

    const toolDefinition = toolArgs[0];
    const toolMethod = toolArgs[1];

    expect(toolDefinition).toEqual(ConcreteModelTool.toolDefinition);
    expect(typeof toolMethod).toBe("function");

    const testInput = { param1: "hello world" };
    const result = await toolMethod(testInput);

    expect(ConcreteModelTool.toolMethod).toHaveBeenCalledTimes(1);
    expect(ConcreteModelTool.toolMethod).toHaveBeenCalledWith(
      mockModelInstance,
      testInput
    );

    expect(result).toBe(
      `Called with model MockModelInstance and param1: ${testInput.param1}`
    );
  });

  it("should throw error if toolMethod is not implemented by subclass", async () => {
    class IncompleteModelTool extends ModelTool {
      static toolDefinition: ToolDefinition = {
        name: "incomplete",
        description: "",
        inputSchema: z.object({}),
        outputSchema: z.any(),
      };
    }
    const toolArgs = IncompleteModelTool.modelToolArgs(mockModelInstance);
    await expect(toolArgs[1]()).rejects.toThrow(
      "toolMethod must be implemented by subclasses"
    );
  });

  it("should log tool calls and completion", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const toolArgs = ConcreteModelTool.modelToolArgs(mockModelInstance);
    const toolMethod = toolArgs[1];
    const testInput = { param1: "logging test" };

    await toolMethod(testInput);

    const expectedArgsSize = JSON.stringify(testInput).length;
    expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    expect(consoleLogSpy).toHaveBeenNthCalledWith(
      1,
      `Calling tool: ${ConcreteModelTool.toolDefinition.name}, Model: ${mockModelInstance.constructor.name}, Args count: 1, Args size: 27`
    );
    const expectedResponse = `Called with model ${mockModelInstance.constructor.name} and param1: ${testInput.param1}`;
    const expectedResponseLength = expectedResponse.length;
    expect(consoleLogSpy).toHaveBeenNthCalledWith(
      2,
      `Tool ${ConcreteModelTool.toolDefinition.name} finished. Response length: ${expectedResponseLength}`
    );

    consoleLogSpy.mockRestore();
  });
});
