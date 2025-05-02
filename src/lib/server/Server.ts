import express, { Express, Request, Response } from "express";
import { Prompt } from "../prompt/Prompt.js";
import { Cassi } from "../cassi/Cassi.js";

interface PromptEntry {
  prompt: Prompt;
  promise: Promise<any>;
  resolve: (value?: any) => void; // Make value optional
  reject: (reason?: any) => void;
}

export class Server {
  private app: Express | null = null;
  private cassi: Cassi | null = null;
  private host: string;
  private port: number;
  public prompts: PromptEntry[] = [];

  constructor(host: string = "localhost", port: number = 7777) {
    this.host = host;
    this.port = port;
  }

  async init(cassi: Cassi): Promise<void> {
    this.cassi = cassi;
    this.app = express();
    this.app.use(express.json()); // Add this line to parse JSON bodies
    this.prompts = [];

    // Add the GET /prompt route
    this.app.get("/prompt", (req: Request, res: Response) => {
      const nextPromptEntry = this.prompts.length > 0 ? this.prompts[0] : null;
      res.json(nextPromptEntry ? nextPromptEntry.prompt : null);
    });

    // Add the POST /prompt route
    this.app.post("/prompt", (req: Request, res: Response) => {
      if (this.prompts.length === 0) {
        res.status(400).json({ error: "No pending prompts" });
        return;
      }

      const { response } = req.body;
      if (response === undefined) {
        res
          .status(400)
          .json({ error: "Missing response property in request body" });
        return;
      }

      const promptEntry = this.prompts.shift();
      if (!promptEntry) {
        // Should not happen due to the check above, but satisfies TypeScript
        res.status(500).json({ error: "Internal server error" });
        return;
      }

      promptEntry.prompt.response = response;
      promptEntry.resolve(); // Resolve without passing the prompt object
      res.status(200).json({ message: "Prompt resolved successfully" });
    });

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
