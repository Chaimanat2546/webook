import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encryptSourceUrl, decryptSourceUrl } from '../server/calendar/source-secret.ts';

const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
test('encrypts without plaintext, uses distinct nonce and decrypts with versioned key', async () => {
  const url = 'https://example.invalid/calendar?token=synthetic';
  const a = await encryptSourceUrl(url, key), b = await encryptSourceUrl(url, key);
  assert.notEqual(a, b);
  assert.ok(!a.includes(url));
  assert.equal(await decryptSourceUrl(a, key), url);
});
test('rejects tampering and wrong key with safe errors', async () => {
  const payload = await encryptSourceUrl('https://example.invalid/?token=private', key);
  const parsed: { ciphertext: string } = JSON.parse(payload);
  parsed.ciphertext = btoa('tampered');
  await assert.rejects(decryptSourceUrl(JSON.stringify(parsed), key), /calendar_secret_invalid/);
  await assert.rejects(decryptSourceUrl(payload, btoa('a'.repeat(32))), /calendar_secret_invalid/);
});
test('rejects missing or malformed keys without echoing input', async () => {
  await assert.rejects(encryptSourceUrl('private', ''), /calendar_secret_unconfigured/);
  await assert.rejects(encryptSourceUrl('private', 'bad'), /calendar_secret_unconfigured/);
});
