import { Prompt } from "../Prompt.js";

export default class Input extends Prompt {
  readonly type = "input";
  message: string;
  response: string | null;

  constructor(message: string) {
    super();
    this.message = message;
    this.response = null;
  }
}
