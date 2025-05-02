import { type Request, type Response } from "express";
import { writeFile } from "fs/promises";
import path from "path";

import { type Server } from "../Server.js";

export const postTask = (server: Server) => {
  return async (req: Request, res: Response) => {
    try {
      const { audioBase64 } = req.body;

      if (!audioBase64 || typeof audioBase64 !== "string") {
        return res
          .status(400)
          .json({ error: "Missing or invalid audioBase64 field" });
      }

      const audioBuffer = Buffer.from(audioBase64, "base64");
      const filePath = path.resolve("audio.opus"); // Save in the project root

      await writeFile(filePath, audioBuffer);

      server.cassi!.newTask("AudioCode", undefined, audioBase64);
      server.cassi!.runTasks();

      res.status(201).json({ message: "Task received and audio saved" });
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  };
};
