import { describe, it, expect, vi, beforeEach } from "vitest";
import { Coder } from "./Coder.js";
import { Task } from "../../task/Task.js";
import { ModelReference } from "genkit/model";
import { ExecuteCommand } from "../tools/ExecuteCommand.js";
import { ReadFile } from "../tools/ReadFile.js";
import { WriteFile } from "../tools/WriteFile.js";
import { ReplaceInFile } from "../tools/ReplaceInFile.js";
import { RunBuild } from "../tools/RunBuild.js";
import { ListFiles } from "../tools/ListFiles.js";

vi.mock("../../task/Task.js");
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

  beforeEach(() => {
    mockTask = new Task({} as any);
    mockPlugin = {};
  });

  it("should instantiate correctly", () => {
    const coder = new Coder(mockPlugin, mockTask);
    expect(coder).toBeInstanceOf(Coder);
  });

  it("should initialize the correct tools", () => {
    const coder = new Coder(mockPlugin, mockTask);
    expect(coder.tools).toHaveLength(6);
    expect(coder.tools.some((tool) => tool[0].name === "EXECUTE_COMMAND")).toBe(
      true
    );
    expect(coder.tools.some((tool) => tool[0].name === "READ_FILE")).toBe(true);
    expect(coder.tools.some((tool) => tool[0].name === "WRITE_FILE")).toBe(
      true
    );
    expect(coder.tools.some((tool) => tool[0].name === "REPLACE_IN_FILE")).toBe(
      true
    );
    expect(coder.tools.some((tool) => tool[0].name === "RUN_BUILD")).toBe(true);
    expect(coder.tools.some((tool) => tool[0].name === "LIST_FILES")).toBe(
      true
    );
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
