import { User } from "./User.js";
import { Prompt } from "../prompt/Prompt.js";

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
    const mockPrompt = {} as Prompt;
    await user.promptFn(mockPrompt);
    expect(customPromptFn).toHaveBeenCalledWith(mockPrompt);
  });

  test("prompt should call promptFn with the provided prompt", async () => {
    const customPromptFn = vi.fn(async () => {});
    user = new User(async () => {}, customPromptFn);
    const mockPrompt = new Prompt([]);
    await expect(user.prompt(mockPrompt)).resolves.toBeUndefined();
    expect(customPromptFn).toHaveBeenCalledWith(mockPrompt);
  });
});
