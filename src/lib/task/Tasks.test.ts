import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import path from "path";
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

const mockCassi = {} as Cassi;

describe("Tasks", () => {
  let tasks: Tasks;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let readdirSpy: Mock;

  beforeEach(() => {
    tasks = new Tasks();
    vi.resetAllMocks();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    readdirSpy = vi.spyOn(fs, "readdir") as Mock;
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
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Error loading task from ${errorTaskPath}:`,
        expect.objectContaining({ cause: importError })
      );

      vi.doUnmock(errorTaskPath);
    });
  });

  describe("newTask", () => {
    beforeEach(async () => {
      tasks.availableTasks.set("MockTask", MockTask);
    });

    it("should create a new task instance if the task name exists", () => {
      const taskInstance = tasks.newTask("MockTask", mockCassi);
      expect(taskInstance).toBeInstanceOf(MockTask);
      expect(taskInstance.cassi).toBe(mockCassi);
      expect(taskInstance.parentTask).toBeNull();
    });

    it("should create a new task instance with a parent task", () => {
      const parent = new MockTask(mockCassi);
      const taskInstance = tasks.newTask("MockTask", mockCassi, parent);
      expect(taskInstance).toBeInstanceOf(MockTask);
      expect(taskInstance.cassi).toBe(mockCassi);
      expect(taskInstance.parentTask).toBe(parent);
    });

    it("should throw an error if the task name does not exist", () => {
      expect(() => tasks.newTask("NonExistentTask", mockCassi)).toThrow(
        'Task "NonExistentTask" not found.'
      );
    });
  });
});
