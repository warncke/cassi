import { Cassi } from "./Cassi.js";
import { User } from "../user/User.js";
import { describe, expect, test, beforeEach, vi } from "vitest";

describe("Cassi", () => {
  let cassi: Cassi;
  let user: User;

  beforeEach(() => {
    user = new User();
    cassi = new Cassi(user, "config.json", "/repo/dir");
  });

  test("should create an instance with user, configFile and repositoryDir", () => {
    expect(cassi).toBeTruthy();
    expect(cassi.user).toBe(user);
    expect(cassi.config.configFile).toBe("config.json");
    expect(cassi.repository.repositoryDir).toBe("/repo/dir");
  });

  test("should call init on user, config and repository", async () => {
    const userInitSpy = vi
      .spyOn(cassi.user, "init")
      .mockImplementation(async () => {});
    const repoInitSpy = vi
      .spyOn(cassi.repository, "init")
      .mockImplementation(async () => {});
    const configInitSpy = vi
      .spyOn(cassi.config, "init")
      .mockImplementation(async () => {});
    await cassi.init();
    expect(userInitSpy).toHaveBeenCalled();
    expect(repoInitSpy).toHaveBeenCalled();
    expect(configInitSpy).toHaveBeenCalled();
    userInitSpy.mockRestore();
    repoInitSpy.mockRestore();
    configInitSpy.mockRestore();
  });
});
