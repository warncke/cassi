import { type Request, type Response } from "express";
import { glob } from "glob";

import { type Server } from "../Server.js";

export const getDir = (server: Server) => {
  return async (req: Request, res: Response): Promise<void> => {
    if (!server.cassi) {
      res.status(500).json({ error: "Server not fully initialized" });
      return;
    }
    try {
      const files = await glob("**/*.ts", {
        ignore: ["node_modules/**", ".cassi/**", "dist/**"],
        cwd: server.cassi.repository.repositoryDir,
        absolute: false,
      });
      res.status(200).json({ files });
    } catch (error) {
      console.error("Error getting directory listing:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  };
};
