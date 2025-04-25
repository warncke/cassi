import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EvaluateCodePrompt } from "./EvaluateCodePrompt.js";
import { Models, GenerateModelOptions } from "../Models.js";
import { Task } from "../../task/Task.js";
import { genkit } from "genkit";
import { z } from "zod";

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

describe("EvaluateCodePrompt Model", () => {
  let mockTask: Task;
  let evaluateInstance: EvaluateCodePrompt;

  beforeEach(() => {
    vi.resetAllMocks();
    mockGenerate.mockClear();
    (genkit as ReturnType<typeof vi.fn>).mockClear();

    mockTask = new (Task as any)("mock-eval-task") as Task;

    evaluateInstance = new EvaluateCodePrompt({}, mockTask);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should extend the Models base class", () => {
    expect(evaluateInstance).toBeInstanceOf(Models);
  });

  it("should call the base class constructor and initialize 'ai' via mocked genkit", () => {
    expect(genkit).toHaveBeenCalledTimes(1);
    expect(evaluateInstance).toHaveProperty("ai");
    expect((evaluateInstance as any).ai).toBe(mockAiObject);
    expect((evaluateInstance as any).ai.generate).toBe(mockGenerate);
  });

  it("should throw an error if the prompt is not a string", async () => {
    const options: GenerateModelOptions = {
      model: "mockModelRef" as any,
      prompt: ["this", "is", "not", "a", "string"],
    };
    await expect(evaluateInstance.generate(options)).rejects.toThrow(
      "EvaluateCodePrompt requires a string prompt."
    );
  });

  it("should call ai.generate with correct parameters", async () => {
    const mockResponse = { text: "{...}", usage: { totalTokens: 20 } };
    mockGenerate.mockResolvedValue(mockResponse);

    const options: GenerateModelOptions = {
      model: "test-model" as any,
      prompt: "Analyze this code.",
    };
    const { model, prompt, ...restOptions } = options;

    await evaluateInstance.generate(options);

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    const generateCallArgs = mockGenerate.mock.calls[0][0];

    expect(generateCallArgs.model).toBe(model);
    expect(generateCallArgs.prompt).toContain(prompt);
    expect(generateCallArgs.prompt).toContain(
      "OUTPUT the following JSON object"
    );
    expect(generateCallArgs.output).toBeDefined();
    expect(generateCallArgs.output.schema).toBeDefined();
    for (const key in restOptions) {
      expect(generateCallArgs[key]).toEqual(
        restOptions[key as keyof typeof restOptions]
      );
    }
  });

  it("should return the text content from the ai.generate response", async () => {
    const expectedText =
      '{"summary": "refactor code", "modifiesFiles": true, "steps": ["step 1", "step 2"]}';
    const mockResponse = { text: expectedText, usage: { totalTokens: 15 } };
    mockGenerate.mockResolvedValue(mockResponse);

    const options: GenerateModelOptions = {
      model: "mockModelRef" as any,
      prompt: "Refactor the code.",
    };

    const result = await evaluateInstance.generate(options);
    expect(result).toBe(expectedText);
  });

  it("should return an empty string if ai.generate response has no text", async () => {
    const mockResponse = { usage: { totalTokens: 10 } };
    mockGenerate.mockResolvedValue(mockResponse);

    const options: GenerateModelOptions = {
      model: "mockModelRef" as any,
      prompt: "Generate empty",
    };

    const result = await evaluateInstance.generate(options);
    expect(result).toBe("");
  });
});
