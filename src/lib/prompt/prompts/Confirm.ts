export default class Confirm {
  readonly type = "confirm";
  message: string;
  response: boolean | null;

  constructor(message: string) {
    this.message = message;
    this.response = null;
  }
}
