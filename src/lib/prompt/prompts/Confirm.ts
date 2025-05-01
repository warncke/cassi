import { Prompt } from "../Prompt.js";

export default class Confirm extends Prompt {
  readonly type = "confirm";
  message: string;
  response: boolean | null;

  constructor(message: string) {
    super();
    this.message = message;
    this.response = null;
  }
}
