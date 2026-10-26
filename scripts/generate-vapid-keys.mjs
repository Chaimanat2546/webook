import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const output = args.indexOf("--out");
const subjectFlag = args.indexOf("--subject");
const destination = output >= 0 ? args[output + 1] : undefined;
const subject = subjectFlag >= 0 ? args[subjectFlag + 1] : undefined;
if (args.length !== 4 || !destination || !subject || !/^mailto:[^\s@#]+@[^\s@#]+$/.test(subject)) {
  console.error("Usage: node scripts/generate-vapid-keys.mjs --out .env.push.staging --subject mailto:ops@example.com");
  process.exitCode = 1;
} else {
  try {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const publicKey = Buffer.from(await crypto.subtle.exportKey("raw", pair.publicKey)).toString("base64url");
    const { d: privateKey } = await crypto.subtle.exportKey("jwk", pair.privateKey);
    await writeFile(resolve(destination), `VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}\nVAPID_SUBJECT=${subject}\n`, { flag: "wx", mode: 0o600 });
    console.log("VAPID configuration saved. Keep the file private; no keys were printed.");
  } catch {
    console.error("Could not create VAPID configuration. Choose a new writable file; existing files are never overwritten.");
    process.exitCode = 1;
  }
}
