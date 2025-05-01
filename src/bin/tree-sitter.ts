import Parser from "tree-sitter";
import typescript from "tree-sitter-typescript";
import { glob, GlobOptions } from "glob";
``;
import { readFileSync } from "fs";

const parser = new Parser();
parser.setLanguage(typescript.typescript);

run().catch((err) => console.error(err));

async function run() {
  const files = await glob("**/*.ts", {
    ignore: ["node_modules/**", ".cassi/**", "dist/**"],
  });

  for (const file of files) {
    if (file.endsWith("test.ts")) {
      continue;
    }
    const tree = parser.parse(readFileSync(file, { encoding: "utf8" }));

    const info: any = {
      imports: [],
      exports: [],
      classes: [],
      symbols: [],
    };

    for (const child of tree.rootNode.namedChildren) {
      switch (child.type) {
        case "import_statement":
          const importStatement = processImportStatement(file, child);
          if (importStatement) {
            info.imports.push(importStatement);
          }
          break;
        case "export_statement":
          const exportStatement = processExportStatement(file, child);
          if (exportStatement) {
            info.exports.push(exportStatement);
          }
          break;
      }
    }

    console.log(`<FILE name="${file}">`);
    console.log("<IMPORTS>");
    for (const importStatement of info.imports) {
      console.log(
        `import ${importStatement.symbols} from "${importStatement.from}"`
      );
    }
    console.log("</IMPORTS>");
    console.log("<EXPORTS>");
    for (const exportStatement of info.exports) {
      if (exportStatement.type === "function") {
        console.log(exportStatement.signature);
      } else if (exportStatement.type === "class") {
        console.log(`class ${exportStatement.className} {`);
        for (const field of exportStatement.fields) {
          console.log(field);
        }
        for (const functionStatement of exportStatement.methods) {
          console.log(functionStatement.signature);
        }
        console.log("}");
      }
    }
    console.log("</EXPORTS>");
    console.log("</FILE>");
  }
}

function processImportStatement(file: string, node: Parser.SyntaxNode): any {
  const symbols = node.children.find((node) => node.type === "import_clause");
  const from = node.children.find((node) => node.type === "string");
  if (!symbols || !from) {
    return;
  }

  const fromText = from.text.replace(/^['"]|['"]$/g, "");

  if (fromText.startsWith(".")) {
  }

  return {
    symbols: symbols.text,
    from: fromText,
  };
}

function processExportStatement(file: string, node: Parser.SyntaxNode): any {
  const exportNode = node.child(1);

  if (!exportNode) {
    return;
  }

  switch (exportNode.type) {
    case "function_declaration":
      const functionDeclaration = processFunctionDeclaration(file, exportNode);
      return {
        type: "function",
        ...functionDeclaration,
      };
      break;
    case "class_declaration":
      const classDeclaration = processClassDeclaration(file, exportNode);
      return {
        type: "class",
        ...classDeclaration,
      };
      break;
    default:
      console.error(`Unsupported export type: ${exportNode.type}`);
      return;
  }
}

function processFunctionDeclaration(
  file: string,
  node: Parser.SyntaxNode
): any {
  const signature = node.children
    .filter((node) => node.type !== "statement_block")
    .map((node) => node.text)
    .join(" ");
  return {
    signature,
  };
}

function processClassDeclaration(file: string, node: Parser.SyntaxNode): any {
  const typeIdentifier = node.children.find(
    (node) => node.type === "type_identifier"
  );
  const classBodyNode = node.children.find(
    (node) => node.type === "class_body"
  );
  if (!typeIdentifier || !classBodyNode) {
    return;
  }
  const className = typeIdentifier.text;
  const fields = classBodyNode.children
    .filter((node) => node.type.endsWith("field_definition"))
    .map((node) => node.text);
  const methods = classBodyNode.children
    .filter((node) => node.type === "method_definition")
    .map((node) => processFunctionDeclaration(file, node));

  return {
    className,
    fields,
    methods,
  };
}
