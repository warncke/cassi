import { Cassi } from "./Cassi.js";
import { User } from "../user/User.js";
import { Task } from "../task/Task.js";
import { Tasks } from "../task/Tasks.js";
import { Model } from "../model/Model.js";
import { describe, expect, test, beforeEach, vi } from "vitest";

// Mock the Task class itself for testing newTask
class MockTask extends Task {
  constructor(cassi: Cassi, parentTask?: Task | undefined) {
    super(cassi, parentTask);
  }
  async run(): Promise<void> {}
}

describe("Cassi", () => {
  let cassi: Cassi;
  let user: User;

  beforeEach(() => {
    user = new User();
    cassi = new Cassi(user, "config.json", "/repo/dir");
  });

  test("should create an instance with user, configFile and repositoryDir", () => {
    expect(cassi).toBeTruthy();
    expect(cassi.user).toBe(user);
    expect(cassi.config.configFile).toBe("config.json");
    expect(cassi.repository.repositoryDir).toBe("/repo/dir");
    expect(cassi.model).toBeInstanceOf(Model);
    expect(cassi.task).toBeInstanceOf(Tasks);
  });

  test("should call init on user, config, tool, model, and repository", async () => {
    const modelInitMock = vi.fn().mockResolvedValue(undefined);
    const userInitMock = vi.fn().mockResolvedValue(undefined);
    const repoInitMock = vi.fn().mockResolvedValue(undefined);
    const configInitMock = vi.fn().mockResolvedValue(undefined);
    const toolInitMock = vi.fn().mockResolvedValue(undefined);
    const tasksInitMock = vi.fn().mockResolvedValue(undefined);

    cassi.model.init = modelInitMock;
    cassi.user.init = userInitMock;
    cassi.repository.init = repoInitMock;
    cassi.config.init = configInitMock;
    cassi.tool.init = toolInitMock;
    cassi.task.init = tasksInitMock;

    await cassi.init();

    expect(userInitMock).toHaveBeenCalledTimes(1);
    expect(configInitMock).toHaveBeenCalledTimes(1);
    expect(toolInitMock).toHaveBeenCalledTimes(1);
    expect(modelInitMock).toHaveBeenCalledTimes(1);
    expect(repoInitMock).toHaveBeenCalledTimes(1);
    expect(tasksInitMock).toHaveBeenCalledTimes(1);
  });

  test("newTask should add a task to the tasks array", async () => {
    // Mock the Tasks.newTask method to return a specific mock task instance
    const mockTaskInstance = new MockTask(cassi);
    vi.spyOn(cassi.task, "newTask").mockReturnValue(mockTaskInstance);

    const returnedTask = cassi.newTask("MockTask");

    expect(cassi.task.newTask).toHaveBeenCalledWith("MockTask", undefined);
    expect(cassi.tasks).toHaveLength(1);
    expect(cassi.tasks[0]).toBe(mockTaskInstance);
    expect(returnedTask).toBe(mockTaskInstance);
  });

  describe("runTasks", () => {
    beforeEach(() => {
      // Ensure tasks array is clear before each test in this block
      cassi.tasks = [];
      // Mock newTask to return controllable mock tasks
      vi.spyOn(cassi.task, "newTask").mockImplementation(
        () => new MockTask(cassi)
      );
    });

    test("should run tasks that have not started", async () => {
      const task1 = cassi.newTask("MockTask1");
      const task2 = cassi.newTask("MockTask2");
      const runSpy1 = vi.spyOn(task1, "run").mockResolvedValue();
      const runSpy2 = vi.spyOn(task2, "run").mockResolvedValue();

      await cassi.runTasks();

      expect(runSpy1).toHaveBeenCalledTimes(1);
      expect(runSpy2).toHaveBeenCalledTimes(1);

      runSpy1.mockRestore();
      runSpy2.mockRestore();
    });

    test("should not run tasks that have already started", async () => {
      const task1 = cassi.newTask("MockTask1");
      const task2 = cassi.newTask("MockTask2");
      task2.startedAt = new Date(); // Mark task2 as started

      const runSpy1 = vi.spyOn(task1, "run").mockResolvedValue();
      const runSpy2 = vi.spyOn(task2, "run").mockResolvedValue();

      await cassi.runTasks();

      expect(runSpy1).toHaveBeenCalledTimes(1);
      expect(runSpy2).not.toHaveBeenCalled();

      runSpy1.mockRestore();
      runSpy2.mockRestore();
    });

    test("should log an error if a task fails but continue with others", async () => {
      const task1 = cassi.newTask("MockTask1");
      const task2 = cassi.newTask("MockTask2");
      const task3 = cassi.newTask("MockTask3");
      const error = new Error("Task failed");

      const runSpy1 = vi.spyOn(task1, "run").mockResolvedValue();
      const runSpy2 = vi.spyOn(task2, "run").mockImplementation(async () => {
        task2.startedAt = new Date();
        task2.error = error;
        task2.finishedAt = new Date();
      });
      const runSpy3 = vi.spyOn(task3, "run").mockResolvedValue();
      const errorLogSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {}); // Spy on console.error but ignore calls

      await cassi.runTasks();

      expect(runSpy1).toHaveBeenCalledTimes(1);
      expect(runSpy2).toHaveBeenCalledTimes(1);
      expect(runSpy3).toHaveBeenCalledTimes(1);
      expect(errorLogSpy).toHaveBeenCalledWith(
        "[Cassi] Task Failed with Error:",
        JSON.stringify({ message: error.message, stack: error.stack })
      );

      runSpy1.mockRestore();
      runSpy2.mockRestore();
      runSpy3.mockRestore();
      errorLogSpy.mockRestore();
    });
  });
});
