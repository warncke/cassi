import { Task } from "../Task.js";
import { Prompt } from "../../prompt/Prompt.js";
import Input from "../../prompt/prompts/Input.js"; // Changed to default import
import { Cassi } from "../../cassi/Cassi.js"; // Import Cassi

export class Code extends Task {
  public prompt: string; // Added prompt property

  // Added cassi and parentTask to constructor
  constructor(cassi: Cassi, parentTask: Task | null, prompt: string) {
    super(cassi, parentTask); // Pass arguments to super()
    this.prompt = prompt; // Initialize prompt property
  }

  public async initTask(): Promise<void> {
    console.log(this.prompt);
  }
}
