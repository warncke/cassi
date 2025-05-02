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

  it("should create an instance with a Prompts object", () => {
    const mockInput = new Input("Enter your name:");
    const handler = new CLIPromptHandler(mockInput);
    expect(handler).toBeInstanceOf(CLIPromptHandler);
    expect(vi.mocked(readline.createInterface)).not.toHaveBeenCalled();
  });

  it("should handle an 'input' prompt", async () => {
    const mockInput = new Input("Enter value:");
    const handler = new CLIPromptHandler(mockInput);

    mockQuestion.mockResolvedValueOnce("test input");

    await handler.handlePrompt();

    expect(mockQuestion).toHaveBeenCalledWith("Enter value: ");
    expect(mockInput.response).toBe("test input");
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("should handle a 'confirm' prompt with 'y' response", async () => {
    const mockConfirm = new Confirm("Proceed?");
    const handler = new CLIPromptHandler(mockConfirm);

    mockQuestion.mockResolvedValueOnce("y");

    await handler.handlePrompt();

    expect(mockQuestion).toHaveBeenCalledWith("Proceed? (y/N) ");
    expect(mockConfirm.response).toBe(true);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("should handle a 'confirm' prompt with 'yes' response", async () => {
    const mockConfirm = new Confirm("Proceed?");
    const handler = new CLIPromptHandler(mockConfirm);

    mockQuestion.mockResolvedValueOnce("yes");

    await handler.handlePrompt();

    expect(mockQuestion).toHaveBeenCalledWith("Proceed? (y/N) ");
    expect(mockConfirm.response).toBe(true);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("should handle a 'confirm' prompt with 'N' response", async () => {
    const mockConfirm = new Confirm("Proceed?");
    const handler = new CLIPromptHandler(mockConfirm);

    mockQuestion.mockResolvedValueOnce("N");

    await handler.handlePrompt();

    expect(mockQuestion).toHaveBeenCalledWith("Proceed? (y/N) ");
    expect(mockConfirm.response).toBe(false);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("should handle a 'confirm' prompt with non-yes response", async () => {
    const mockConfirm = new Confirm("Proceed?");
    const handler = new CLIPromptHandler(mockConfirm);

    mockQuestion.mockResolvedValueOnce("maybe");

    await handler.handlePrompt();

    expect(mockQuestion).toHaveBeenCalledWith("Proceed? (y/N) ");
    expect(mockConfirm.response).toBe(false);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("should handle a sequence of prompts (needs review)", async () => {
    const mockInput = new Input("Enter name:");
    const mockConfirm = new Confirm("Are you sure?");
    const handler = new CLIPromptHandler(mockInput);

    mockQuestion.mockResolvedValueOnce("Cline");

    await handler.handlePrompt();

    expect(mockQuestion).toHaveBeenCalledTimes(1);
    expect(mockQuestion).toHaveBeenNthCalledWith(1, "Enter name: ");
    expect(mockInput.response).toBe("Cline");
    expect(mockClose).toHaveBeenCalledTimes(1);

  });

  it("should handle unknown prompt types gracefully", async () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    const unknownPrompt = { type: "unknown", message: "Unknown prompt" } as any;
    const handler = new CLIPromptHandler(unknownPrompt);

    await handler.handlePrompt();

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Unknown prompt type encountered: Object"
    );
    expect(mockQuestion).not.toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalledTimes(1);

    consoleWarnSpy.mockRestore();
  });
});
