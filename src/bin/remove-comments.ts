#!/usr/bin/env node

import { glob } from "glob";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

export async function removeComments() {
  const cwd = process.cwd();
  const tsFiles = await glob("**/*.ts", {
    cwd: cwd,
    ignore: ["node_modules/**", "dist/**", ".cassi/**"],
    absolute: true,
  });

  console.log(`Found ${tsFiles.length} TypeScript files.`);

  for (const filePath of tsFiles) {
    try {
      const content = await readFile(filePath, "utf-8");
      const lines = content.split("\n");
      const newLines = lines.map((line) => {
        const commentIndex = line.indexOf("//");
        if (commentIndex !== -1) {
          const quotesBefore = (
            line.substring(0, commentIndex).match(/["'`]/g) || []
          ).length;
          if (quotesBefore % 2 === 0) {
            return line.substring(0, commentIndex).trimEnd();
          }
        }
        return line;
      });
      const finalLines = newLines.filter(
        (line, index) => line.trim() !== "" || lines[index].trim() === ""
      );
      const newContent = finalLines.join("\n");

      if (content !== newContent) {
        await writeFile(filePath, newContent, "utf-8");
        console.log(`Removed comments from: ${path.relative(cwd, filePath)}`);
      }
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
    }
  }

  console.log("Comment removal process completed.");
}

removeComments().catch((error) => {
  console.error("An error occurred during comment removal:", error);
  process.exit(1);
});

const scriptPath = fileURLToPath(import.meta.url);
if (scriptPath === process.argv[1]) {
  removeComments().catch((error) => {
    console.error("An error occurred during comment removal:", error);
    process.exit(1);
  });
}
