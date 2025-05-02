import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EvaluateAudioCodePrompt } from "./EvaluateAudioCodePrompt.js";
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

describe("EvaluateAudioCodePrompt Model", () => {
  let mockTask: Task;
  let evaluateInstance: EvaluateAudioCodePrompt;

  beforeEach(() => {
    vi.resetAllMocks();
    mockGenerate.mockClear();
    (genkit as ReturnType<typeof vi.fn>).mockClear();

    mockTask = new (Task as any)("mock-eval-audio-task") as Task;

    evaluateInstance = new EvaluateAudioCodePrompt({}, mockTask);
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

  it("should throw an error if audioBase64 is not a string", async () => {
    const options = {
      model: "mockModelRef" as any,
      audioBase64: 12345, // Not a string
    };
    // Need to cast to any because TS knows it's wrong, but we're testing the runtime check
    await expect(evaluateInstance.generate(options as any)).rejects.toThrow(
      "EvaluateAudioCodePrompt requires a base64 audio string."
    );
  });

  it("should call ai.generate with correct parameters including audio data", async () => {
    const mockResponse = { text: "{...}", usage: { totalTokens: 20 } };
    mockGenerate.mockResolvedValue(mockResponse);

    const options = {
      model: "test-model" as any,
      audioBase64: "base64encodedaudio",
      temperature: 0.5,
    };
    const { model, audioBase64, ...restOptions } = options;

    await evaluateInstance.generate(options);

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    const generateCallArgs = mockGenerate.mock.calls[0][0];

    expect(generateCallArgs.model).toBe(model);
    expect(Array.isArray(generateCallArgs.prompt)).toBe(true);
    expect(generateCallArgs.prompt.length).toBe(3);
    expect(generateCallArgs.prompt[0].text).toContain(
      "OUTPUT the following JSON object"
    );
    expect(generateCallArgs.prompt[1].media).toBeDefined();
    expect(generateCallArgs.prompt[1].media.url).toBe(
      `data:audio/ogg;base64,${audioBase64}`
    );
    expect(generateCallArgs.prompt[2].text).toContain('"summary":');
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

    const options = {
      model: "mockModelRef" as any,
      audioBase64: "base64encodedaudio_refactor",
    };

    const result = await evaluateInstance.generate(options);
    expect(result).toBe(expectedText);
  });

  it("should return an empty string if ai.generate response has no text", async () => {
    const mockResponse = { usage: { totalTokens: 10 } };
    mockGenerate.mockResolvedValue(mockResponse);

    const options = {
      model: "mockModelRef" as any,
      audioBase64: "base64encodedaudio_empty",
    };

    const result = await evaluateInstance.generate(options);
    expect(result).toBe("");
  });
});
