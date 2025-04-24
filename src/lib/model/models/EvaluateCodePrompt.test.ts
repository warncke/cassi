/// <reference types="vitest/globals" />
/// <reference types="vitest/globals" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EvaluateCodePrompt } from "./EvaluateCodePrompt.js";
// Import ModelReference as a type ONLY to avoid runtime issues with mocking
import { type ModelReference } from "genkit";

// Define the mock generate function globally
const mockGenerate = vi
  .fn()
  .mockResolvedValue({ text: () => "mocked response" });

// Mock the genkit library, providing a basic mock for the 'genkit' export
vi.mock("genkit", () => ({
  genkit: vi.fn(), // Simple mock function for genkit itself
  // ModelReference is only used as a type, so no runtime mock needed here
}));

// Mock plugin and model - Use the imported type
const mockPlugin = { name: "mock-plugin" } as any;
const mockModel = { name: "mock-model" } as ModelReference<any>; // Type assertion is fine

describe("EvaluateCodePrompt", () => {
  // Reset and configure mocks before each test
  beforeEach(async () => {
    // Clear all previous mock states and calls
    vi.clearAllMocks();
    mockGenerate.mockClear(); // Clear the generate mock specifically

    // Dynamically import the mocked genkit module
    const { genkit } = await import("genkit");

    // Configure the mocked genkit function's return value for this test run
    (genkit as ReturnType<typeof vi.fn>).mockReturnValue({
      generate: mockGenerate,
    });
  });

  it("should call the generate method with the correct model and prompt", async () => {
    // No need to import genkit again here, beforeEach handles it
    const promptInstance = new EvaluateCodePrompt(mockPlugin, mockModel);
    const promptText = "Test prompt";
    const response = await promptInstance.generate(promptText);

    // Construct the expected prompt using the template literal
    const expectedPrompt = `
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

    // Check if the globally defined mockGenerate function was called correctly
    expect(mockGenerate).toHaveBeenCalledWith({
      model: mockModel,
      prompt: expectedPrompt, // Use the constructed template literal
    });
    expect(response).toBe("mocked response");
  });
});
