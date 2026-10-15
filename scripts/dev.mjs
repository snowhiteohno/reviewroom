import "dotenv/config";
import { spawn } from "node:child_process";
import { startLocalMongo } from "./mongo.mjs";
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child?.kill("SIGTERM");
  setTimeout(() => process.exit(code), 600).unref();
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
try {
  const mongo = await startLocalMongo();
  if (mongo) children.push(mongo);
  for (const args of [
    ["--watch", "server/index.js"],
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      "5174",
      "--strictPort",
    ],
  ]) {
    const child = spawn(process.execPath, args, { stdio: "inherit" });
    children.push(child);
    child.on("exit", (code) => {
      if (!stopping) stop(code || 1);
    });
  }
} catch (e) {
  console.error(e.message);
  stop(1);
}
