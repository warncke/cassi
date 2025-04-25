import { describe, it, expect } from "vitest";
import { LocalConsole } from "./LocalConsole.js";
import path from "path";
import os from "os";

describe("LocalConsole", () => {
  it("should execute a command and return stdout", async () => {
    const console = new LocalConsole(process.cwd());
    const result = await console.exec("echo hello");
    expect(result.stdout.trim()).toBe("hello");
    expect(result.stderr).toBe("");
  });

  it("should capture stderr when a command outputs to it", async () => {
    const console = new LocalConsole(process.cwd());
    const result = await console.exec(
      "node -e \"console.error('error message')\""
    );
    expect(result.stdout).toBe("");
    expect(result.stderr.trim()).toBe("error message");
  });

  it("should capture stderr when a command fails", async () => {
    const console = new LocalConsole(process.cwd());
    const result = await console.exec("nonexistentcommand123");
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("nonexistentcommand123");
  });

  it("should execute command in the specified cwd", async () => {
    const tempDir = os.tmpdir();
    const console = new LocalConsole(tempDir);
    const command = process.platform === "win32" ? "cd" : "pwd";
    const result = await console.exec(command);

    const expectedCwd = path.normalize(tempDir);
    const actualCwd = path.normalize(result.stdout.trim());

    expect(actualCwd).toBe(expectedCwd);
    expect(result.stderr).toBe("");
  });
});
