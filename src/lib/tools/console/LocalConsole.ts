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
      // Use spawn for better control over stdio
      const child = spawn(command, {
        cwd: this.cwd,
        shell: true, // Use shell to interpret the command string like exec does
        stdio: ["pipe", "pipe", "pipe"], // Pipe stdin, stdout, stderr
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
        // This handles errors like command not found
        reject(new Error(`Spawn error: ${error.message}`));
      });

      child.on("close", (code) => {
        // 'close' event indicates the process has exited and stdio streams are closed
        resolve({ stdout, stderr, code });
      });

      // Handle stdin if provided
      if (stdinData) {
        child.stdin.write(stdinData);
        child.stdin.end(); // Close stdin to signal no more data
      } else {
        child.stdin.end(); // Still need to close stdin even if no data is sent
      }
    });
  }
}
