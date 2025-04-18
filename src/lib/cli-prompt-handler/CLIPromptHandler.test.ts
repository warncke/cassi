import { describe, it, expect, vi, beforeEach } from "vitest";
import { CLIPromptHandler } from "./CLIPromptHandler.js";
import { Prompt } from "../prompt/Prompt.js"; // Import the container Prompt class
import Input from "../prompt/prompts/Input.js"; // Import specific prompt types
import Confirm from "../prompt/prompts/Confirm.js";
import * as readline from "node:readline/promises";

// Mock the readline module
vi.mock("node:readline/promises");

describe("CLIPromptHandler", () => {
  let mockQuestion: ReturnType<typeof vi.fn>;
  let mockClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks before each test
    mockQuestion = vi.fn();
    mockClose = vi.fn();
    vi.mocked(readline.createInterface).mockReturnValue({
      question: mockQuestion,
      close: mockClose,
    } as any); // Use 'as any' for simplicity or define a more specific mock type
  });

  it("should create an instance with a Prompt object containing prompts", () => {
    // Create mock individual prompts
    const mockInput = new Input("Enter your name:");
    const mockConfirm = new Confirm("Are you sure?");

    // Create the container Prompt object
    const mockPromptSequence = new Prompt([mockInput, mockConfirm]);

    // Pass the container object to the handler
    const handler = new CLIPromptHandler(mockPromptSequence);
    expect(handler).toBeInstanceOf(CLIPromptHandler);
    // Add more specific assertions if needed, e.g., checking internal state
    expect(vi.mocked(readline.createInterface)).not.toHaveBeenCalled(); // Ensure readline isn't created prematurely
  });

  it("should handle an 'input' prompt", async () => {
    const mockInput = new Input("Enter value:");
    const mockPromptSequence = new Prompt([mockInput]);
    const handler = new CLIPromptHandler(mockPromptSequence);

    mockQuestion.mockResolvedValueOnce("test input");

    await handler.handlePrompt();

    expect(mockQuestion).toHaveBeenCalledWith("Enter value: ");
    expect(mockInput.response).toBe("test input");
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("should handle a 'confirm' prompt with 'y' response", async () => {
    const mockConfirm = new Confirm("Proceed?");
    const mockPromptSequence = new Prompt([mockConfirm]);
    const handler = new CLIPromptHandler(mockPromptSequence);

    mockQuestion.mockResolvedValueOnce("y");

    await handler.handlePrompt();

    expect(mockQuestion).toHaveBeenCalledWith("Proceed? (y/N) ");
    expect(mockConfirm.response).toBe(true);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("should handle a 'confirm' prompt with 'yes' response", async () => {
    const mockConfirm = new Confirm("Proceed?");
    const mockPromptSequence = new Prompt([mockConfirm]);
    const handler = new CLIPromptHandler(mockPromptSequence);

    mockQuestion.mockResolvedValueOnce("yes");

    await handler.handlePrompt();

    expect(mockQuestion).toHaveBeenCalledWith("Proceed? (y/N) ");
    expect(mockConfirm.response).toBe(true);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("should handle a 'confirm' prompt with 'N' response", async () => {
    const mockConfirm = new Confirm("Proceed?");
    const mockPromptSequence = new Prompt([mockConfirm]);
    const handler = new CLIPromptHandler(mockPromptSequence);

    mockQuestion.mockResolvedValueOnce("N");

    await handler.handlePrompt();

    expect(mockQuestion).toHaveBeenCalledWith("Proceed? (y/N) ");
    expect(mockConfirm.response).toBe(false);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("should handle a 'confirm' prompt with non-yes response", async () => {
    const mockConfirm = new Confirm("Proceed?");
    const mockPromptSequence = new Prompt([mockConfirm]);
    const handler = new CLIPromptHandler(mockPromptSequence);

    mockQuestion.mockResolvedValueOnce("maybe");

    await handler.handlePrompt();

    expect(mockQuestion).toHaveBeenCalledWith("Proceed? (y/N) ");
    expect(mockConfirm.response).toBe(false);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("should handle a sequence of prompts", async () => {
    const mockInput = new Input("Enter name:");
    const mockConfirm = new Confirm("Are you sure?");
    const mockPromptSequence = new Prompt([mockInput, mockConfirm]);
    const handler = new CLIPromptHandler(mockPromptSequence);

    mockQuestion
      .mockResolvedValueOnce("Cline") // Answer for input
      .mockResolvedValueOnce("y"); // Answer for confirm

    await handler.handlePrompt();

    expect(mockQuestion).toHaveBeenCalledTimes(2);
    expect(mockQuestion).toHaveBeenNthCalledWith(1, "Enter name: ");
    expect(mockQuestion).toHaveBeenNthCalledWith(2, "Are you sure? (y/N) ");
    expect(mockInput.response).toBe("Cline");
    expect(mockConfirm.response).toBe(true);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("should handle unknown prompt types gracefully", async () => {
    // Mock console.warn
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    const unknownPrompt = { type: "unknown", message: "Unknown prompt" } as any;
    const mockPromptSequence = new Prompt([unknownPrompt]);
    const handler = new CLIPromptHandler(mockPromptSequence);

    await handler.handlePrompt();

    // Check if console.warn was called with the expected message
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Unknown prompt type encountered: unknown"
    );
    expect(mockQuestion).not.toHaveBeenCalled(); // readline shouldn't be used for unknown types
    expect(mockClose).toHaveBeenCalledTimes(1); // close should still be called

    // Restore console.warn
    consoleWarnSpy.mockRestore();
  });
});
