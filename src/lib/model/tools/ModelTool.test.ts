import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"; // Added beforeEach
import { ModelTool } from "./ModelTool.js";
import { Model, ModelConstructor } from "../Model.js"; // Import Model and ModelConstructor
import { Models, GenerateModelOptions } from "../Models.js";
import { ToolDefinition } from "../../tool/Tool.js";
import { Task } from "../../task/Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import { genkit } from "genkit"; // Import genkit to mock it

// --- Mocks ---

// Mock the genkit module
vi.mock("genkit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("genkit")>();
  return {
    ...actual, // Keep other exports like GenkitError
    genkit: vi.fn(() => ({
      // Mock the genkit function
      // Provide a mock AI object structure if needed by Models/subclasses
      ai: {
        generate: vi.fn(async (options: GenerateModelOptions) => {
          // Basic mock generate functionality
          return {
            text: () => `mock ai response for ${options.prompt}`,
            usage: () => ({ totalTokens: 10 }), // Mock usage if needed
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
// No longer need mockPluginObject

// --- Mock Model Implementation (extends Models) ---
class MockModelInstance extends Models {
  // Renamed for clarity
  public name: string = "mock-model-instance"; // Updated name

  constructor(task: Task) {
    // Remove plugin from constructor args
    // Pass a dummy object for plugin, as genkit is mocked and Models requires a value
    super({}, task);
  }

  // Override generate to use the mocked ai object if necessary,
  // or rely on the base class if its logic works with the mocked genkit.
  // For simplicity, let's assume the base class might need adjustment or
  // we just provide a simple mock response here directly.
  async generate(options: GenerateModelOptions): Promise<string> {
    // If Models.generate uses this.ai.generate(), the mock above handles it.
    // If not, provide a direct mock response:
    return `mock model instance response for ${options.prompt}`;
  }
}

// --- Mock Model Factory (extends Model) ---
class MockModelFactory extends Model {
  // Mock newInstance to return our specific mock instance
  newInstance(modelClassName: string, task: Task): Models {
    if (modelClassName === "MockModelInstance") {
      // No need to pass plugin object anymore
      return new MockModelInstance(task);
    }
    throw new Error(`MockModelFactory cannot create ${modelClassName}`);
  }
  // Mock init to populate availableModels for the test
  async init(): Promise<void> {
    this.availableModels.set(
      "MockModelInstance",
      MockModelInstance as unknown as ModelConstructor
    );
    // console.log("MockModelFactory init completed."); // Optional logging
  }
}

// --- Updated ConcreteModelTool ---
class ConcreteModelTool extends ModelTool {
  static toolDefinition: ToolDefinition = {
    name: "concreteTestTool", // Renamed for clarity
    description: "A concrete test tool",
    parameters: {
      type: "object",
      properties: {
        param1: { type: "string", description: "Test parameter 1" },
      },
      required: ["param1"],
    },
  };

  // Signature matches base class: accepts Model factory
  static toolMethod = vi.fn(async (modelFactory: Model, param1: string) => {
    // Assume mockTask is accessible in this scope for newInstance
    // Use the factory to get a specific model instance
    const modelInstance = modelFactory.newInstance(
      "MockModelInstance",
      mockTask
    );
    // Now use the instance's name
    const modelName = (modelInstance as MockModelInstance).name;
    return `Called with model ${modelName} and param1: ${param1}`;
  });
}

// Define mockTask outside describe block if needed inside toolMethod mock
const mockCassi = new MockCassi() as Cassi;
const mockTask = new MockTask(mockCassi);

describe("ModelTool", () => {
  // Instantiate the mock Model factory
  const mockModelFactoryInstance = new MockModelFactory();

  // Initialize the mock factory before tests run
  beforeAll(async () => {
    await mockModelFactoryInstance.init();
  });

  // Reset mocks before each test if needed
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-initialize genkit mock if state needs resetting
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
    // Pass the mock Model factory instance
    const toolArgs = ConcreteModelTool.modelToolArgs(mockModelFactoryInstance);

    expect(toolArgs).toBeInstanceOf(Array);
    expect(toolArgs).toHaveLength(1);

    const toolArgObject = toolArgs[0];
    expect(toolArgObject).toHaveProperty("toolDefinition");
    expect(toolArgObject.toolDefinition).toEqual(
      ConcreteModelTool.toolDefinition
    );
    expect(toolArgObject).toHaveProperty("toolMethod");
    expect(typeof toolArgObject.toolMethod).toBe("function");

    const testParam = "hello world";
    // The returned toolMethod is called with args *excluding* the model factory
    const result = await toolArgObject.toolMethod(testParam);

    expect(ConcreteModelTool.toolMethod).toHaveBeenCalledTimes(1);
    // toolMethod is called with the factory instance and the param
    expect(ConcreteModelTool.toolMethod).toHaveBeenCalledWith(
      mockModelFactoryInstance,
      testParam
    );

    // The result depends on the logic inside the mocked toolMethod
    // It should now use the name from the instance created *inside* toolMethod
    expect(result).toBe(
      `Called with model mock-model-instance and param1: ${testParam}` // Updated expected name
    );
  });

  it("should throw error if toolMethod is not implemented by subclass", async () => {
    class IncompleteModelTool extends ModelTool {
      static toolDefinition: ToolDefinition = {
        name: "incomplete",
        description: "",
        parameters: { type: "object", properties: {} },
      };
      // No static toolMethod implementation
    }
    // Pass the mock Model factory instance
    const toolArgs = IncompleteModelTool.modelToolArgs(
      mockModelFactoryInstance
    );
    // The base toolMethod throws, so calling the wrapped one should reject
    await expect(toolArgs[0].toolMethod()).rejects.toThrow(
      "toolMethod must be implemented by subclasses"
    );
  });
});
