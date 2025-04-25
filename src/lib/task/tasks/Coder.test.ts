import { describe, it, expect, vi, beforeEach } from "vitest";
import { Coder } from "./Coder.js";
import { Cassi } from "../../cassi/Cassi.js";
import { Task } from "../Task.js";
import { User } from "../../user/User.js";
import { gemini15Flash } from "@genkit-ai/googleai";

vi.mock("../../cassi/Cassi");
vi.mock("../../user/User");
vi.mock("../Task");

describe("Coder Task", () => {
  const MockTask = vi.mocked(Task, true);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with the correct prompt", () => {
    const mockUser = new User() as User;
    const mockConfigFile = "mock-config.json";
    const mockRepoDir = "/mock/repo/dir";
    const mockCassi = new Cassi(mockUser, mockConfigFile, mockRepoDir) as Cassi;
    const mockParentTask = null;
    const testPrompt = "Test prompt for Coder task";

    const coderTask = new Coder(mockCassi, mockParentTask, testPrompt);

    expect(coderTask).toBeInstanceOf(Coder);
    expect(coderTask.prompt).toBe(testPrompt);
    expect(coderTask).toBeInstanceOf(Task);
    expect(MockTask).toHaveBeenCalledTimes(1);
    expect(MockTask).toHaveBeenCalledWith(mockCassi, mockParentTask);
  });

  it("should have an initTask method", async () => {
    const mockUser = new User() as User;
    const mockConfigFile = "mock-config.json";
    const mockRepoDir = "/mock/repo/dir";
    const mockCassi = new Cassi(mockUser, mockConfigFile, mockRepoDir) as Cassi;
    const mockParentTask = null;
    const testPrompt = "Another test prompt";
    const coderTask = new Coder(mockCassi, mockParentTask, testPrompt);

    const mockGenerate = vi.fn().mockResolvedValue("mock generated code");
    const mockCoderModelInstance = {
      generate: mockGenerate,
    };
    coderTask.newModel = vi.fn().mockReturnValue(mockCoderModelInstance);

    expect(coderTask.initTask).toBeDefined();

    await expect(coderTask.initTask()).resolves.toBeUndefined();

    expect(coderTask.newModel).toHaveBeenCalledWith("Coder");

    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: gemini15Flash,
        prompt: testPrompt,
      })
    );
  });
});
