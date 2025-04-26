import { describe, it, expect, vi, beforeEach } from "vitest";
import { Tester } from "./Tester.js";
import { Task } from "../../task/Task.js";
import { ModelReference } from "genkit/model";
import { ExecuteCommand } from "../tools/ExecuteCommand.js";
import { ReadFile } from "../tools/ReadFile.js";
import { WriteFile } from "../tools/WriteFile.js";
import { ReplaceInFile } from "../tools/ReplaceInFile.js";
import { RunBuild } from "../tools/RunBuild.js";
import { ListFiles } from "../tools/ListFiles.js";
import { RunTestFile } from "../tools/RunTestFile.js";
import { RunTestAll } from "../tools/RunTestAll.js";

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

describe("Tester", () => {
  let mockTask: Task;
  let mockPlugin: any;

  beforeEach(() => {
    mockTask = new Task({} as any);
    mockPlugin = {};
  });

  it("should instantiate correctly", () => {
    const tester = new Tester(mockPlugin, mockTask);
    expect(tester).toBeInstanceOf(Tester);
  });

  it("should initialize the correct tools", () => {
    const tester = new Tester(mockPlugin, mockTask);
    expect(tester.tools).toHaveLength(8);
    expect(
      tester.tools.some((tool) => tool[0].name === "EXECUTE_COMMAND")
    ).toBe(true);
    expect(tester.tools.some((tool) => tool[0].name === "READ_FILE")).toBe(
      true
    );
    expect(tester.tools.some((tool) => tool[0].name === "WRITE_FILE")).toBe(
      true
    );
    expect(
      tester.tools.some((tool) => tool[0].name === "REPLACE_IN_FILE")
    ).toBe(true);
    expect(tester.tools.some((tool) => tool[0].name === "RUN_BUILD")).toBe(
      true
    );
    expect(tester.tools.some((tool) => tool[0].name === "LIST_FILES")).toBe(
      true
    );
    expect(tester.tools.some((tool) => tool[0].name === "RUN_TEST_FILE")).toBe(
      true
    );
    expect(tester.tools.some((tool) => tool[0].name === "RUN_TEST_ALL")).toBe(
      true
    );
  });

  it("should call generateWithTools in generate method", async () => {
    const tester = new Tester(mockPlugin, mockTask);
    const generateWithToolsSpy = vi.spyOn(tester, "generateWithTools");

    const mockModelRef = {} as ModelReference<any>;
    const options = {
      model: mockModelRef,
      prompt: "test-prompt",
      messages: [],
    };

    await tester.generate(options);

    expect(generateWithToolsSpy).toHaveBeenCalled();
    expect(generateWithToolsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        model: options.model,
        prompt: expect.any(String), // Check if prompt is any string
        tools: tester.tools,
        returnToolRequests: true,
        messages: options.messages,
      })
    );
  });
});
