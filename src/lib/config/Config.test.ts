import { Config } from "./Config.js";
import { User } from "../user/User.js";

import { describe, expect, test, beforeEach } from "vitest";

describe("Config", () => {
  let config: Config;
  let user: User;

  beforeEach(() => {
    user = new User();
    config = new Config("cassi.json", user);
  });

  test("should create an instance of Config", () => {
    expect(config).toBeInstanceOf(Config);
  });
});
