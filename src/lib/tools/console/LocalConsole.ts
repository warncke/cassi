import { spawn } from "child_process";

export class LocalConsole {
  private cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  async exec(
    command: string,
    stdinData?: string
  ): Promise<{ stdout: string; stderr: string; code: number | null }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, {
        cwd: this.cwd,
        shell: true,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("error", (error) => {
        reject(new Error(`Spawn error: ${error.message}`));
      });

      child.on("close", (code) => {
        resolve({ stdout, stderr, code });
      });

      if (stdinData) {
        child.stdin.write(stdinData);
        child.stdin.end();
      } else {
        child.stdin.end();
      }
    });
  }
}
