import { User } from "./User.js";

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
    await user.promptFn();
    expect(customPromptFn).toHaveBeenCalled();
  });
});
