import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./tests/server-only-loader.mjs", pathToFileURL("./"));
