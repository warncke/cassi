export default class Input {
  message: string;
  response: string | null;

  constructor(message: string) {
    this.message = message;
    this.response = null;
  }
}
