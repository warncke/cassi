import { describe, it, expect } from "vitest";
import { CLIPromptHandler } from "./CLIPromptHandler.js";
import { Prompt } from "../prompt/Prompt.js";

describe("CLIPromptHandler", () => {
  it("should create an instance with a Prompt object", () => {
    // Create a mock Prompt object
    const mockPrompt: Prompt = {
      // Add any required properties or methods if needed for the test
    } as Prompt;

    const handler = new CLIPromptHandler(mockPrompt);
    expect(handler).toBeInstanceOf(CLIPromptHandler);
  });
});
