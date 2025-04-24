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

    // Check if the globally defined mockGenerate function was called correctly
    expect(mockGenerate).toHaveBeenCalledWith({
      model: mockModel,
      prompt: promptText,
    });
    expect(response).toBe("mocked response");
  });
});
