import { Repository } from "./Repository.js";
import { User } from "../user/User.js";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { rimraf } from "rimraf";

import { describe, expect, test, beforeEach, afterEach } from "vitest";

describe("Repository", () => {
  let repository: Repository;
  let user: User;
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "cassi-repo-test-"));
    user = new User();
    repository = new Repository(testDir, user);
  });

  afterEach(async () => {
    await rimraf(testDir);
  });

  test("should create an instance of Repository", () => {
    expect(repository).toBeInstanceOf(Repository);
  });

  test("init() should create .cassi/workspaces directory", async () => {
    await repository.init();
    const workspacesDir = path.join(testDir, ".cassi", "workspaces");
    let stats;
    try {
      stats = await fs.stat(workspacesDir);
    } catch (error) {
    }
    expect(stats).toBeDefined();
    expect(stats?.isDirectory()).toBe(true);
  });
});
