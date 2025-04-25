import { Config } from "./Config.js";
import { User } from "../user/User.js";
import { writeFile, unlink, mkdir, rmdir } from "fs/promises";
import { join } from "path";
import { cwd } from "process";
import { describe, expect, test, beforeEach, afterEach } from "vitest";

const testDirRelative = "./temp_test_config_dir_rel";
const testDirAbsolute = join(cwd(), testDirRelative);

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
const validSchemaWithDefaultCommandsFile = join(
  testDirAbsolute,
  "valid_schema_default_commands.json"
);
const validSchemaWithEmptyCommandsFile = join(
  testDirAbsolute,
  "valid_schema_empty_commands.json"
);
const validSchemaWithCustomCommandsFile = join(
  testDirAbsolute,
  "valid_schema_custom_commands.json"
);
const invalidSchemaCommandsBuildTypeFile = join(
  testDirAbsolute,
  "invalid_schema_commands_build_type.json"
);
const invalidSchemaCommandsTestTypeFile = join(
  testDirAbsolute,
  "invalid_schema_commands_test_type.json"
);
const invalidSchemaCommandsExtraPropFile = join(
  testDirAbsolute,
  "invalid_schema_commands_extra_prop.json"
);

describe("Config", () => {
  let user: User;

  beforeEach(async () => {
    user = new User();
    try {
      await mkdir(testDirAbsolute, { recursive: true });
      await writeFile(
        validConfigFileOld,
        JSON.stringify({ setting: "value" }),
        "utf-8"
      );
      await writeFile(invalidJsonFile, "{ invalid json", "utf-8");
      await writeFile(
        validSchemaFile,
        JSON.stringify({ apiKeys: { gemini: "test-key" } }),
        "utf-8"
      );
      await writeFile(
        invalidSchemaMissingApiKeyFile,
        JSON.stringify({}),
        "utf-8"
      );
      await writeFile(
        invalidSchemaExtraTopLevelFile,
        JSON.stringify({ apiKeys: { gemini: "key" }, extra: "data" }),
        "utf-8"
      );
      await writeFile(
        invalidSchemaMissingGeminiFile,
        JSON.stringify({ apiKeys: {} }),
        "utf-8"
      );
      await writeFile(
        invalidSchemaExtraApiKeyFile,
        JSON.stringify({ apiKeys: { gemini: "key", other: "val" } }),
        "utf-8"
      );
      await writeFile(
        invalidSchemaWrongTypeFile,
        JSON.stringify({ apiKeys: { gemini: 123 } }),
        "utf-8"
      );
      await writeFile(
        validSchemaWithSrcDirFile,
        JSON.stringify({ apiKeys: { gemini: "test-key" }, srcDir: "source" }),
        "utf-8"
      );
      await writeFile(
        invalidSchemaSrcDirTypeFile,
        JSON.stringify({ apiKeys: { gemini: "test-key" }, srcDir: 123 }),
        "utf-8"
      );
      await writeFile(
        validSchemaWithDefaultCommandsFile,
        JSON.stringify({ apiKeys: { gemini: "test-key" } }),
        "utf-8"
      );
      await writeFile(
        validSchemaWithEmptyCommandsFile,
        JSON.stringify({ apiKeys: { gemini: "test-key" }, commands: {} }),
        "utf-8"
      );
      await writeFile(
        validSchemaWithCustomCommandsFile,
        JSON.stringify({
          apiKeys: { gemini: "test-key" },
          commands: { build: "yarn build", test: "yarn test" },
        }),
        "utf-8"
      );
      await writeFile(
        invalidSchemaCommandsBuildTypeFile,
        JSON.stringify({
          apiKeys: { gemini: "test-key" },
          commands: { build: 123 },
        }),
        "utf-8"
      );
      await writeFile(
        invalidSchemaCommandsTestTypeFile,
        JSON.stringify({
          apiKeys: { gemini: "test-key" },
          commands: { test: false },
        }),
        "utf-8"
      );
      await writeFile(
        invalidSchemaCommandsExtraPropFile,
        JSON.stringify({
          apiKeys: { gemini: "test-key" },
          commands: { extra: "prop" },
        }),
        "utf-8"
      );
    } catch (e) {}
  });

  afterEach(async () => {
    const filesToUnlink = [
      validConfigFileOld,
      invalidJsonFile,
      validSchemaFile,
      invalidSchemaMissingApiKeyFile,
      invalidSchemaExtraTopLevelFile,
      invalidSchemaMissingGeminiFile,
      invalidSchemaExtraApiKeyFile,
      invalidSchemaWrongTypeFile,
      validSchemaWithSrcDirFile,
      invalidSchemaSrcDirTypeFile,
      validSchemaWithDefaultCommandsFile,
      validSchemaWithEmptyCommandsFile,
      validSchemaWithCustomCommandsFile,
      invalidSchemaCommandsBuildTypeFile,
      invalidSchemaCommandsTestTypeFile,
      invalidSchemaCommandsExtraPropFile,
    ];
    for (const file of filesToUnlink) {
      try {
        await unlink(file);
      } catch (e) {
        /* ignore */
      }
    }
    try {
      await rmdir(testDirAbsolute);
    } catch (e) {
      /* ignore if not empty or doesn't exist */
    }
  });

  test("should create an instance of Config", () => {
    const config = new Config("cassi.json", user);
    expect(config).toBeInstanceOf(Config);
  });

  test("init() should throw validation error for old config format", async () => {
    const config = new Config(validConfigFileOld, user);
    await expect(config.init()).rejects.toThrow(
      `Config file ${validConfigFileOld} validation failed`
    );
  });

  test("init() should successfully validate a config file matching the schema", async () => {
    const config = new Config(validSchemaFile, user);
    await config.init();
    expect(config.configData).toEqual({
      apiKeys: { gemini: "test-key" },
      srcDir: "src",
      commands: { build: "npm run build", test: "npm run test" },
    });
  });

  test("init() should throw validation error if required 'apiKeys' is missing", async () => {
    const config = new Config(invalidSchemaMissingApiKeyFile, user);
    await expect(config.init()).rejects.toThrow(
      `Config file ${invalidSchemaMissingApiKeyFile} validation failed: root must have required property 'apiKeys'`
    );
  });

  test("init() should throw validation error for extra top-level property", async () => {
    const config = new Config(invalidSchemaExtraTopLevelFile, user);
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

  test("init() should default srcDir to 'src' when not provided", async () => {
    const config = new Config(validSchemaFile, user);
    await config.init();
    expect(config.configData).toEqual({
      apiKeys: { gemini: "test-key" },
      srcDir: "src",
      commands: { build: "npm run build", test: "npm run test" },
    });
  });

  test("init() should use provided srcDir value", async () => {
    const config = new Config(validSchemaWithSrcDirFile, user);
    await config.init();
    expect(config.configData).toEqual({
      apiKeys: { gemini: "test-key" },
      srcDir: "source",
      commands: { build: "npm run build", test: "npm run test" },
    });
  });

  test("init() should throw validation error if srcDir has wrong type", async () => {
    const config = new Config(invalidSchemaSrcDirTypeFile, user);
    await expect(config.init()).rejects.toThrow(
      `Config file ${invalidSchemaSrcDirTypeFile} validation failed: /srcDir must be string`
    );
  });

  test("init() should default commands to { build: 'npm run build', test: 'npm run test' } when not provided", async () => {
    const config = new Config(validSchemaWithDefaultCommandsFile, user);
    await config.init();
    expect(config.configData?.commands).toEqual({
      build: "npm run build",
      test: "npm run test",
    });
  });

  test("init() should default commands when commands object is empty", async () => {
    const config = new Config(validSchemaWithEmptyCommandsFile, user);
    await config.init();
    expect(config.configData?.commands).toEqual({
      build: "npm run build",
      test: "npm run test",
    });
  });

  test("init() should use provided custom commands", async () => {
    const config = new Config(validSchemaWithCustomCommandsFile, user);
    await config.init();
    expect(config.configData?.commands).toEqual({
      build: "yarn build",
      test: "yarn test",
    });
  });

  test("init() should throw validation error if commands.build has wrong type", async () => {
    const config = new Config(invalidSchemaCommandsBuildTypeFile, user);
    await expect(config.init()).rejects.toThrow(
      `Config file ${invalidSchemaCommandsBuildTypeFile} validation failed: /commands/build must be string`
    );
  });

  test("init() should throw validation error if commands.test has wrong type", async () => {
    const config = new Config(invalidSchemaCommandsTestTypeFile, user);
    await expect(config.init()).rejects.toThrow(
      `Config file ${invalidSchemaCommandsTestTypeFile} validation failed: /commands/test must be string`
    );
  });

  test("init() should throw validation error for extra property within commands", async () => {
    const config = new Config(invalidSchemaCommandsExtraPropFile, user);
    await expect(config.init()).rejects.toThrow(
      `Error processing config file ${invalidSchemaCommandsExtraPropFile}: Config file ${invalidSchemaCommandsExtraPropFile} validation failed: /commands must NOT have additional properties (schema path: #/properties/commands/additionalProperties)`
    );
  });
});
