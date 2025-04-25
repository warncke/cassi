import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export class LocalConsole {
  private cwd: string;

  constructor(cwd: string) {
    console.log("GGG", cwd);
    this.cwd = cwd;
  }

  async exec(command: string): Promise<{ stdout: string; stderr: string }> {
    try {
      const { stdout, stderr } = await execAsync(command, { cwd: this.cwd });
      return { stdout, stderr };
    } catch (error: any) {
      return {
        stdout: error.stdout || "",
        stderr: error.stderr || error.message,
      };
    }
  }
}
