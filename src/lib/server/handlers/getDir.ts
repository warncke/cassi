import { type Request, type Response } from "express";
import { promises as fs } from "fs";
import { glob } from "glob";
import path from "path";

import { type Server } from "../Server.js";

export const getDir = (server: Server) => {
  return async (req: Request, res: Response): Promise<void> => {
    if (!server.cassi) {
      res.status(500).json({ error: "Server not fully initialized" });
      return;
    }
    try {
      const files = await glob("**/*", {
        ignore: ["node_modules/**", ".cassi/**", "dist/**"],
        cwd: server.cassi.repository.repositoryDir,
        absolute: false,
        nodir: true,
      });

      let idCounter = 0;
      const fileDataPromises = files.map(async (file) => {
        const fullPath = path.join(
          server.cassi!.repository.repositoryDir,
          file
        );
        const content = await fs.readFile(fullPath, "utf-8");
        idCounter++;
        return { id: idCounter, name: file, content };
      });

      const fileData = await Promise.all(fileDataPromises);

      res.status(200).json(fileData);
    } catch (error) {
      console.error("Error getting directory listing:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  };
};
