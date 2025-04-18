export default class Input {
  readonly type = "input";
  message: string;
  response: string | null;

  constructor(message: string) {
    this.message = message;
    this.response = null;
  }
}
