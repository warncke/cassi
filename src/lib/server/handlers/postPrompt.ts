import { Request, Response } from "express";
import { Server } from "../Server.js";

export const postPrompt = (server: Server) => {
  return (req: Request, res: Response) => {
    if (server.prompts.length === 0) {
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

    const promptEntry = server.prompts.shift();
    if (!promptEntry) {
      res.status(500).json({ error: "Internal server error" });
      return;
    }

    promptEntry.prompt.response = response;
    promptEntry.resolve();
    res.status(200).json({ message: "Prompt resolved successfully" });
  };
};
