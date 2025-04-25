import { describe, it, expect, vi } from "vitest";
import { Invocation } from "./Invocation.js";
import { Task } from "../task/Task.js";
import { Cassi } from "../cassi/Cassi.js";

describe("Invocation", () => {
  it("should correctly store toolName, toolImplementationName, and method", () => {
    const toolName = "fs";
    const toolImplementationName = "Local";
    const method = "readFile";
    const mockToolMethod = () => {};
    const mockToolInstance = {};
    const mockToolArgs = ["toolArg1", true];
    const mockArgs = ["arg1", 2, { key: "value" }];
    const mockCassiForTask = {} as Cassi;
    const mockTaskForConstructor = new Task(mockCassiForTask);

    const invocation = new Invocation(
      mockTaskForConstructor,
      toolName,
      toolImplementationName,
      method,
      mockToolMethod,
      mockToolInstance,
      mockToolArgs,
      mockArgs
    );

    expect(invocation.toolName).toBe(toolName);
    expect(invocation.toolImplementationName).toBe(toolImplementationName);
    expect(invocation.method).toBe(method);
    expect(invocation.toolMethod).toBe(mockToolMethod);
    expect(invocation.toolInstance).toBe(mockToolInstance);
    expect(invocation.task).toBe(mockTaskForConstructor);
    expect(invocation.toolArgs).toEqual(mockToolArgs);
    expect(invocation.methodArgs).toEqual(mockArgs);
    expect(invocation.startTime).toBeNull();
    expect(invocation.endTime).toBeNull();
    expect(invocation.error).toBeNull();
  });

  describe("invoke", () => {
    const mockCassi = {} as Cassi;
    const mockTask = new Task(mockCassi);

    it("should execute the tool method with task and args, returning the result", async () => {
      const expectedResult = "Success!";
      const arg1 = "hello";
      const arg2 = 123;
      const mockToolMethod = vi.fn(async (a: string, b: number) => {
        expect(a).toBe(arg1);
        expect(b).toBe(arg2);
        return expectedResult;
      });
      const invocation = new Invocation(
        mockTask,
        "testTool",
        "TestImpl",
        "testMethod",
        mockToolMethod,
        {},
        [],
        [arg1, arg2]
      );

      const result = await invocation.invoke();

      expect(result).toBe(expectedResult);
      expect(mockToolMethod).toHaveBeenCalledWith(arg1, arg2);
      expect(invocation.startTime).toBeTypeOf("number");
      expect(invocation.endTime).toBeTypeOf("number");
      expect(invocation.startTime).toBeLessThanOrEqual(invocation.endTime!);
      expect(invocation.error).toBeNull();
    });

    it("should capture errors thrown by the tool method", async () => {
      const errorMessage = "Something went wrong";
      const mockToolMethod = vi.fn(async () => {
        throw new Error(errorMessage);
      });
      const invocation = new Invocation(
        mockTask,
        "testTool",
        "TestImpl",
        "testMethod",
        mockToolMethod,
        {},
        [],
        []
      );

      await expect(invocation.invoke()).rejects.toThrow(errorMessage);

      expect(mockToolMethod).toHaveBeenCalledWith();
      expect(invocation.startTime).toBeTypeOf("number");
      expect(invocation.endTime).toBeTypeOf("number");
      expect(invocation.startTime).toBeLessThanOrEqual(invocation.endTime!);
      expect(invocation.error).toBeInstanceOf(Error);
      expect(invocation.error?.message).toBe(errorMessage);
    });

    it("should capture non-Error objects thrown by the tool method", async () => {
      const errorObject = { message: "Just an object" };
      const mockToolMethod = vi.fn(async () => {
        throw errorObject;
      });
      const invocation = new Invocation(
        mockTask,
        "testTool",
        "TestImpl",
        "testMethod",
        mockToolMethod,
        {},
        [],
        []
      );

      await expect(invocation.invoke()).rejects.toEqual(errorObject);

      expect(mockToolMethod).toHaveBeenCalledWith();
      expect(invocation.startTime).toBeTypeOf("number");
      expect(invocation.endTime).toBeTypeOf("number");
      expect(invocation.startTime).toBeLessThanOrEqual(invocation.endTime!);
      expect(invocation.error).toBeInstanceOf(Error);
      expect(invocation.error?.message).toBe(String(errorObject));
    });

    it("should log before and after invoking the tool method", async () => {
      const mockConsoleLog = vi.spyOn(console, "log");
      const expectedResult = "Logged!";
      const arg1 = "logArg";
      const toolName = "logTool";
      const method = "logMethod";
      const mockToolMethod = vi.fn(async () => expectedResult);
      const invocation = new Invocation(
        mockTask,
        toolName,
        "LogImpl",
        method,
        mockToolMethod,
        {},
        [],
        [arg1]
      );

      await invocation.invoke();

      expect(mockConsoleLog).toHaveBeenCalledTimes(2);
      expect(mockConsoleLog).toHaveBeenNthCalledWith(
        1,
        `[Invocation] Invoking tool ${toolName}.${method} with args:`,
        [arg1]
      );
      expect(mockConsoleLog).toHaveBeenNthCalledWith(
        2,
        `[Invocation] Tool ${toolName}.${method} returned:`,
        expectedResult
      );

      mockConsoleLog.mockRestore();
    });

    it("should throw an error if toolMethod is not a function", async () => {
      const toolName = "invalidTool";
      const method = "invalidMethod";
      const invocation = new Invocation(
        mockTask,
        toolName,
        "InvalidImpl",
        method,
        {} as any,
        {},
        [],
        []
      );

      await expect(invocation.invoke()).rejects.toThrow(
        `Invocation error: toolMethod for "${toolName}.${method}" is not a function.`
      );

      expect(invocation.endTime).toBeNull();
      expect(invocation.error).toBeNull();
    });
  });
});
