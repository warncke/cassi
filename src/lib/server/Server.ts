import express, { Express, Request, Response, RequestHandler } from "express";
import cors from "cors";
import { Prompt } from "../prompt/Prompt.js";
import { Cassi } from "../cassi/Cassi.js";
import { getPrompt } from "./handlers/getPrompt.js";
import { postPrompt } from "./handlers/postPrompt.js";
import { postTask } from "./handlers/postTask.js";

interface PromptEntry {
  prompt: Prompt;
  promise: Promise<any>;
  resolve: (value?: any) => void; // Make value optional
  reject: (reason?: any) => void;
}

export class Server {
  public app: Express | null = null;
  public cassi: Cassi | null = null;
  public host: string;
  public port: number;
  public prompts: PromptEntry[] = [];

  constructor(host: string = "localhost", port: number = 7777) {
    this.host = host;
    this.port = port;
  }

  async init(cassi: Cassi): Promise<void> {
    this.cassi = cassi;
    this.app = express();
    this.app.use(cors()); // Enable CORS for all origins
    this.app.use(express.json({ limit: "1mb" })); // Add this line to parse JSON bodies, limit to 1MB
    this.prompts = [];

    this.app.get("/prompt", getPrompt(this));
    this.app.post("/prompt", postPrompt(this));
    this.app.post("/task", postTask(this) as RequestHandler); // Cast to RequestHandler

    await new Promise<void>((resolve) => {
      this.app!.listen(this.port, this.host, () => {
        console.log(`Server listening on http://${this.host}:${this.port}`);
        resolve();
      });
    });

    setInterval(() => {
      if (this.prompts.length === 0 && this.cassi) {
        this.cassi.runTasks();
      }
    }, 50);
  }

  async addPrompt(prompt: Prompt): Promise<any> {
    let resolve!: (value?: any) => void; // Make value optional
    let reject!: (reason?: any) => void;
    const promise = new Promise<any>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    this.prompts.push({ prompt, promise, resolve, reject });
    return promise;
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
