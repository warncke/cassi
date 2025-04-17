import { Config } from "./Config.js";

import { describe, expect, test, beforeEach } from "vitest";

describe("Config", () => {
  let config: Config;

  beforeEach(() => {
    config = new Config();
  });

  test("should create an instance of Config", () => {
    expect(config).toBeInstanceOf(Config);
  });
});
