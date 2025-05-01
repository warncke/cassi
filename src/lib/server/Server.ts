import express, { Express } from "express";
import { Prompt } from "../prompt/Prompt.js";
import { Cassi } from "../cassi/Cassi.js";

export class Server {
  private app: Express | null = null;
  private cassi: Cassi | null = null;
  private host: string;
  private port: number;

  constructor(host: string = "localhost", port: number = 7777) {
    this.host = host;
    this.port = port;
  }

  async init(cassi: Cassi): Promise<void> {
    this.cassi = cassi;
    this.app = express();
    console.log(`Express server initialized for ${this.host}:${this.port}`);
  }

  addPrompt(prompt: Prompt): void {
    // TODO: Implement prompt handling logic
    console.log("Received prompt:", prompt);
  }

  public getApp(): Express | null {
    return this.app;
  }

  public getHost(): string {
    return this.host;
  }

  public getPort(): number {
    return this.port;
  }
}
