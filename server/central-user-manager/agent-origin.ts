import "server-only";

const MAX_ORIGIN_LENGTH = 2_048;
const MAX_HOSTNAME_LENGTH = 253;
const MAX_DNS_LABEL_LENGTH = 63;
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const IPV4 = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
const RESERVED_SUFFIXES = new Set([
  "home",
  "internal",
  "invalid",
  "lan",
  "local",
  "localhost",
  "test",
  "example",
]);
const PRIVATE_RESOLUTION_SUFFIXES = [
  "nip.io",
  "sslip.io",
  "localtest.me",
  "lvh.me",
] as const;

export class CentralUserManagerAgentOriginError extends Error {
  constructor() {
    super("Central User Manager Agent origin is invalid");
    this.name = "CentralUserManagerAgentOriginError";
  }
}

function invalidOrigin(): never {
  throw new CentralUserManagerAgentOriginError();
}

function hasOnlyVisibleAscii(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined || codePoint < 0x21 || codePoint > 0x7e) {
      return false;
    }
  }
  return true;
}

function readPublicDnsHostname(value: string): string {
  const hostname = value.toLowerCase();

  if (
    hostname.length === 0 ||
    hostname.length > MAX_HOSTNAME_LENGTH ||
    hostname.includes(":") ||
    hostname.startsWith("[") ||
    hostname.endsWith("]") ||
    IPV4.test(hostname)
  ) {
    return invalidOrigin();
  }

  const labels = hostname.split(".");
  if (
    labels.length < 2 ||
    labels.some(
      (label) =>
        label.length === 0 ||
        label.length > MAX_DNS_LABEL_LENGTH ||
        !DNS_LABEL.test(label) ||
        label.startsWith("xn--"),
    ) ||
    RESERVED_SUFFIXES.has(labels.at(-1) ?? "") ||
    PRIVATE_RESOLUTION_SUFFIXES.some(
      (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
    )
  ) {
    return invalidOrigin();
  }

  return hostname;
}

export function normalizeAgentOrigin(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_ORIGIN_LENGTH ||
    !hasOnlyVisibleAscii(value) ||
    value.includes("\\") ||
    value.includes("%") ||
    !/^https:\/\/[^/?#]+\/?$/.test(value)
  ) {
    return invalidOrigin();
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return invalidOrigin();
  }

  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    (url.port !== "" && url.port !== "443") ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    return invalidOrigin();
  }

  return `https://${readPublicDnsHostname(url.hostname)}`;
}

export function readStoredAgentOrigin(value: unknown): string {
  const normalized = normalizeAgentOrigin(value);
  if (value !== normalized) {
    return invalidOrigin();
  }
  return normalized;
}
