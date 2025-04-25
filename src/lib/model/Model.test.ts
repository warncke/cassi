import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Model } from "./Model.js";
import { Models, GenerateModelOptions } from "./Models.js";
import { User } from "../user/User.js";
import { Config } from "../config/Config.js";
import { Task } from "../task/Task.js";
import fs from "fs/promises";
import path from "path";

vi.mock("../user/User.js");
vi.mock("../config/Config.js");
vi.mock("../task/Task.js");
vi.mock("fs/promises");

vi.mock("@genkit-ai/googleai", () => {
  const mockGoogleAI = vi.fn(() => () => "mockGoogleAIPlugin");
  return {
    googleAI: mockGoogleAI,
  };
});

vi.mock("path", async (importOriginal) => {
  const actualPath = await importOriginal<typeof path>();
  const mockFunctions = {
    join: vi.fn((...args: string[]) => actualPath.join(...args)),
    dirname: vi.fn((file: string) => actualPath.dirname(file)),
    sep: actualPath.sep,
    resolve: actualPath.resolve,
    basename: actualPath.basename,
    extname: actualPath.extname,
    isAbsolute: actualPath.isAbsolute,
    normalize: actualPath.normalize,
    relative: actualPath.relative,
    parse: actualPath.parse,
    format: actualPath.format,
  };
  return {
    ...mockFunctions,
    default: mockFunctions,
  };
});

class MockModel1 extends Models {
  public plugin: any;
  constructor(plugin: any, task: Task) {
    super(plugin, task);
    this.plugin = plugin;
  }
  async generate(options: GenerateModelOptions): Promise<string> {
    return `MockModel1 generated: ${
      typeof options.prompt === "string"
        ? options.prompt
        : JSON.stringify(options.prompt)
    }`;
  }
}
class MockModel2 extends Models {
  public plugin: any;
  constructor(plugin: any, task: Task) {
    super(plugin, task);
    this.plugin = plugin;
  }
  async generate(options: GenerateModelOptions): Promise<string> {
    return `MockModel2 generated: ${
      typeof options.prompt === "string"
        ? options.prompt
        : JSON.stringify(options.prompt)
    }`;
  }
}
const notAModel = { foo: "bar" };
const SomeOtherClass = class {};
const someFunction = () => {};

vi.mock("/fake/path/to/lib/model/models/MockModel1.js", () => ({ MockModel1 }));
vi.mock("/fake/path/to/lib/model/models/MockModel2.js", () => ({ MockModel2 }));
vi.mock("/fake/path/to/lib/model/models/helper.js", () => ({ notAModel }));
vi.mock("/fake/path/to/lib/model/models/FailingModel.js", () => {
  throw new Error("Failed to import");
});
vi.mock("/fake/path/to/lib/model/models/NotAModel.js", () => ({
  SomeOtherClass,
  someFunction,
}));

vi.mock("url", async (importOriginal) => {
  const actualUrl = await importOriginal<typeof import("url")>();
  return {
    ...actualUrl,
    fileURLToPath: (url: string | URL) => {
      if (typeof url === "string" && url.startsWith("file://")) {
        return url.substring(7);
      }
      return actualUrl.fileURLToPath(url);
    },
  };
});

describe("Model", () => {
  let mockUser: User;
  let mockConfig: Config;
  let mockTask: Task;

  let model: Model;

  beforeEach(() => {
    vi.resetAllMocks();

    mockUser = new User();
    mockConfig = new Config("test-config.json", mockUser);
    mockTask = new (Task as any)("mock-task-id") as Task;
    model = new Model();

    vi.mocked(path.join).mockImplementation((...args) => {
      if (args[1] === "models") {
        return "/fake/path/to/lib/model/models";
      }
      return args.join("/");
    });
    vi.mocked(path.dirname).mockReturnValue("/fake/path/to/lib/model");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });


  describe("init", () => {
    it("should initialize availableModels by reading the models directory", async () => {
      const mockFiles = [
        "MockModel1.js",
        "MockModel2.js",
        "helper.js",
        "ignore.test.js",
      ];
      vi.mocked(fs.readdir).mockResolvedValue(mockFiles as any);

      const modelInstance = new Model();

      await modelInstance.init();

      expect(fs.readdir).toHaveBeenCalledWith("/fake/path/to/lib/model/models");
      expect(modelInstance.availableModels.size).toBe(2);
      expect(modelInstance.availableModels.get("MockModel1")).toBe(
        MockModel1 as any
      );
      expect(modelInstance.availableModels.get("MockModel2")).toBe(
        MockModel2 as any
      );
    });

    it("should skip .test.js files", async () => {
      const mockFiles = ["MockModel1.js", "MockModel1.test.js"];
      vi.mocked(fs.readdir).mockResolvedValue(mockFiles as any);
      const modelInstance = new Model();

      await modelInstance.init();

      expect(modelInstance.availableModels.size).toBe(1);
      expect(modelInstance.availableModels.get("MockModel1")).toBe(
        MockModel1 as any
      );
    });

    it("should handle errors when reading the directory", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const testError = new Error("Failed to read directory");
      vi.mocked(fs.readdir).mockRejectedValue(testError);
      const modelInstance = new Model();

      await modelInstance.init();

      expect(modelInstance.availableModels.size).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error reading models directory:",
        testError
      );

      consoleErrorSpy.mockRestore();
    });

    it("should handle errors during dynamic import", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const mockFiles = ["FailingModel.js"];
      const expectedError = new Error("Failed to import");
      vi.mocked(fs.readdir).mockResolvedValue(mockFiles as any);
      const modelInstance = new Model();

      await modelInstance.init();

      expect(modelInstance.availableModels.size).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error importing model from /fake/path/to/lib/model/models/FailingModel.js:",
        expect.objectContaining({
          cause: expectedError,
        })
      );

      consoleErrorSpy.mockRestore();
    });

    it("should only add classes that extend Model", async () => {
      const mockFiles = ["MockModel1.js", "NotAModel.js"];
      vi.mocked(fs.readdir).mockResolvedValue(mockFiles as any);
      const modelInstance = new Model();

      await modelInstance.init();

      expect(modelInstance.availableModels.size).toBe(1);
      expect(modelInstance.availableModels.get("MockModel1")).toBe(
        MockModel1 as any
      );
      expect(modelInstance.availableModels.has("SomeOtherClass")).toBe(false);
    });

    it("should not re-initialize if called multiple times", async () => {
      const mockFiles = ["MockModel1.js"];
      vi.mocked(fs.readdir).mockResolvedValue(mockFiles as any);
      const consoleLogSpy = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});

      consoleLogSpy.mockClear();

      await model.init();
      await model.init();

      expect(model.availableModels.size).toBe(1);
      const initLogCalls = consoleLogSpy.mock.calls.filter(
        (call) => call[0] === "Initializing available models for instance..."
      );
      expect(initLogCalls.length).toBeLessThanOrEqual(1);

      consoleLogSpy.mockRestore();
    });
  });

  describe("newInstance", () => {
    beforeEach(async () => {
      const mockFiles = ["MockModel1.js", "MockModel2.js"];
      vi.mocked(fs.readdir).mockResolvedValue(mockFiles as any);
      await model.init();
    });

    it("should create a new instance of the specified model class", async () => {

      const newInstance = model.newInstance("MockModel1", mockTask);

      expect(newInstance).toBeInstanceOf(MockModel1);
      expect(newInstance).toBeInstanceOf(Models);
      expect(typeof (newInstance as MockModel1).plugin).toBe("function");
      expect((newInstance as any).task).toBe(mockTask);
    });


    it("should throw an error if the model class name is not found", () => {
      const modelName = "NonExistentModel";

      expect(() => model.newInstance(modelName, mockTask)).toThrow(
        `Model class '${modelName}' not found.`
      );
    });

    it("should throw an error if init() has not been called", () => {
      const freshModel = new Model();

      expect(() => freshModel.newInstance("MockModel1", mockTask)).toThrow(
        `Model class 'MockModel1' not found.`
      );
    });
  });
});
