import { describe, it, expect, vi, beforeEach } from "vitest";
import { Tester } from "./Tester.js";
import { Cassi } from "../../cassi/Cassi.js";
import { Task } from "../Task.js";
import { User } from "../../user/User.js";
import { gemini25ProPreview0325 } from "@genkit-ai/googleai";

vi.mock("../../cassi/Cassi");
vi.mock("../../user/User");
vi.mock("../Task");

describe("Tester Task", () => {
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
    const testPrompt = "Test prompt for Tester task";

    const testerTask = new Tester(mockCassi, mockParentTask, testPrompt);

    expect(testerTask).toBeInstanceOf(Tester);
    expect(testerTask.prompt).toBe(testPrompt);
    expect(testerTask).toBeInstanceOf(Task);
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
    const testerTask = new Tester(mockCassi, mockParentTask, testPrompt);

    const mockGenerate = vi.fn().mockResolvedValue("mock generated test code");
    const mockTesterModelInstance = {
      generate: mockGenerate,
    };
    testerTask.newModel = vi.fn().mockReturnValue(mockTesterModelInstance);

    expect(testerTask.initTask).toBeDefined();

    await expect(testerTask.initTask()).resolves.toBeUndefined();

    expect(testerTask.newModel).toHaveBeenCalledWith("Tester");

    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: gemini25ProPreview0325,
        prompt: testPrompt,
      })
    );
  });
});
