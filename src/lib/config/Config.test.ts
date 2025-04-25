import { Config } from "./Config.js"; // Added .js extension
import { User } from "../user/User.js"; // Added .js extension
import { writeFile, unlink, mkdir, rmdir } from "fs/promises";
import { join } from "path"; // Keep join, remove resolve
import { cwd } from "process"; // Import cwd
import { describe, expect, test, beforeEach, afterEach } from "vitest";

// --- Use Absolute Path ---
const testDirRelative = "./temp_test_config_dir_rel";
const testDirAbsolute = join(cwd(), testDirRelative); // Make absolute
// --- End Absolute Path ---

const validConfigFileOld = join(testDirAbsolute, "valid_config_old.json");
const invalidJsonFile = join(testDirAbsolute, "invalid_config.json");
const nonExistentFile = join(testDirAbsolute, "non_existent_config.json");
const validSchemaFile = join(testDirAbsolute, "valid_schema_config.json");
const invalidSchemaMissingApiKeyFile = join(
  testDirAbsolute,
  "invalid_schema_missing_apikey.json"
);
const invalidSchemaExtraTopLevelFile = join(
  testDirAbsolute,
  "invalid_schema_extra_top.json"
);
const invalidSchemaMissingGeminiFile = join(
  testDirAbsolute,
  "invalid_schema_missing_gemini.json"
);
const invalidSchemaExtraApiKeyFile = join(
  testDirAbsolute,
  "invalid_schema_extra_apikey.json"
);
const invalidSchemaWrongTypeFile = join(
  testDirAbsolute,
  "invalid_schema_wrong_type.json"
);
const validSchemaWithSrcDirFile = join(
  testDirAbsolute,
  "valid_schema_with_srcdir.json"
);
const invalidSchemaSrcDirTypeFile = join(
  testDirAbsolute,
  "invalid_schema_srcdir_type.json"
);

describe("Config", () => {
  let user: User;

  beforeEach(async () => {
    user = new User();
    // Create temporary directory and files for testing
    try {
      // Ensure the directory exists
      await mkdir(testDirAbsolute, { recursive: true }); // Use absolute path
      // Old valid file (pre-schema)
      await writeFile(
        validConfigFileOld, // Path variable is already absolute
        JSON.stringify({ setting: "value" }),
        "utf-8"
      );
      // Invalid JSON file
      await writeFile(invalidJsonFile, "{ invalid json", "utf-8"); // Path variable is already absolute
      // Valid schema file
      await writeFile(
        validSchemaFile, // Path variable is already absolute
        JSON.stringify({ apiKeys: { gemini: "test-key" } }),
        "utf-8"
      );
      // Invalid schema: missing apiKeys
      await writeFile(
        invalidSchemaMissingApiKeyFile, // Path variable is already absolute
        JSON.stringify({}),
        "utf-8"
      );
      // Invalid schema: extra top-level key
      await writeFile(
        invalidSchemaExtraTopLevelFile, // Path variable is already absolute
        JSON.stringify({ apiKeys: { gemini: "key" }, extra: "data" }),
        "utf-8"
      );
      // Invalid schema: missing gemini
      await writeFile(
        invalidSchemaMissingGeminiFile, // Path variable is already absolute
        JSON.stringify({ apiKeys: {} }),
        "utf-8"
      );
      // Invalid schema: extra key in apiKeys
      await writeFile(
        invalidSchemaExtraApiKeyFile, // Path variable is already absolute
        JSON.stringify({ apiKeys: { gemini: "key", other: "val" } }),
        "utf-8"
      );
      // Invalid schema: wrong type for gemini
      await writeFile(
        invalidSchemaWrongTypeFile, // Path variable is already absolute
        JSON.stringify({ apiKeys: { gemini: 123 } }),
        "utf-8"
      );
      // Valid schema with srcDir specified
      await writeFile(
        validSchemaWithSrcDirFile, // Path variable is already absolute
        JSON.stringify({ apiKeys: { gemini: "test-key" }, srcDir: "source" }),
        "utf-8"
      );
      // Invalid schema: wrong type for srcDir
      await writeFile(
        invalidSchemaSrcDirTypeFile, // Path variable is already absolute
        JSON.stringify({ apiKeys: { gemini: "test-key" }, srcDir: 123 }),
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
      validSchemaWithSrcDirFile, // Path variable is already absolute
      invalidSchemaSrcDirTypeFile, // Path variable is already absolute
    ];
    for (const file of filesToUnlink) {
      try {
        await unlink(file); // Path variable is already absolute
      } catch (e) {
        /* ignore */
      }
    }
    // Remove the temporary directory
    try {
      await rmdir(testDirAbsolute); // Use absolute path
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
    const config = new Config(validConfigFileOld, user); // Path variable is already absolute
    await expect(config.init()).rejects.toThrow(
      `Config file ${validConfigFileOld} validation failed`
    );
  });

  test("init() should successfully validate a config file matching the schema", async () => {
    const config = new Config(validSchemaFile, user); // Path variable is already absolute
    await config.init();
    // Now expect the default srcDir to be added
    expect(config.configData).toEqual({
      apiKeys: { gemini: "test-key" },
      srcDir: "src",
    });
  });

  test("init() should throw validation error if required 'apiKeys' is missing", async () => {
    const config = new Config(invalidSchemaMissingApiKeyFile, user); // Path variable is already absolute
    await expect(config.init()).rejects.toThrow(
      `Config file ${invalidSchemaMissingApiKeyFile} validation failed: root must have required property 'apiKeys'`
    );
  });

  test("init() should throw validation error for extra top-level property", async () => {
    const config = new Config(invalidSchemaExtraTopLevelFile, user); // Path variable is already absolute
    // Expect the wrapped error message
    await expect(config.init()).rejects.toThrow(
      `Error processing config file ${invalidSchemaExtraTopLevelFile}: Config file ${invalidSchemaExtraTopLevelFile} validation failed: root must NOT have additional properties (schema path: #/additionalProperties)`
    );
  });

  test("init() should throw validation error if required 'gemini' key is missing", async () => {
    const config = new Config(invalidSchemaMissingGeminiFile, user); // Path variable is already absolute
    await expect(config.init()).rejects.toThrow(
      `Config file ${invalidSchemaMissingGeminiFile} validation failed: /apiKeys must have required property 'gemini'`
    );
  });

  test("init() should throw validation error for extra property within 'apiKeys'", async () => {
    const config = new Config(invalidSchemaExtraApiKeyFile, user); // Path variable is already absolute
    // Expect the wrapped error message
    await expect(config.init()).rejects.toThrow(
      `Error processing config file ${invalidSchemaExtraApiKeyFile}: Config file ${invalidSchemaExtraApiKeyFile} validation failed: /apiKeys must NOT have additional properties (schema path: #/properties/apiKeys/additionalProperties)`
    );
  });

  test("init() should throw validation error if 'gemini' has wrong type", async () => {
    const config = new Config(invalidSchemaWrongTypeFile, user); // Path variable is already absolute
    await expect(config.init()).rejects.toThrow(
      `Config file ${invalidSchemaWrongTypeFile} validation failed: /apiKeys/gemini must be string`
    );
  });

  test("init() should throw an error if the config file does not exist", async () => {
    const config = new Config(nonExistentFile, user); // Path variable is already absolute
    // Expect the wrapped error message including the original ENOENT error (now with absolute path)
    await expect(config.init()).rejects.toThrow(
      `Error processing config file ${nonExistentFile}: ENOENT: no such file or directory`
    );
  });

  test("init() should throw an error if the config file contains invalid JSON", async () => {
    const config = new Config(invalidJsonFile, user); // Path variable is already absolute
    await expect(config.init()).rejects.toThrow(
      `Error parsing config file ${invalidJsonFile}`
    );
  });

  test("init() should default srcDir to 'src' when not provided", async () => {
    const config = new Config(validSchemaFile, user); // Path variable is already absolute
    await config.init();
    // Ajv applies the default during validation
    expect(config.configData).toEqual({
      apiKeys: { gemini: "test-key" },
      srcDir: "src",
    });
  });

  test("init() should use provided srcDir value", async () => {
    const config = new Config(validSchemaWithSrcDirFile, user); // Path variable is already absolute
    await config.init();
    expect(config.configData).toEqual({
      apiKeys: { gemini: "test-key" },
      srcDir: "source",
    });
  });

  test("init() should throw validation error if srcDir has wrong type", async () => {
    const config = new Config(invalidSchemaSrcDirTypeFile, user); // Path variable is already absolute
    await expect(config.init()).rejects.toThrow(
      `Config file ${invalidSchemaSrcDirTypeFile} validation failed: /srcDir must be string`
    );
  });
});
