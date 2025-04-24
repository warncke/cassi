import { describe, it, expect, vi } from "vitest";
import { Invocation } from "./Invocation.js";
import { Task } from "../task/Task.js"; // Import Task
import { Cassi } from "../cassi/Cassi.js"; // Import Cassi for mocking Task

describe("Invocation", () => {
  it("should correctly store toolName, toolImplementationName, and method", () => {
    const toolName = "fs";
    const toolImplementationName = "Local";
    const method = "readFile";
    const mockToolMethod = () => {}; // Mock function
    const mockToolInstance = {}; // Mock instance
    const mockToolArgs = ["toolArg1", true]; // Mock tool constructor arguments
    const mockArgs = ["arg1", 2, { key: "value" }]; // Mock method arguments
    // Need a mock task for the constructor test as well
    const mockCassiForTask = {} as Cassi;
    const mockTaskForConstructor = new Task(mockCassiForTask);

    const invocation = new Invocation(
      mockTaskForConstructor, // Pass mock task
      toolName,
      toolImplementationName,
      method,
      mockToolMethod,
      mockToolInstance,
      mockToolArgs, // Pass mock toolArgs
      mockArgs // Pass mock args
    );

    expect(invocation.toolName).toBe(toolName);
    expect(invocation.toolImplementationName).toBe(toolImplementationName);
    expect(invocation.method).toBe(method);
    expect(invocation.toolMethod).toBe(mockToolMethod);
    expect(invocation.toolInstance).toBe(mockToolInstance);
    expect(invocation.task).toBe(mockTaskForConstructor); // Check stored task
    expect(invocation.toolArgs).toEqual(mockToolArgs); // Check stored toolArgs
    expect(invocation.args).toEqual(mockArgs); // Check stored args
    expect(invocation.startTime).toBeNull(); // startTime should be null initially
    expect(invocation.endTime).toBeNull(); // endTime should be null initially
    expect(invocation.error).toBeNull(); // error should be null initially
  });

  describe("invoke", () => {
    // Create a mock Task instance to be used in tests
    // We need a mock Cassi instance for the Task constructor
    const mockCassi = {
      // Mock necessary Cassi properties/methods if Task uses them
    } as Cassi;
    const mockTask = new Task(mockCassi); // Create a base mock task

    it("should execute the tool method with task and args, returning the result", async () => {
      const expectedResult = "Success!";
      const arg1 = "hello";
      const arg2 = 123;
      // Mock method now expects task as the first argument
      const mockToolMethod = vi.fn(async (task: Task, a: string, b: number) => {
        expect(task).toBe(mockTask); // Verify task is passed
        expect(a).toBe(arg1);
        expect(b).toBe(arg2);
        return expectedResult;
      });
      const invocation = new Invocation(
        mockTask, // Pass task to constructor
        "testTool",
        "TestImpl",
        "testMethod",
        mockToolMethod,
        {},
        [], // Add empty toolArgs
        [arg1, arg2] // Pass args to constructor
      );

      // Invoke without task argument
      const result = await invocation.invoke();

      expect(result).toBe(expectedResult);
      expect(mockToolMethod).toHaveBeenCalledWith(mockTask, arg1, arg2); // Verify call signature
      expect(invocation.startTime).toBeTypeOf("number");
      expect(invocation.endTime).toBeTypeOf("number");
      expect(invocation.startTime).toBeLessThanOrEqual(invocation.endTime!);
      expect(invocation.error).toBeNull();
    });

    it("should capture errors thrown by the tool method", async () => {
      const errorMessage = "Something went wrong";
      // Mock method expects task
      const mockToolMethod = vi.fn(async (task: Task) => {
        expect(task).toBe(mockTask);
        throw new Error(errorMessage);
      });
      const invocation = new Invocation(
        mockTask, // Pass task to constructor
        "testTool",
        "TestImpl",
        "testMethod",
        mockToolMethod,
        {},
        [], // Add empty toolArgs
        []
      );

      // Invoke without task argument
      await expect(invocation.invoke()).rejects.toThrow(errorMessage);

      expect(mockToolMethod).toHaveBeenCalledWith(mockTask); // Verify call still receives task via apply
      expect(invocation.startTime).toBeTypeOf("number");
      expect(invocation.endTime).toBeTypeOf("number");
      expect(invocation.startTime).toBeLessThanOrEqual(invocation.endTime!);
      expect(invocation.error).toBeInstanceOf(Error);
      expect(invocation.error?.message).toBe(errorMessage);
    });

    it("should capture non-Error objects thrown by the tool method", async () => {
      const errorObject = { message: "Just an object" };
      // Mock method expects task
      const mockToolMethod = vi.fn(async (task: Task) => {
        expect(task).toBe(mockTask);
        throw errorObject;
      });
      const invocation = new Invocation(
        mockTask, // Pass task to constructor
        "testTool",
        "TestImpl",
        "testMethod",
        mockToolMethod,
        {},
        [], // Add empty toolArgs
        []
      );

      // Invoke without task argument
      await expect(invocation.invoke()).rejects.toEqual(errorObject); // Check if the original object is re-thrown

      expect(mockToolMethod).toHaveBeenCalledWith(mockTask); // Verify call still receives task via apply
      expect(invocation.startTime).toBeTypeOf("number");
      expect(invocation.endTime).toBeTypeOf("number");
      expect(invocation.startTime).toBeLessThanOrEqual(invocation.endTime!);
      expect(invocation.error).toBeInstanceOf(Error); // Should be wrapped in an Error
      expect(invocation.error?.message).toBe(String(errorObject)); // Message should be string representation
    });

    it("should throw an error if toolMethod is not a function", async () => {
      const toolName = "invalidTool";
      const method = "invalidMethod";
      const invocation = new Invocation(
        mockTask, // Pass task to constructor
        toolName,
        "InvalidImpl",
        method,
        {} as any, // Pass an object instead of a function
        {},
        [], // Add empty toolArgs
        []
      );

      // Invoke without task argument
      await expect(invocation.invoke()).rejects.toThrow(
        `Invocation error: toolMethod for "${toolName}.${method}" is not a function.`
      );

      // Even though it throws early, startTime might be set just before the check
      // Depending on exact timing, startTime could be null or a number.
      // endTime and error should remain null as the main try block wasn't entered.
      // Let's check they remain null.
      expect(invocation.endTime).toBeNull();
      expect(invocation.error).toBeNull();
    });
  });
});
