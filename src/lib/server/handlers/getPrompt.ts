import { Request, Response } from "express";
import { Server } from "../Server.js";

export const getPrompt = (server: Server) => {
  return (req: Request, res: Response) => {
    const nextPromptEntry =
      server.prompts.length > 0 ? server.prompts[0] : null;
    res.json(nextPromptEntry ? nextPromptEntry.prompt : null);
  };
};
