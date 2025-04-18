import { describe, it, expect } from "vitest";
import Input from "./Input.js";

describe("Input", () => {
  it("should initialize with a message and default response to null", () => {
    const message = "Enter your name:";
    const input = new Input(message);

    expect(input.message).toBe(message);
    expect(input.response).toBeNull();
  });

  it("should allow setting the response property", () => {
    const input = new Input("Enter your age:");
    input.response = "25";

    expect(input.response).toBe("25");
  });
});
