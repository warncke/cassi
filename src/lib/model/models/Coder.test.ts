import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Coder } from "./Coder.js";
import { Models, GenerateModelOptions } from "../Models.js"; // Import base and options
import { Task } from "../../task/Task.js";
// Assuming ToolDefinition might be needed, adjust import if necessary
// import { ToolDefinition } from '@genkit-ai/ai';
import { genkit } from "genkit";
// No longer need to import defineTool or z directly if we trust the implementation call
// import { defineTool } from "@genkit-ai/ai";
// import { z } from "zod";
import { ExecuteCommand } from "../tools/ExecuteCommand.js"; // Import the actual tool

// --- Mocks ---
// Mock the Task class
vi.mock("../../task/Task.js");

// Spy on the static method - declare the spy variable here and cast to any to bypass type error
let modelToolArgsSpy: any; // Use any type here

// Define the mocks for the AI methods
const mockGenerate = vi.fn();
const mockDefineTool = vi.fn((toolDefinition, toolMethod) => {
  // This mock will capture the calls made to this.ai.defineTool
  // Return a simple object representing the defined tool for verification purposes
  return {
    name: toolDefinition?.name,
    description: toolDefinition?.description,
    handler: toolMethod, // Store the passed method
  };
});

// Mock the object returned by genkit()
const mockAiObject = {
  generate: mockGenerate,
  defineTool: mockDefineTool,
};

// Mock the genkit function to return our mock AI object
vi.mock("genkit", () => ({
  genkit: vi.fn(() => mockAiObject),
}));

// No need to mock @genkit-ai/ai separately anymore

// --- Test Suite ---
describe("Coder Model", () => {
  let mockTask: Task;
  let coderInstance: Coder;
  const mockToolDefinition = {
    name: "mockDef",
    description: "mockDesc",
    parameters: {},
  };
  const mockToolMethod = vi.fn(); // Mock method separate from definition

  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
    mockGenerate.mockClear();
    mockDefineTool.mockClear();
    (genkit as ReturnType<typeof vi.fn>).mockClear();

    // Create the spy and set its return value *before* creating the Coder instance
    modelToolArgsSpy = vi.spyOn(ExecuteCommand, "modelToolArgs");
    modelToolArgsSpy.mockReturnValue([mockToolDefinition, mockToolMethod]);

    // Create a mock Task instance
    mockTask = new (Task as any)("mock-coder-task") as Task;

    // Create a new instance of Coder, passing a dummy plugin object and mock task
    coderInstance = new Coder({}, mockTask);
  });

  afterEach(() => {
    // Restore mocks after each test
    vi.restoreAllMocks();
  });

  it("should extend the Models base class", () => {
    expect(coderInstance).toBeInstanceOf(Models);
  });

  it("should call the base class constructor and initialize 'ai' via mocked genkit", () => {
    expect(genkit).toHaveBeenCalledTimes(1);
    expect(coderInstance).toHaveProperty("ai");
    expect((coderInstance as any).ai).toBe(mockAiObject);
    expect((coderInstance as any).ai.generate).toBe(mockGenerate);
    expect((coderInstance as any).ai.defineTool).toBe(mockDefineTool);
  });

  it("should call ExecuteCommand.modelToolArgs and pass its result spread into ai.defineTool", () => {
    // Verify modelToolArgs was called once with the coderInstance
    expect(modelToolArgsSpy).toHaveBeenCalledTimes(1); // Check the spy
    expect(modelToolArgsSpy).toHaveBeenCalledWith(coderInstance);

    // Verify defineTool was called once
    expect(mockDefineTool).toHaveBeenCalledTimes(1);

    // Verify defineTool was called with the *spread* arguments from modelToolArgs
    expect(mockDefineTool).toHaveBeenCalledWith(
      mockToolDefinition, // The mock definition from the spy's return value
      mockToolMethod // The mock method from the spy's return value
    );

    // Verify the tool was added to the instance's tools array
    // (based on the mock return value of defineTool)
    expect(coderInstance.tools).toBeDefined();
    expect(Array.isArray(coderInstance.tools)).toBe(true);
    expect(coderInstance.tools.length).toBe(1);
    expect(coderInstance.tools[0].name).toBe(mockToolDefinition.name); // Check name matches mock definition
    expect(coderInstance.tools[0].handler).toBe(mockToolMethod); // Check handler matches mock method
  });

  it("should call ai.generate with correct parameters in generate method", async () => {
    const mockResponse = { text: "Generated code", usage: { totalTokens: 10 } };
    mockGenerate.mockResolvedValue(mockResponse);

    const options: GenerateModelOptions = {
      model: "mockModelRef" as any,
      prompt: "Write a function",
    };
    const { model, prompt, ...restOptions } = options;

    await coderInstance.generate(options);

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerate).toHaveBeenCalledWith({
      model: model,
      prompt: expect.stringContaining(prompt as string),
      tools: coderInstance.tools,
      ...restOptions,
    });
  });

  it("should return the text content from the ai.generate response", async () => {
    const expectedText = "This is the generated code.";
    const mockResponse = { text: expectedText, usage: { totalTokens: 5 } };
    mockGenerate.mockResolvedValue(mockResponse);

    const options: GenerateModelOptions = {
      model: "mockModelRef" as any,
      prompt: "Generate something",
    };

    const result = await coderInstance.generate(options);
    expect(result).toBe(expectedText);
  });

  it("should log usage information if present in the response", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const mockUsage = { inputTokens: 5, outputTokens: 10, totalTokens: 15 };
    const mockResponse = { text: "Some text", usage: mockUsage };
    mockGenerate.mockResolvedValue(mockResponse);

    const options: GenerateModelOptions = {
      model: "mockModelRef" as any,
      prompt: "Generate with usage",
    };

    await coderInstance.generate(options);
    expect(consoleLogSpy).toHaveBeenCalledWith("AI Usage:", mockUsage);
    consoleLogSpy.mockRestore();
  });

  it("should return an empty string and warn if ai.generate response has no text", async () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    const mockResponse = { usage: { totalTokens: 2 } };
    mockGenerate.mockResolvedValue(mockResponse);

    const options: GenerateModelOptions = {
      model: "mockModelRef" as any,
      prompt: "Generate nothing",
    };

    const result = await coderInstance.generate(options);
    expect(result).toBe("");
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "AI response did not contain text content."
    );
    consoleWarnSpy.mockRestore();
  });

  it("should execute the placeholder logic in the execute_command tool handler", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(mockDefineTool).toHaveBeenCalled(); // Ensure defineTool was called

    // Extract the handler (toolMethod) correctly from the second argument of defineTool's call
    const toolHandler = mockDefineTool.mock.calls[0][1];
    expect(toolHandler).toBe(mockToolMethod); // Ensure it's the mocked function returned by the spy

    const input = { command: "ls -l", requires_approval: false };

    // Call the handler (which is now our mockToolMethod)
    await toolHandler(input); // Result is not needed for this check

    // Verify our mockToolMethod was called
    expect(mockToolMethod).toHaveBeenCalledWith(input);

    // Check if the handler stored in the instance is the mocked one
    expect(coderInstance.tools[0].handler).toBe(mockToolMethod);

    // Restore console spy if it was used for other checks (not needed here anymore)
    consoleLogSpy.mockRestore();
  });
});
