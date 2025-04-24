import { Config } from "./Config.js"; // Added .js extension
import { User } from "../user/User.js"; // Added .js extension
import { writeFile, unlink, mkdir, rmdir } from "fs/promises"; // Added mkdir and rmdir
import { join } from "path";

import { describe, expect, test, beforeEach, afterEach } from "vitest";

const testDir = "temp_test_config_dir"; // Use a temporary directory
const validConfigFileOld = join(testDir, "valid_config_old.json"); // Renamed old valid file
const invalidJsonFile = join(testDir, "invalid_config.json");
const nonExistentFile = join(testDir, "non_existent_config.json");
const validSchemaFile = join(testDir, "valid_schema_config.json");
const invalidSchemaMissingApiKeyFile = join(
  testDir,
  "invalid_schema_missing_apikey.json"
);
const invalidSchemaExtraTopLevelFile = join(
  testDir,
  "invalid_schema_extra_top.json"
);
const invalidSchemaMissingGeminiFile = join(
  testDir,
  "invalid_schema_missing_gemini.json"
);
const invalidSchemaExtraApiKeyFile = join(
  testDir,
  "invalid_schema_extra_apikey.json"
);
const invalidSchemaWrongTypeFile = join(
  testDir,
  "invalid_schema_wrong_type.json"
);

describe("Config", () => {
  let user: User;

  beforeEach(async () => {
    user = new User();
    // Create temporary directory and files for testing
    try {
      // Ensure the directory exists
      await mkdir(testDir, { recursive: true });
      // Old valid file (pre-schema)
      await writeFile(
        validConfigFileOld,
        JSON.stringify({ setting: "value" }),
        "utf-8"
      );
      // Invalid JSON file
      await writeFile(invalidJsonFile, "{ invalid json", "utf-8");
      // Valid schema file
      await writeFile(
        validSchemaFile,
        JSON.stringify({ apiKeys: { gemini: "test-key" } }),
        "utf-8"
      );
      // Invalid schema: missing apiKeys
      await writeFile(
        invalidSchemaMissingApiKeyFile,
        JSON.stringify({}),
        "utf-8"
      );
      // Invalid schema: extra top-level key
      await writeFile(
        invalidSchemaExtraTopLevelFile,
        JSON.stringify({ apiKeys: { gemini: "key" }, extra: "data" }),
        "utf-8"
      );
      // Invalid schema: missing gemini
      await writeFile(
        invalidSchemaMissingGeminiFile,
        JSON.stringify({ apiKeys: {} }),
        "utf-8"
      );
      // Invalid schema: extra key in apiKeys
      await writeFile(
        invalidSchemaExtraApiKeyFile,
        JSON.stringify({ apiKeys: { gemini: "key", other: "val" } }),
        "utf-8"
      );
      // Invalid schema: wrong type for gemini
      await writeFile(
        invalidSchemaWrongTypeFile,
        JSON.stringify({ apiKeys: { gemini: 123 } }),
        "utf-8"
      );
    } catch (e) {
      // Ignore errors if files already exist from previous failed runs
    }
  });

  afterEach(async () => {
    // Clean up temporary files and directory
    const filesToUnlink = [
      validConfigFileOld,
      invalidJsonFile,
      validSchemaFile,
      invalidSchemaMissingApiKeyFile,
      invalidSchemaExtraTopLevelFile,
      invalidSchemaMissingGeminiFile,
      invalidSchemaExtraApiKeyFile,
      invalidSchemaWrongTypeFile,
    ];
    for (const file of filesToUnlink) {
      try {
        await unlink(file);
      } catch (e) {
        /* ignore */
      }
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

  // Keep old test for basic parsing, but now expect validation error
  test("init() should throw validation error for old config format", async () => {
    const config = new Config(validConfigFileOld, user);
    await expect(config.init()).rejects.toThrow(
      `Config file ${validConfigFileOld} validation failed`
    );
  });

  test("init() should successfully validate a config file matching the schema", async () => {
    const config = new Config(validSchemaFile, user);
    await config.init();
    expect(config.configData).toEqual({ apiKeys: { gemini: "test-key" } });
  });

  test("init() should throw validation error if required 'apiKeys' is missing", async () => {
    const config = new Config(invalidSchemaMissingApiKeyFile, user);
    await expect(config.init()).rejects.toThrow(
      `Config file ${invalidSchemaMissingApiKeyFile} validation failed: root must have required property 'apiKeys'`
    );
  });

  test("init() should throw validation error for extra top-level property", async () => {
    const config = new Config(invalidSchemaExtraTopLevelFile, user);
    // Expect the wrapped error message
    await expect(config.init()).rejects.toThrow(
      `Error processing config file ${invalidSchemaExtraTopLevelFile}: Config file ${invalidSchemaExtraTopLevelFile} validation failed: root must NOT have additional properties (schema path: #/additionalProperties)`
    );
  });

  test("init() should throw validation error if required 'gemini' key is missing", async () => {
    const config = new Config(invalidSchemaMissingGeminiFile, user);
    await expect(config.init()).rejects.toThrow(
      `Config file ${invalidSchemaMissingGeminiFile} validation failed: /apiKeys must have required property 'gemini'`
    );
  });

  test("init() should throw validation error for extra property within 'apiKeys'", async () => {
    const config = new Config(invalidSchemaExtraApiKeyFile, user);
    // Expect the wrapped error message
    await expect(config.init()).rejects.toThrow(
      `Error processing config file ${invalidSchemaExtraApiKeyFile}: Config file ${invalidSchemaExtraApiKeyFile} validation failed: /apiKeys must NOT have additional properties (schema path: #/properties/apiKeys/additionalProperties)`
    );
  });

  test("init() should throw validation error if 'gemini' has wrong type", async () => {
    const config = new Config(invalidSchemaWrongTypeFile, user);
    await expect(config.init()).rejects.toThrow(
      `Config file ${invalidSchemaWrongTypeFile} validation failed: /apiKeys/gemini must be string`
    );
  });

  test("init() should throw an error if the config file does not exist", async () => {
    const config = new Config(nonExistentFile, user);
    // Expect the wrapped error message including the original ENOENT error
    await expect(config.init()).rejects.toThrow(
      `Error processing config file ${nonExistentFile}: ENOENT: no such file or directory`
    );
  });

  test("init() should throw an error if the config file contains invalid JSON", async () => {
    const config = new Config(invalidJsonFile, user);
    await expect(config.init()).rejects.toThrow(
      `Error parsing config file ${invalidJsonFile}`
    );
  });
});
