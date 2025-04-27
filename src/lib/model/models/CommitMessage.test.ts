import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CommitMessage } from "./CommitMessage.js";
import { Models, GenerateModelOptions } from "../Models.js";
import { Task } from "../../task/Task.js";
import { genkit } from "genkit";

vi.mock("../../task/Task.js");

const mockGenerate = vi.fn();
const mockAiObject = {
  generate: mockGenerate,
};
vi.mock("genkit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("genkit")>();
  return {
    ...actual,
    genkit: vi.fn(() => mockAiObject),
    z: actual.z,
  };
});

describe("CommitMessage Model", () => {
  let mockTask: Task;
  let commitMessageInstance: CommitMessage;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    mockGenerate.mockClear();
    (genkit as ReturnType<typeof vi.fn>).mockClear();

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockTask = new (Task as any)("mock-commit-task") as Task;

    commitMessageInstance = new CommitMessage({}, mockTask);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("should extend the Models base class", () => {
    expect(commitMessageInstance).toBeInstanceOf(Models);
  });

  it("should call the base class constructor and initialize 'ai' via mocked genkit", () => {
    expect(genkit).toHaveBeenCalledTimes(1);
    expect(commitMessageInstance).toHaveProperty("ai");
    expect((commitMessageInstance as any).ai).toBe(mockAiObject);
    expect((commitMessageInstance as any).ai.generate).toBe(mockGenerate);
  });

  it("should throw an error if the prompt is not a string", async () => {
    const options: GenerateModelOptions = {
      model: "mockModelRef" as any,
      prompt: ["this", "is", "not", "a", "string"],
    };
    await expect(commitMessageInstance.generate(options)).rejects.toThrow(
      "CommitMessage requires a string prompt."
    );
  });

  it("should call ai.generate with correct parameters", async () => {
    const mockResponse = {
      text: "feat: add new feature",
      usage: { totalTokens: 20 },
    };
    mockGenerate.mockResolvedValue(mockResponse);

    const options: GenerateModelOptions = {
      model: "test-model" as any,
      prompt: "Add a new button.",
    };
    const { model, prompt, ...restOptions } = options;

    await commitMessageInstance.generate(options);

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    const generateCallArgs = mockGenerate.mock.calls[0][0];

    expect(generateCallArgs.model).toBe(model);
    expect(generateCallArgs.prompt).toContain(
      `<GIT_DIFF>\n${prompt}\n</GIT_DIFF>`
    );
    // <<< THIS IS THE MODIFIED LINE (removed trailing \")
    expect(generateCallArgs.prompt).toContain(
      "Create a summary git commit message with a maximum 80 character description and a maximum of 3 bullet points to describe the GIT_DIFF as succinctly as possible, highlighting key changes in the commit. Do not include any \"prefix:\" like \"feat:\" or \"bug:\" on summary. Add bullet points with \"*\" and a single space after the \"*\" before the text for the bullet point."
    );
    expect(generateCallArgs.output).toBeUndefined();
    for (const key in restOptions) {
      expect(generateCallArgs[key]).toEqual(
        restOptions[key as keyof typeof restOptions]
      );
    }
  });

  it("should return the text content from the ai.generate response", async () => {
    const expectedText = "fix: resolve login bug";
    const mockResponse = { text: expectedText, usage: { totalTokens: 15 } };
    mockGenerate.mockResolvedValue(mockResponse);

    const options: GenerateModelOptions = {
      model: "mockModelRef" as any,
      prompt: "Fix the login bug.",
    };

    const result = await commitMessageInstance.generate(options);
    expect(result).toBe(expectedText);
  });

  it("should return an empty string if ai.generate response has no text", async () => {
    const mockResponse = { usage: { totalTokens: 10 } };
    mockGenerate.mockResolvedValue(mockResponse);

    const options: GenerateModelOptions = {
      model: "mockModelRef" as any,
      prompt: "Generate empty",
    };

    const result = await commitMessageInstance.generate(options);
    expect(result).toBe("");
  });
});
