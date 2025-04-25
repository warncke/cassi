import { describe, it, expect, vi, beforeEach } from "vitest";
import { CLIPromptHandler } from "./CLIPromptHandler.js";
import { Prompt } from "../prompt/Prompt.js";
import Input from "../prompt/prompts/Input.js";
import Confirm from "../prompt/prompts/Confirm.js";
import * as readline from "node:readline/promises";

vi.mock("node:readline/promises");

describe("CLIPromptHandler", () => {
  let mockQuestion: ReturnType<typeof vi.fn>;
  let mockClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockQuestion = vi.fn();
    mockClose = vi.fn();
    vi.mocked(readline.createInterface).mockReturnValue({
      question: mockQuestion,
      close: mockClose,
    } as any);
  });

  it("should create an instance with a Prompt object containing prompts", () => {
    const mockInput = new Input("Enter your name:");
    const mockConfirm = new Confirm("Are you sure?");

    const mockPromptSequence = new Prompt([mockInput, mockConfirm]);

    const handler = new CLIPromptHandler(mockPromptSequence);
    expect(handler).toBeInstanceOf(CLIPromptHandler);
    expect(vi.mocked(readline.createInterface)).not.toHaveBeenCalled();
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
      .mockResolvedValueOnce("Cline")
      .mockResolvedValueOnce("y");

    await handler.handlePrompt();

    expect(mockQuestion).toHaveBeenCalledTimes(2);
    expect(mockQuestion).toHaveBeenNthCalledWith(1, "Enter name: ");
    expect(mockQuestion).toHaveBeenNthCalledWith(2, "Are you sure? (y/N) ");
    expect(mockInput.response).toBe("Cline");
    expect(mockConfirm.response).toBe(true);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("should handle unknown prompt types gracefully", async () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    const unknownPrompt = { type: "unknown", message: "Unknown prompt" } as any;
    const mockPromptSequence = new Prompt([unknownPrompt]);
    const handler = new CLIPromptHandler(mockPromptSequence);

    await handler.handlePrompt();

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Unknown prompt type encountered: unknown"
    );
    expect(mockQuestion).not.toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalledTimes(1);

    consoleWarnSpy.mockRestore();
  });
});
