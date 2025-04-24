import { Cassi } from "./Cassi.js";
import { User } from "../user/User.js";
import { Task } from "../task/Task.js"; // Import Task
import { describe, expect, test, beforeEach, vi } from "vitest";

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
  });

  test("should call init on user, config and repository", async () => {
    const userInitSpy = vi
      .spyOn(cassi.user, "init")
      .mockImplementation(async () => {});
    const repoInitSpy = vi
      .spyOn(cassi.repository, "init")
      .mockImplementation(async () => {});
    const configInitSpy = vi
      .spyOn(cassi.config, "init")
      .mockImplementation(async () => {});
    await cassi.init();
    expect(userInitSpy).toHaveBeenCalled();
    expect(repoInitSpy).toHaveBeenCalled();
    expect(configInitSpy).toHaveBeenCalled();
    userInitSpy.mockRestore();
    repoInitSpy.mockRestore();
    configInitSpy.mockRestore();
  });

  test("newTask should add a task to the tasks array", () => {
    // Create a real Task instance using the cassi instance from beforeEach
    const newTask = new Task(cassi);
    cassi.newTask(newTask);
    expect(cassi.tasks).toHaveLength(1);
    expect(cassi.tasks[0]).toBe(newTask);
  });

  describe("runTasks", () => {
    test("should run tasks that have not started", async () => {
      const task1 = new Task(cassi);
      const task2 = new Task(cassi);
      const runSpy1 = vi.spyOn(task1, "run").mockResolvedValue();
      const runSpy2 = vi.spyOn(task2, "run").mockResolvedValue();

      cassi.newTask(task1);
      cassi.newTask(task2);

      await cassi.runTasks();

      expect(runSpy1).toHaveBeenCalledTimes(1);
      expect(runSpy2).toHaveBeenCalledTimes(1);

      runSpy1.mockRestore();
      runSpy2.mockRestore();
    });

    test("should not run tasks that have already started", async () => {
      const task1 = new Task(cassi);
      const task2 = new Task(cassi);
      task2.startedAt = new Date(); // Mark task2 as started

      const runSpy1 = vi.spyOn(task1, "run").mockResolvedValue();
      const runSpy2 = vi.spyOn(task2, "run").mockResolvedValue();

      cassi.newTask(task1);
      cassi.newTask(task2);

      await cassi.runTasks();

      expect(runSpy1).toHaveBeenCalledTimes(1);
      expect(runSpy2).not.toHaveBeenCalled();

      runSpy1.mockRestore();
      runSpy2.mockRestore();
    });

    test("should log an error if a task fails but continue with others", async () => {
      const task1 = new Task(cassi);
      const task2 = new Task(cassi);
      const task3 = new Task(cassi);
      const error = new Error("Task failed");

      const runSpy1 = vi.spyOn(task1, "run").mockResolvedValue();
      // Mock task2 to simulate failure by setting the error property after run
      const runSpy2 = vi.spyOn(task2, "run").mockImplementation(async () => {
        task2.startedAt = new Date(); // Mark as started
        task2.error = error; // Set error after running
        task2.finishedAt = new Date();
      });
      const runSpy3 = vi.spyOn(task3, "run").mockResolvedValue();
      const errorLogSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {}); // Suppress console output during test

      cassi.newTask(task1);
      cassi.newTask(task2);
      cassi.newTask(task3);

      await cassi.runTasks();

      expect(runSpy1).toHaveBeenCalledTimes(1);
      expect(runSpy2).toHaveBeenCalledTimes(1);
      expect(runSpy3).toHaveBeenCalledTimes(1); // Should still run task3
      expect(errorLogSpy).toHaveBeenCalledWith(
        `Task failed with error: ${error.message}`
      );

      runSpy1.mockRestore();
      runSpy2.mockRestore();
      runSpy3.mockRestore();
      errorLogSpy.mockRestore();
    });
  });
});
