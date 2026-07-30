import { stdin as defaultStdin, stderr as defaultStderr } from "node:process";

const MAX_INPUT = 128;

export function readCanonicalTenantToken(value) {
  if (typeof value !== "string" || value.length > MAX_INPUT) {
    throw new Error("Invalid Tenant token.");
  }
  const token = value.replace(/\r?\n$/, "");
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new Error("Invalid Tenant token.");
  }
  const decoded = Buffer.from(token, "base64url");
  if (decoded.length !== 32 || decoded.toString("base64url") !== token) {
    decoded.fill(0);
    throw new Error("Invalid Tenant token.");
  }
  decoded.fill(0);
  return token;
}

export async function readTenantToken({ stdin = defaultStdin, stderr = defaultStderr } = {}) {
  if (stdin.isTTY && typeof stdin.setRawMode === "function") {
    stderr.write("Tenant Bearer token: ");
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.resume();
    let value = "";
    try {
      value = await new Promise((resolve, reject) => {
        const onData = (chunk) => {
          for (const character of chunk) {
            if (character === "\u0003") {
              cleanup();
              reject(new Error("Tenant token input cancelled."));
              return;
            }
            if (character === "\r" || character === "\n") {
              cleanup();
              resolve(value);
              return;
            }
            if (character === "\u007f" || character === "\b") {
              value = value.slice(0, -1);
              continue;
            }
            value += character;
            if (value.length > MAX_INPUT) {
              cleanup();
              reject(new Error("Invalid Tenant token."));
              return;
            }
          }
        };
        function cleanup() {
          stdin.off("data", onData);
        }
        stdin.on("data", onData);
      });
    } finally {
      stdin.setRawMode(false);
      stdin.pause();
      stderr.write("\n");
    }
    return readCanonicalTenantToken(value);
  }
  stdin.setEncoding("utf8");
  let value = "";
  for await (const chunk of stdin) {
    value += chunk;
    if (value.length > MAX_INPUT || value.includes("\n")) break;
  }
  return readCanonicalTenantToken(value);
}
