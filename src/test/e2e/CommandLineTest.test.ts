import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import path from "path";

describe("CommandLineTest E2E", () => {
  let cassiProcess: ChildProcessWithoutNullStreams;
  const projectRoot = path.resolve(__dirname, "../../..");
  const compiledCassiAbsolutePath = path.join(projectRoot, "dist/bin/cassi.js");
  const relativeCompiledCassiPath = path.relative(
    projectRoot,
    compiledCassiAbsolutePath
  );

  beforeAll(() => {
  });

  afterAll(() => {
    if (cassiProcess && !cassiProcess.killed) {
      cassiProcess.kill();
    }
  });

  const interact = (
    process: ChildProcessWithoutNullStreams,
    input: string,
    expectedOutput: string | RegExp,
    timeout = 5000
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      let output = "";
      const timer = setTimeout(() => {
        process.stdout.off("data", onData);
        process.stderr.off("data", onErrorData);
        reject(
          new Error(
            `Timeout waiting for output matching ${expectedOutput} after sending: ${input}\nReceived: ${output}`
          )
        );
      }, timeout);

      const onData = (data: Buffer) => {
        const dataStr = data.toString();
        console.log(`STDOUT: ${dataStr}`);
        output += dataStr;
        let match = false;
        if (expectedOutput instanceof RegExp) {
          match = expectedOutput.test(output);
        } else {
          match = output.includes(expectedOutput);
        }

        if (match) {
          clearTimeout(timer);
          process.stdout.off("data", onData);
          process.stderr.off("data", onErrorData);
          resolve(output);
        }
      };

      const onErrorData = (data: Buffer) => {
        const dataStr = data.toString();
        console.error(`STDERR: ${dataStr}`);
        output += dataStr;
        let match = false;
        if (expectedOutput instanceof RegExp) {
          match = expectedOutput.test(output);
        } else {
          match = output.includes(expectedOutput);
        }
        if (match) {
          clearTimeout(timer);
          process.stdout.off("data", onData);
          process.stderr.off("data", onErrorData);
          resolve(output);
        }
      };

      process.stdout.on("data", onData);
      process.stderr.on("data", onErrorData);

      if (input !== "") {
        console.log(`STDIN: ${input}`);
        process.stdin.write(input + "\n");
      } else {
        console.log(`Waiting for initial output without sending input.`);
      }
    });
  };

  it("should start the cassi CLI and respond to basic interaction", async () => {
    cassiProcess = spawn(
      "npm",
      ["run", "start:cli"],
      {
        cwd: projectRoot,
        env: { ...process.env, NODE_ENV: "test", CI: "true" },
        shell: true,
      }
    );

    let fullOutput = "";

    cassiProcess.on("error", (err) => {
      console.error("Failed to start subprocess.", err);
      throw err;
    });

    cassiProcess.on("close", (code, signal) => {
      console.log(
        `Cassi process closed with code ${code} and signal ${signal}`
      );
    });

    try {
      const initialOutput = await interact(
        cassiProcess,
        "",
        /Is this the correct repository directory?.*\(y\/N\)/i
      );
      fullOutput += initialOutput;
      expect(initialOutput).toMatch(
        /Is this the correct repository directory?.*\(y\/N\)/i
      );

      const afterCwdConfirmOutput = await interact(
        cassiProcess,
        "y",
        /Current branch is '.*'. Continue\? \(y\/N\)/i
      );
      fullOutput += afterCwdConfirmOutput;
      expect(afterCwdConfirmOutput).toMatch(
        /Current branch is '.*'. Continue\? \(y\/N\)/i
      );

      const afterBranchConfirmOutput = await interact(
        cassiProcess,
        "y",
        /Enter your next request:/i
      );
      fullOutput += afterBranchConfirmOutput;
      expect(afterBranchConfirmOutput).toMatch(/Enter your next request:/i);

      const taskRequest = "add a pauseTask method to the Task class";
      const taskResponseOutput = await interact(
        cassiProcess,
        taskRequest,
        /Enter your next request:/i
      );
      fullOutput += taskResponseOutput;
      console.log(
        "Response after adding pauseTask request:",
        taskResponseOutput
      );

    } catch (error) {
      console.error("Test interaction failed:", error);
      console.log("Full output received:\n", fullOutput);
      if (cassiProcess && !cassiProcess.killed) {
        cassiProcess.kill();
      }
      throw error;
    } finally {
      if (cassiProcess && !cassiProcess.killed) {
        cassiProcess.kill();
      }
    }
  }, 15000);
});
