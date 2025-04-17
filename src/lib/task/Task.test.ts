import { Task } from "./Task.js";

import { describe, expect, test, beforeEach } from "vitest";

describe("Task", () => {
  let task: Task;

  beforeEach(() => {
    task = new Task();
  });

  test("should create an instance of Task", () => {
    expect(task).toBeInstanceOf(Task);
  });
});
