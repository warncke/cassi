import { describe, it, expect, vi, beforeEach } from "vitest";
import { Coder } from "./Coder.js";
import { Task } from "../../task/Task.js";
import { ModelReference } from "genkit/model";
import { Worktree } from "../../repository/Worktree.js"; // Import Worktree type if needed for typing

// Replace the simple mock with a factory function mock for Task
vi.mock("../../task/Task.js", () => {
  const MockTask = vi.fn().mockImplementation((args) => {
    // Return a mock object that includes the necessary properties, like worktree
    // Define the mock worktree object separately for clarity
    const mockWorktree = { worktreeDir: "/fake/worktree" } as Worktree;
    return {
      ...args, // Include any args passed to constructor if needed
      // Provide the mock worktree property (might be used elsewhere)
      worktree: mockWorktree,
      // Provide the getWorkTree method as expected by Coder.generate -> getInterfaces
      getWorkTree: vi.fn().mockReturnValue(mockWorktree),
      // Add mocks for any other methods/properties of Task used by Coder if necessary
      invoke: vi.fn(),
      log: vi.fn(),
      setTaskId: vi.fn(),
      run: vi.fn(),
      config: { get: vi.fn() },
      repository: { repositoryDir: "/fake/repo" },
      user: { prompt: vi.fn() },
    };
  });
  return { Task: MockTask };
});

vi.mock("../Models.js", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    Models: class {
      plugin: any;
      task: Task;
      tools: any[] = [];
      constructor(plugin: any, task: Task) {
        this.plugin = plugin;
        this.task = task;
      }
      initializeTools(tools: any[]) {
        this.tools = tools;
      }
      async generateWithTools(options: any): Promise<void> {
        return Promise.resolve();
      }
    },
  };
});

describe("Coder", () => {
  let mockTask: Task;
  let mockPlugin: any;
  // Removed duplicate declaration of mockTask

  beforeEach(() => {
    // `new Task` now calls our mock factory, creating an instance with `worktree`
    mockTask = new Task({} as any);
    mockPlugin = {};
    // No longer need to manually assign mockTask.worktree here
  });

  it("should instantiate correctly", () => {
    const coder = new Coder(mockPlugin, mockTask);
    expect(coder).toBeInstanceOf(Coder);
  });

  it("should initialize the correct tools", () => {
    const coder = new Coder(mockPlugin, mockTask);
    expect(coder.tools).toHaveLength(6);
    expect(coder.tools.some((tool) => tool[0].name === "ExecuteCommand")).toBe(
      true
    );
    expect(coder.tools.some((tool) => tool[0].name === "ReadFile")).toBe(true);
    expect(coder.tools.some((tool) => tool[0].name === "WriteFile")).toBe(true);
    expect(coder.tools.some((tool) => tool[0].name === "ReplaceInFile")).toBe(
      true
    );
    expect(coder.tools.some((tool) => tool[0].name === "RunBuild")).toBe(true);
    expect(coder.tools.some((tool) => tool[0].name === "ListFiles")).toBe(true);
  });

  it("should call generateWithTools in generate method", async () => {
    const coder = new Coder(mockPlugin, mockTask);
    const generateWithToolsSpy = vi.spyOn(coder, "generateWithTools");

    const mockModelRef = {} as ModelReference<any>;
    const options = {
      model: mockModelRef,
      prompt: "test-prompt",
      messages: [],
    };

    await coder.generate(options);

    expect(generateWithToolsSpy).toHaveBeenCalled();
    expect(generateWithToolsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        model: options.model,
        prompt: expect.stringContaining(options.prompt),
        tools: coder.tools,
        returnToolRequests: true,
        messages: options.messages,
      })
    );
  });
});
