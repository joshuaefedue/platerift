import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire, registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT_DIR, "src");

const require = createRequire(import.meta.url);
const ts = require("typescript");

// src/lib/db.ts loads node:sqlite lazily via eval("require")("node:sqlite"),
// which looks up globalThis.require under ESM execution.
if (typeof globalThis.require === "undefined") {
  globalThis.require = require;
}

// Isolate SQLite test state outside the repository so git status remains clean.
let createdTempDbDir = null;
if (!process.env.SQLITE_DATA_DIR) {
  createdTempDbDir = path.join(
    os.tmpdir(),
    `platerift-test-${process.pid}-${crypto.randomBytes(4).toString("hex")}`
  );
  fs.mkdirSync(createdTempDbDir, { recursive: true });
  process.env.SQLITE_DATA_DIR = createdTempDbDir;
}

if (createdTempDbDir) {
  process.on("exit", () => {
    try {
      const db = globalThis.__plateriftDb;
      if (db && typeof db.close === "function") {
        db.close();
      }
    } catch {
      // Ignore close errors during shutdown
    }
    try {
      fs.rmSync(createdTempDbDir, { recursive: true, force: true });
    } catch {
      // Ignore transient Windows file lock cleanup errors in os.tmpdir()
    }
  });
}

const CANDIDATE_SUFFIXES = [
  "",
  ".ts",
  ".tsx",
  ".mts",
  ".mjs",
  ".js",
  "/index.ts",
  "/index.tsx",
  "/index.mjs",
  "/index.js",
];

function resolveFileWithExtensions(basePath) {
  for (const suffix of CANDIDATE_SUFFIXES) {
    const candidate = suffix.startsWith("/")
      ? path.join(basePath, suffix.slice(1))
      : `${basePath}${suffix}`;
    try {
      if (fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // Continue probing suffixes
    }
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") {
      return nextResolve("next/server.js", context);
    }

    if (specifier.startsWith("@/")) {
      const rel = specifier.slice(2);
      const target = resolveFileWithExtensions(path.join(SRC_DIR, rel));
      if (target) {
        return {
          url: pathToFileURL(target).href,
          shortCircuit: true,
        };
      }
    }

    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL &&
      context.parentURL.startsWith("file:") &&
      !context.parentURL.includes("/node_modules/")
    ) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const cleanSpecifier = specifier.split(/[?#]/)[0];
      const target = resolveFileWithExtensions(
        path.resolve(parentDir, cleanSpecifier)
      );
      if (target) {
        return {
          url: pathToFileURL(target).href,
          shortCircuit: true,
        };
      }
    }

    return nextResolve(specifier, context);
  },

  load(url, context, nextLoad) {
    if (
      url.startsWith("file:") &&
      !url.includes("/node_modules/") &&
      (url.endsWith(".ts") || url.endsWith(".tsx"))
    ) {
      const filePath = fileURLToPath(url);
      const source = fs.readFileSync(filePath, "utf8");
      const transpiled = ts.transpileModule(source, {
        fileName: filePath,
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
          verbatimModuleSyntax: false,
          isolatedModules: true,
          inlineSourceMap: true,
          inlineSources: true,
        },
      });
      return {
        format: "module",
        source: transpiled.outputText,
        shortCircuit: true,
      };
    }

    return nextLoad(url, context);
  },
});
