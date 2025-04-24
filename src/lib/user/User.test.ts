import { User } from "./User.js";
import { Prompt } from "../prompt/Prompt.js"; // Import Prompt

import { describe, beforeEach, test, expect, vi } from "vitest";

describe("User", () => {
  let user: User;

  beforeEach(() => {
    user = new User();
  });

  test("init should call initFn and be an async function", async () => {
    const customInitFn = vi.fn(async () => {});
    user = new User(customInitFn);
    await expect(user.init()).resolves.toBeUndefined();
    expect(customInitFn).toHaveBeenCalled();
  });

  test("initFn should be an async function and callable", async () => {
    const customInitFn = vi.fn(async () => {});
    user = new User(customInitFn);
    await user.initFn();
    expect(customInitFn).toHaveBeenCalled();
  });

  test("promptFn should be an async function and callable", async () => {
    const customPromptFn = vi.fn(async () => {});
    user = new User(async () => {}, customPromptFn);
    // Create a mock Prompt object - its structure doesn't matter for this test
    const mockPrompt = {} as Prompt;
    await user.promptFn(mockPrompt); // Pass the mock prompt
    expect(customPromptFn).toHaveBeenCalledWith(mockPrompt); // Check if called with the mock
  });

  test("prompt should call promptFn with the provided prompt", async () => {
    const customPromptFn = vi.fn(async () => {});
    user = new User(async () => {}, customPromptFn);
    // Create a valid Prompt instance for the test
    const mockPrompt = new Prompt([]);
    await expect(user.prompt(mockPrompt)).resolves.toBeUndefined();
    expect(customPromptFn).toHaveBeenCalledWith(mockPrompt);
  });
});
