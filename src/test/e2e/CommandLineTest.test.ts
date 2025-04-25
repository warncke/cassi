import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import path from "path";

describe("CommandLineTest E2E", () => {
  let cassiProcess: ChildProcessWithoutNullStreams;
  const projectRoot = path.resolve(__dirname, "../../.."); // Adjust if needed
  const compiledCassiAbsolutePath = path.join(projectRoot, "dist/bin/cassi.js"); // Absolute path
  const relativeCompiledCassiPath = path.relative(
    projectRoot,
    compiledCassiAbsolutePath
  ); // Should be dist/bin/cassi.js

  beforeAll(() => {
    // Setup tasks if needed before all tests run
  });

  afterAll(() => {
    // Cleanup tasks after all tests run
    if (cassiProcess && !cassiProcess.killed) {
      cassiProcess.kill();
    }
  });

  // Helper function to send input and wait for output
  const interact = (
    process: ChildProcessWithoutNullStreams,
    input: string,
    expectedOutput: string | RegExp,
    timeout = 5000 // 5 seconds timeout
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
        console.log(`STDOUT: ${dataStr}`); // Log stdout
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
        console.error(`STDERR: ${dataStr}`); // Log stderr
        output += dataStr;
        // Keep listening on stderr, but check if the expected output arrived via stdout/stderr mix
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
      process.stderr.on("data", onErrorData); // Capture errors too

      // Only write to stdin if input is provided
      if (input !== "") {
        console.log(`STDIN: ${input}`); // Log stdin
        process.stdin.write(input + "\n");
      } else {
        // If input is empty, we might just be waiting for initial output
        console.log(`Waiting for initial output without sending input.`);
      }
    });
  };

  it("should start the cassi CLI and respond to basic interaction", async () => {
    // Spawn the CLI using the npm script
    cassiProcess = spawn(
      "npm", // Use npm executable
      ["run", "start:cli"], // Arguments to run the script
      {
        cwd: projectRoot, // Run in project root
        env: { ...process.env, NODE_ENV: "test", CI: "true" }, // Inherit env, set test specifics
        shell: true, // Use shell to handle npm execution correctly on different OS
      }
    );

    let fullOutput = "";

    cassiProcess.on("error", (err) => {
      console.error("Failed to start subprocess.", err);
      throw err; // Fail the test if the process errors on spawn
    });

    cassiProcess.on("close", (code, signal) => {
      console.log(
        `Cassi process closed with code ${code} and signal ${signal}`
      );
    });

    // Example interaction: Wait for initial prompt (adjust regex/string as needed)
    // This assumes cassi asks for the working directory first.
    // You'll need to adjust the expected prompt based on cassi's actual behavior.
    try {
      // Wait for the CWD confirmation prompt
      const initialOutput = await interact(
        cassiProcess,
        "", // Send no input, just wait for the prompt
        /Is this the correct repository directory?.*\(y\/N\)/i // Updated Regex
      );
      fullOutput += initialOutput;
      expect(initialOutput).toMatch(
        /Is this the correct repository directory?.*\(y\/N\)/i // Updated Regex
      );

      // Send 'y' to confirm the CWD
      // Send 'y' to confirm the CWD
      const afterCwdConfirmOutput = await interact(
        cassiProcess,
        "y",
        /Current branch is '.*'. Continue\? \(y\/N\)/i // Expect the InitializeGit prompt
      );
      fullOutput += afterCwdConfirmOutput;
      expect(afterCwdConfirmOutput).toMatch(
        /Current branch is '.*'. Continue\? \(y\/N\)/i
      );

      // Send 'y' to confirm the branch in InitializeGit
      // Expect the main task prompt now
      const afterBranchConfirmOutput = await interact(
        cassiProcess,
        "y",
        /Enter your next request:/i // Expect the main input prompt
      );
      fullOutput += afterBranchConfirmOutput;
      expect(afterBranchConfirmOutput).toMatch(/Enter your next request:/i);

      // Add more interactions and expectations here...
      // e.g., wait for task prompt, send task, wait for completion
    } catch (error) {
      console.error("Test interaction failed:", error);
      console.log("Full output received:\n", fullOutput); // Log output on failure
      // Ensure process is killed even if interactions fail before re-throwing
      if (cassiProcess && !cassiProcess.killed) {
        cassiProcess.kill();
      }
      throw error; // Re-throw to fail the test
    } finally {
      // Final cleanup check
      if (cassiProcess && !cassiProcess.killed) {
        cassiProcess.kill();
      }
    }
  }, 15000); // Increase timeout for the test itself
});
