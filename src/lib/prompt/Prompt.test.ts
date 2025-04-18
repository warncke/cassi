import { describe, it, expect } from "vitest";
import Input from "./prompts/Input.js";
import Confirm from "./prompts/Confirm.js";
import { Prompt } from "./Prompt.js";

describe("Prompt", () => {
  it("should create an instance of Prompt with Input and Confirm prompts", () => {
    const inputs = [
      new Input("Enter input message"),
      new Confirm("Confirm message"),
    ];
    const prompt = new Prompt(inputs);
    expect(prompt).toBeInstanceOf(Prompt);
    expect(prompt.prompts).toEqual(inputs);
  });
});
