import { describe, it, expect } from "vitest";
import { Invocation } from "./Invocation.js"; // Assuming .js extension based on Tool.ts

describe("Invocation", () => {
  it("should correctly store toolName, toolImplementationName, and method", () => {
    const toolName = "fs";
    const toolImplementationName = "Local";
    const method = "readFile";
    const mockToolMethod = () => {}; // Mock function
    const mockToolInstance = {}; // Mock instance
    const mockArgs = ["arg1", 2, { key: "value" }]; // Mock arguments

    const invocation = new Invocation(
      toolName,
      toolImplementationName,
      method,
      mockToolMethod,
      mockToolInstance,
      mockArgs // Pass mock args
    );

    expect(invocation.toolName).toBe(toolName);
    expect(invocation.toolImplementationName).toBe(toolImplementationName);
    expect(invocation.method).toBe(method);
    expect(invocation.toolMethod).toBe(mockToolMethod);
    expect(invocation.toolInstance).toBe(mockToolInstance);
    expect(invocation.args).toEqual(mockArgs); // Check stored args
    expect(invocation.startTime).toBeNull(); // startTime should be null initially
    expect(invocation.endTime).toBeNull(); // endTime should be null initially
    expect(invocation.error).toBeNull(); // error should be null initially
  });

  describe("invoke", () => {
    it("should execute the tool method and return the result", async () => {
      const expectedResult = "Success!";
      const mockToolMethod = async () => expectedResult;
      const invocation = new Invocation(
        "testTool",
        "TestImpl",
        "testMethod",
        mockToolMethod,
        {},
        []
      );

      const result = await invocation.invoke();

      expect(result).toBe(expectedResult);
      expect(invocation.startTime).toBeTypeOf("number");
      expect(invocation.endTime).toBeTypeOf("number");
      expect(invocation.startTime).toBeLessThanOrEqual(invocation.endTime!);
      expect(invocation.error).toBeNull();
    });

    it("should capture errors thrown by the tool method", async () => {
      const errorMessage = "Something went wrong";
      const mockToolMethod = async () => {
        throw new Error(errorMessage);
      };
      const invocation = new Invocation(
        "testTool",
        "TestImpl",
        "testMethod",
        mockToolMethod,
        {},
        []
      );

      await expect(invocation.invoke()).rejects.toThrow(errorMessage);

      expect(invocation.startTime).toBeTypeOf("number");
      expect(invocation.endTime).toBeTypeOf("number");
      expect(invocation.startTime).toBeLessThanOrEqual(invocation.endTime!);
      expect(invocation.error).toBeInstanceOf(Error);
      expect(invocation.error?.message).toBe(errorMessage);
    });

    it("should capture non-Error objects thrown by the tool method", async () => {
      const errorObject = { message: "Just an object" };
      const mockToolMethod = async () => {
        throw errorObject;
      };
      const invocation = new Invocation(
        "testTool",
        "TestImpl",
        "testMethod",
        mockToolMethod,
        {},
        []
      );

      await expect(invocation.invoke()).rejects.toEqual(errorObject); // Check if the original object is re-thrown

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
        toolName,
        "InvalidImpl",
        method,
        {} as any, // Pass an object instead of a function
        {},
        []
      );

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
