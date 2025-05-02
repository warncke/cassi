import Input from "./prompts/Input.js";
import Confirm from "./prompts/Confirm.js";

// Removed 'export type Prompts = Input | Confirm;' as per user instruction

export abstract class Prompt {
  public response: any;
}
