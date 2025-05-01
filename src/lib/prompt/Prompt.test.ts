import { describe, it, expect } from "vitest";
import { Prompt } from "./Prompt.js";
import Input from "./prompts/Input.js";
import Confirm from "./prompts/Confirm.js";

describe("Prompt", () => {
  it("Input should extend Prompt", () => {
    const input = new Input("Test message");
    expect(input).toBeInstanceOf(Prompt);
    expect(input).toBeInstanceOf(Input);
  });

  it("Confirm should extend Prompt", () => {
    const confirm = new Confirm("Test message");
    expect(confirm).toBeInstanceOf(Prompt);
    expect(confirm).toBeInstanceOf(Confirm);
  });
});
