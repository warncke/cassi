import Input from "./prompts/Input.js";
import Confirm from "./prompts/Confirm.js";

export type Prompts = Input | Confirm;

export class Prompt {
  prompts: Prompts[];

  constructor(prompts: Prompts[]) {
    this.prompts = prompts;
  }
}
