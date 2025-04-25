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

  // Signature now accepts Models
  static toolMethod = vi.fn(async (model: Models, param1: string) => {
    // Change modelFactory: Model to model: Models
    // The 'model' parameter is now the Models instance itself.
    // Use the model's class name for the mock response.
    const modelName = model.constructor.name;
    return `Called with model ${modelName} and param1: ${param1}`;
  });
}

// Define mockTask outside describe block if needed inside toolMethod mock
const mockCassi = new MockCassi() as Cassi;
const mockTask = new MockTask(mockCassi);

describe("ModelTool", () => {
  // Instantiate the mock Models instance (which extends Models)
  const mockModelInstance = new MockModelInstance(mockTask); // Use MockModelInstance

  // No need to initialize a factory anymore
  // beforeAll(async () => {
  //   await mockModelFactoryInstance.init(); // Remove factory initialization
  // });

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
    // Pass the mock Models instance
    const toolArgs = ConcreteModelTool.modelToolArgs(mockModelInstance); // Pass mockModelInstance

    expect(toolArgs).toBeInstanceOf(Array);
    expect(toolArgs).toHaveLength(2); // Now returns a tuple of two elements

    const toolDefinition = toolArgs[0];
    const toolMethod = toolArgs[1];

    expect(toolDefinition).toEqual(ConcreteModelTool.toolDefinition);
    expect(typeof toolMethod).toBe("function");

    const testParam = "hello world";
    // The returned toolMethod is called with args *excluding* the model factory
    const result = await toolMethod(testParam); // Call toolMethod directly

    expect(ConcreteModelTool.toolMethod).toHaveBeenCalledTimes(1);
    // toolMethod is called with the Models instance and the param
    expect(ConcreteModelTool.toolMethod).toHaveBeenCalledWith(
      mockModelInstance, // Expect mockModelInstance
      testParam
    );

    // The result depends on the logic inside the mocked toolMethod
    // It should use the class name of the instance passed to it
    expect(result).toBe(
      `Called with model MockModelInstance and param1: ${testParam}` // Expect class name
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
    // Pass the mock Models instance
    const toolArgs = IncompleteModelTool.modelToolArgs(
      mockModelInstance // Pass mockModelInstance
    );
    // The base toolMethod throws, so calling the wrapped one should reject
    await expect(toolArgs[1]()).rejects.toThrow(
      // Access the method at index 1
      "toolMethod must be implemented by subclasses"
    );
  });
});
