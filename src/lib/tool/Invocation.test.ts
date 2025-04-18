import { describe, it, expect } from "vitest";
import { Invocation } from "./Invocation.js"; // Assuming .js extension based on Tool.ts

describe("Invocation", () => {
  it("should correctly store toolName, toolImplementationName, and method", () => {
    const toolName = "fs";
    const toolImplementationName = "Local";
    const method = "readFile";

    const invocation = new Invocation(toolName, toolImplementationName, method);

    expect(invocation.toolName).toBe(toolName);
    expect(invocation.toolImplementationName).toBe(toolImplementationName);
    expect(invocation.method).toBe(method);
    expect(invocation.startTime).toBeTypeOf("number");
    // Check if startTime is close to the current time, allowing for a small delay
    expect(invocation.startTime).toBeGreaterThanOrEqual(Date.now() - 1000); // Within the last second
    expect(invocation.startTime).toBeLessThanOrEqual(Date.now());
  });
});
