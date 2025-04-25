import path from "path"; // Import path module
import crypto from "crypto"; // Import crypto module
import { Task } from "../Task.js";
// Removed unused Prompt import
// import { Prompt } from "../../prompt/Prompt.js";
// Removed unused Input import
// import Input from "../../prompt/prompts/Input.js"; // Changed to default import
import { kebabCase } from "change-case"; // Import kebabCase
import { Cassi } from "../../cassi/Cassi.js"; // Import Cassi
import { EvaluateCodePrompt } from "../../model/models/EvaluateCodePrompt.js"; // Import EvaluateCodePrompt
import { Coder } from "./Coder.js"; // Import Coder task
import { gemini20Flash } from "@genkit-ai/googleai"; // Import the specific model reference

export class Code extends Task {
  public prompt: string; // Added prompt property
  public evaluation: any; // Added evaluation property
  public taskId: string | null = null; // Added taskId property initialized to null
  public worktreeDir: string | null = null; // Added worktreeDir property

  // Added cassi and parentTask to constructor
  constructor(cassi: Cassi, parentTask: Task | null, prompt: string) {
    super(cassi, parentTask); // Pass arguments to super()
    this.prompt = prompt; // Initialize prompt property
  }

  // New async method for file modification tasks
  private async initFileTask(): Promise<void> {
    // Convert the summary to kebab-case for the repo slug
    const repoSlug = kebabCase(this.evaluation.summary);

    // Create SHA256 hash of repoSlug + Date.now()
    const hashInput = `${repoSlug}${Date.now()}`;
    const hash = crypto.createHash("sha256").update(hashInput).digest("base64");

    // Extract the first 8 alphanumeric characters from the base64 hash
    const alphanumericHash = hash.replace(/[^a-zA-Z0-9]/g, "");
    const id = alphanumericHash.substring(0, 8);

    // Set the taskId property
    this.taskId = `${id}-${repoSlug}`;

    // Generate worktree directory path and assign to the public property
    this.worktreeDir = path.join(
      this.cassi.repository.repositoryDir,
      ".cassi",
      "workspaces",
      this.taskId
    );

    console.log(`Generated ID for file modification task: ${id}`);
    console.log(`Task ID set to: ${this.taskId}`); // Log the taskId
    console.log(`Worktree directory set to: ${this.worktreeDir}`); // Log the worktreeDir

    // Create a new branch for the task
    await this.invoke(
      "git",
      "branch",
      [this.cassi.repository.repositoryDir],
      [this.taskId]
    );
    console.log(`Created branch: ${this.taskId}`);

    // Add a new worktree linked to the branch
    await this.invoke(
      "git",
      "addWorktree", // Corrected typo
      [this.cassi.repository.repositoryDir],
      [this.worktreeDir, this.taskId]
    );
    console.log(
      `Added worktree at ${this.worktreeDir} for branch ${this.taskId}`
    );

    // Add Coder subtask
    const formattedSteps = this.evaluation.steps
      .map((step: string) => `- ${step}`)
      .join("\n"); // Prepend '- ' to each step
    const coderPrompt = `${this.prompt}\n\nSummary: ${this.evaluation.summary}\n\nSteps:\n${formattedSteps}`; // Use formatted steps
    // Pass only cassi, parentTask (this), and prompt to Coder constructor
    this.addSubtask(new Coder(this.cassi, this, coderPrompt));
  }

  public async initTask(): Promise<void> {
    // Instantiate the EvaluateCodePrompt model
    const evaluateModel = this.newModel(
      "EvaluateCodePrompt"
    ) as EvaluateCodePrompt; // Keep assertion for type safety

    // Prepare options for the generate call
    const generateOptions = {
      model: gemini20Flash, // Pass the specific model reference
      prompt: this.prompt, // Pass the task's prompt
      // Add other options like temperature, maxOutputTokens if needed
    };

    // Generate the response using the model and the prepared options
    const evaluationJson = await evaluateModel.generate(generateOptions);

    // Parse the JSON response and assign it to the evaluation property
    this.evaluation = JSON.parse(evaluationJson);

    // Check the modifiesFiles property using the evaluation property
    if (this.evaluation.modifiesFiles === true) {
      // Call the new method to handle file modifications
      await this.initFileTask();
    } else {
      // Log that only file modification tasks are supported
      console.log(
        "Model response indicates no file modifications. Only file modification tasks are currently supported."
      );
      // Potentially throw an error or handle this case appropriately
    }
  }
}
