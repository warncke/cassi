import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import path from "path";
import { pathToFileURL } from "url";
import { Tasks } from "./Tasks.js";
import { Task } from "./Task.js";
import fs from "fs/promises";
import type { Cassi } from "../cassi/Cassi.js";

class MockTask extends Task {
  async run() {}
}
class AnotherMockTask extends Task {
  async run() {}
}
class NotATask {}
class MockTaskTest extends Task {
  async run() {}
}
class MockTaskWithArgs extends Task {
  public arg1: any;
  public arg2: any;
  constructor(cassi: Cassi, parentTask: Task | null, arg1: any, arg2: any) {
    super(cassi, parentTask);
    this.arg1 = arg1;
    this.arg2 = arg2;
  }
  async run() {}
}

const mockCassi = { name: "MockCassi" } as unknown as Cassi; // Add a property for easier identification

describe("Tasks", () => {
  let tasks: Tasks;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let readdirSpy: Mock;

  beforeEach(() => {
    tasks = new Tasks(mockCassi);
    vi.resetAllMocks();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    readdirSpy = vi.spyOn(fs, "readdir") as Mock;
  });

  it("should store the cassi instance passed in the constructor", () => {
    expect(tasks.cassi).toBe(mockCassi);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    readdirSpy.mockRestore();
  });

  describe("init", () => {
    it("should initialize availableTasks by reading the tasks directory", async () => {
      const mockFiles = [
        "MockTask.ts",
        "AnotherMockTask.ts",
        "NotATask.ts",
        "MockTaskTest.ts",
        "helper.js",
        "MockTask.test.ts",
      ];
      readdirSpy.mockResolvedValue(mockFiles);

      const defaultTasksDir = path.join(__dirname, "tasks");
      const mockTaskPath = path.join(defaultTasksDir, "MockTask.ts");
      const anotherMockTaskPath = path.join(
        defaultTasksDir,
        "AnotherMockTask.ts"
      );
      const notATaskPath = path.join(defaultTasksDir, "NotATask.ts");
      const mockTaskTestPath = path.join(defaultTasksDir, "MockTaskTest.ts");

      vi.doMock(mockTaskPath, () => ({ MockTask }));
      vi.doMock(anotherMockTaskPath, () => ({ AnotherMockTask }));
      vi.doMock(notATaskPath, () => ({ NotATask }));
      vi.doMock(mockTaskTestPath, () => ({ MockTaskTest }));

      await tasks.init();

      expect(readdirSpy).toHaveBeenCalledWith(defaultTasksDir);
      expect(tasks.availableTasks.size).toBe(2);
      expect(tasks.availableTasks.get("MockTask")).toBe(MockTask);
      expect(tasks.availableTasks.get("AnotherMockTask")).toBe(AnotherMockTask);
      expect(tasks.availableTasks.has("NotATask")).toBe(false);
      expect(tasks.availableTasks.has("MockTaskTest")).toBe(false);

      vi.doUnmock(mockTaskPath);
      vi.doUnmock(anotherMockTaskPath);
      vi.doUnmock(notATaskPath);
      vi.doUnmock(mockTaskTestPath);
    });

    it("should clear existing tasks before initialization", async () => {
      tasks.availableTasks.set("OldTask", MockTask);
      readdirSpy.mockResolvedValue([]);
      await tasks.init();
      expect(tasks.availableTasks.size).toBe(0);
    });

    it("should handle errors when importing task files", async () => {
      const mockFiles = ["ErrorTask.ts"];
      readdirSpy.mockResolvedValue(mockFiles);
      const defaultTasksDir = path.join(__dirname, "tasks");
      const errorTaskPath = path.join(defaultTasksDir, "ErrorTask.ts");
      const importError = new Error("Failed to import");

      vi.doMock(errorTaskPath, () => {
        throw importError;
      });

      await tasks.init();

      expect(tasks.availableTasks.size).toBe(0);
      const errorTaskFileURL = pathToFileURL(errorTaskPath).toString();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Error loading task from ${errorTaskFileURL}:`,
        expect.objectContaining({ cause: importError })
      );

      vi.doUnmock(errorTaskPath);
    });
  });

  describe("newTask", () => {
    beforeEach(async () => {
      tasks.availableTasks.set("MockTask", MockTask);
      tasks.availableTasks.set("MockTaskWithArgs", MockTaskWithArgs);
    });

    it("should create a new task instance if the task name exists", () => {
      const taskInstance = tasks.newTask("MockTask");
      expect(taskInstance).toBeInstanceOf(MockTask);
      expect(taskInstance.cassi).toBe(mockCassi);
      expect(taskInstance.parentTask).toBeNull();
    });

    it("should create a new task instance with a parent task", () => {
      const parent = new MockTask(mockCassi);
      const taskInstance = tasks.newTask("MockTask", parent);
      expect(taskInstance).toBeInstanceOf(MockTask);
      expect(taskInstance.cassi).toBe(mockCassi);
      expect(taskInstance.parentTask).toBe(parent);
    });

    it("should throw an error if the task name does not exist", () => {
      expect(() => tasks.newTask("NonExistentTask")).toThrow(
        'Task "NonExistentTask" not found.'
      );
    });

    it("should pass additional arguments to the task constructor", () => {
      const parent = new MockTask(mockCassi);
      const arg1 = "testArg1";
      const arg2 = { key: "value" };

      const taskInstance1 = tasks.newTask(
        "MockTaskWithArgs",
        undefined,
        arg1,
        arg2
      );
      expect(taskInstance1).toBeInstanceOf(MockTaskWithArgs);
      expect(taskInstance1.cassi).toBe(mockCassi);
      expect(taskInstance1.parentTask).toBeNull();
      expect((taskInstance1 as MockTaskWithArgs).arg1).toBe(arg1);
      expect((taskInstance1 as MockTaskWithArgs).arg2).toBe(arg2);

      const taskInstance2 = tasks.newTask(
        "MockTaskWithArgs",
        parent,
        arg1,
        arg2
      );
      expect(taskInstance2).toBeInstanceOf(MockTaskWithArgs);
      expect(taskInstance2.cassi).toBe(mockCassi);
      expect(taskInstance2.parentTask).toBe(parent);
      expect((taskInstance2 as MockTaskWithArgs).arg1).toBe(arg1);
      expect((taskInstance2 as MockTaskWithArgs).arg2).toBe(arg2);
    });
  });
});
