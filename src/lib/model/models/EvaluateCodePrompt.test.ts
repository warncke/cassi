/// <reference types="vitest/globals" />
/// <reference types="vitest/globals" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EvaluateCodePrompt } from "./EvaluateCodePrompt.js";
import { type ModelReference, z } from "genkit"; // Keep type imports
import { GenerateModelOptions } from "../Models.js"; // Import GenerateModelOptions

// Use vi.hoisted for the mock function
const { mockAIGenerate } = vi.hoisted(() => {
  return {
    mockAIGenerate: vi.fn().mockResolvedValue({
      // Mock the AI response structure to return an object with a 'text' property
      text: "mocked response text",
      // Include toJSON for potential debugging/logging in the source if needed
      toJSON: () => ({ text: "mocked response text" }),
    }),
  };
});

// Mock the genkit library
// Removed duplicated lines here
vi.mock("genkit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("genkit")>();
  return {
    ...actual, // Spread all actual exports, including 'z' and ModelReference type
    // Mock the genkit function to return an object with our mock generate
    genkit: vi.fn().mockReturnValue({
      generate: mockAIGenerate,
    }),
  };
});

// Define the schema locally in the test file to match the one in the source
// This ensures the test doesn't break if the source schema changes unexpectedly
// and makes the test assertion clearer.
const EvaluateCodePromptSchema = z.object({
  summary: z.string(),
  modifiesFiles: z.boolean(),
  steps: z.array(z.string()),
});

// Mock plugin and model - Use the imported type
const mockPlugin = { name: "mock-plugin" } as any;
const mockModel = { name: "mock-model" } as ModelReference<any>; // Type assertion is fine

describe("EvaluateCodePrompt", () => {
  // Reset mocks before each test
  beforeEach(async () => {
    // Make beforeEach async
    vi.clearAllMocks();
    mockAIGenerate.mockClear(); // Clear the generate mock specifically

    // Re-configure the mock genkit return value
    // We need to ensure the object returned by genkit() has the generate property
    const { genkit } = await import("genkit");
    vi.mocked(genkit).mockReturnValue({
      generate: mockAIGenerate,
      // Add other properties expected by the Models constructor if necessary,
      // but for now, just providing 'generate' might be enough as it's what's used.
    } as any); // Use 'as any' for simplicity if the full type is complex to mock
  });

  it("should call the ai.generate method with the correct options and return text", async () => {
    const promptInstance = new EvaluateCodePrompt(mockPlugin); // Pass only plugin
    const promptText = "Test prompt";
    const generateOptions: GenerateModelOptions = {
      model: mockModel, // Pass the mock model reference
      prompt: promptText,
    };
    const expectedResponseText = "mocked response text"; // Expecting string

    // Call the generate method with the options object
    const responseText = await promptInstance.generate(generateOptions);

    // Construct the expected prompt string for assertion
    const expectedPromptString = `
OUTPUT the following JSON object, substituting in the results of model queries for properties. use the following CONTEXT when generating text for JSON properties:

FILE TREE:

TASK DESCRIPTION:

${promptText}

The JSON object to OUTPUT is:
{
    "summary": "(( INSERT a 3-5 word summary of the TASK DESCRIPTION that is as short as possible. do not include an punctuation.))",
    "modifiesFiles" (( INSERT boolean true if the TASK DESCRIPTION involves creating or modifying files or false if it does not)),
    "steps": [
          "(( BREAK down the TASK DESCRIPTION into steps and insert a step string for each step in the task. do not include tasks for writing tests or committing changes.))"
     ]
}            
`;

    // Check if the mockAIGenerate function (inside the mocked ai object) was called correctly
    expect(mockAIGenerate).toHaveBeenCalledTimes(1);
    // Use expect.objectContaining for the output part to avoid strict schema reference check
    expect(mockAIGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: mockModel,
        prompt: expectedPromptString,
        output: expect.objectContaining({
          // Ensure output is an object
          schema: expect.any(Object), // Ensure output has a schema property which is an object
        }),
      })
    );

    // Assert the method returned the expected text string
    expect(responseText).toBe(expectedResponseText);
  });

  it("should throw an error if the prompt in options is not a string", async () => {
    const promptInstance = new EvaluateCodePrompt(mockPlugin);
    const generateOptions: GenerateModelOptions = {
      model: mockModel,
      prompt: ["not", "a", "string"], // Invalid prompt type
    };

    await expect(promptInstance.generate(generateOptions)).rejects.toThrow(
      "EvaluateCodePrompt requires a string prompt."
    );
    expect(mockAIGenerate).not.toHaveBeenCalled();
  });
});
