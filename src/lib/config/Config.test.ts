import { Config } from "./Config.js"; // Added .js extension
import { User } from "../user/User.js"; // Added .js extension
import { writeFile, unlink, mkdir, rmdir } from "fs/promises"; // Added mkdir and rmdir
import { join } from "path";

import { describe, expect, test, beforeEach, afterEach } from "vitest";

const testDir = "temp_test_config_dir"; // Use a temporary directory
const validConfigFile = join(testDir, "valid_config.json");
const invalidJsonFile = join(testDir, "invalid_config.json");
const nonExistentFile = join(testDir, "non_existent_config.json");

describe("Config", () => {
  let user: User;

  beforeEach(async () => {
    user = new User();
    // Create temporary directory and files for testing
    try {
      // Ensure the directory exists
      await mkdir(testDir, { recursive: true });
      await writeFile(
        validConfigFile,
        JSON.stringify({ setting: "value" }),
        "utf-8"
      );
      await writeFile(invalidJsonFile, "{ invalid json", "utf-8");
    } catch (e) {
      // Ignore errors if files already exist from previous failed runs
    }
  });

  afterEach(async () => {
    // Clean up temporary files and directory
    try {
      await unlink(validConfigFile);
    } catch (e) {
      /* ignore */
    }
    try {
      await unlink(invalidJsonFile);
    } catch (e) {
      /* ignore */
    }
    // Remove the temporary directory
    try {
      await rmdir(testDir);
    } catch (e) {
      /* ignore if not empty or doesn't exist */
    }
  });

  test("should create an instance of Config", () => {
    const config = new Config("cassi.json", user);
    expect(config).toBeInstanceOf(Config);
  });

  test("init() should read and parse a valid config file", async () => {
    const config = new Config(validConfigFile, user);
    await config.init();
    expect(config.configData).toEqual({ setting: "value" });
  });

  test("init() should throw an error if the config file does not exist", async () => {
    const config = new Config(nonExistentFile, user);
    await expect(config.init()).rejects.toThrow(
      `Error reading config file ${nonExistentFile}`
    );
  });

  test("init() should throw an error if the config file contains invalid JSON", async () => {
    const config = new Config(invalidJsonFile, user);
    await expect(config.init()).rejects.toThrow(
      `Error parsing config file ${invalidJsonFile}`
    );
  });
});
