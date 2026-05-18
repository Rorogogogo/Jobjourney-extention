import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

/**
 * Compute the deterministic extension ID Chrome assigns to an unpacked
 * extension loaded via --load-extension=<absPath>.
 *
 * Algorithm (from chromium/extensions/common/extension_id.cc):
 *   sha256(absolute_path) → take the first 16 bytes (32 hex chars) →
 *   map each nibble 0..15 to 'a'..'p'.
 *
 * Assumes the manifest has no `key` field; if a `key` is added in the future,
 * Chrome derives the ID from the public key in `key` instead and this helper
 * would need updating.
 */
const computeExtensionIdFromPath = (absPath: string): string => {
  const hash = createHash('sha256').update(absPath).digest('hex');
  return hash
    .slice(0, 32)
    .split('')
    .map(c => String.fromCharCode(parseInt(c, 16) + 97))
    .join('');
};

/**
 * Returns the Chrome extension path.
 *
 * Primary strategy: compute the deterministic ID that Chrome assigns to the
 * unpacked extension at <repo>/dist when launched with --load-extension=<abs>.
 * This avoids any dependency on CDP target discovery, which has been flaky
 * across Chrome / ChromeDriver releases.
 *
 * Fallback: scan puppeteer targets for a chrome-extension:// service worker
 * (in case the manifest grows a `key` field in the future and the computed
 * ID stops matching).
 *
 * @param browser
 * @returns path to the Chrome extension (chrome-extension://<id>)
 */
export const getChromeExtensionPath = async (browser: WebdriverIO.Browser) => {
  const unpackedDir = resolve(import.meta.dirname, '../../../dist');
  const computedId = computeExtensionIdFromPath(unpackedDir);

  // Look the extension up via CDP through puppeteer. We do NOT trust the
  // computed id without verification: if --load-extension was silently
  // dropped, the extension is not actually loaded, and just navigating to
  // the computed URL would "succeed" against a non-existent extension and
  // make later assertions fail in confusing ways.
  const puppeteer = await browser.getPuppeteer();
  const findExtensionTarget = () =>
    puppeteer
      .targets()
      .find(
        (t: { type: () => string; url: () => string }) =>
          (t.type() === 'service_worker' || t.type() === 'background_page') &&
          t.url().startsWith('chrome-extension://'),
      );

  let extensionTarget = findExtensionTarget();
  for (let i = 0; !extensionTarget && i < 20; i++) {
    await browser.pause(500);
    extensionTarget = findExtensionTarget();
  }

  if (extensionTarget) {
    const url = new URL(extensionTarget.url());
    return `chrome-extension://${url.hostname}`;
  }

  const allTargets = puppeteer
    .targets()
    .map((t: { type: () => string; url: () => string }) => ({ type: t.type(), url: t.url() }));
  throw new Error(
    `Could not locate the loaded chrome extension. ` +
      `Expected ID from sha256(${unpackedDir}) is ${computedId}. ` +
      `CDP targets seen: ${JSON.stringify(allTargets)}. ` +
      'Verify dist/manifest.json exists and Chrome was launched with --load-extension.',
  );
};

/**
 * Returns the Firefox extension path.
 *
 * Reads the Internal UUID from about:debugging. Mozilla has reshuffled this
 * page across releases, so we wait for the target row to render and try a
 * couple of selector variants before giving up.
 *
 * @param browser
 * @returns path to the Firefox extension (moz-extension://<uuid>)
 */
export const getFirefoxExtensionPath = async (browser: WebdriverIO.Browser) => {
  await browser.url('about:debugging#/runtime/this-firefox');

  // Wait for the page to actually render the extension list. Each row holds
  // a definition list with "Internal UUID" as the <dt> text. Selector variants
  // cover both the historical and current about:debugging layouts.
  const selectors = [
    '//dt[contains(text(), "Internal UUID")]/following-sibling::dd',
    '//*[contains(normalize-space(text()), "Internal UUID")]/following-sibling::*[1]',
  ];

  let internalUUID = '';
  for (let attempt = 0; attempt < 20 && !internalUUID; attempt++) {
    for (const sel of selectors) {
      const el = await browser.$(sel);
      if (await el.isExisting()) {
        const text = (await el.getText()).trim();
        if (text) {
          internalUUID = text;
          break;
        }
      }
    }
    if (!internalUUID) {
      await browser.pause(500);
    }
  }

  if (!internalUUID) {
    throw new Error('Internal UUID not found on about:debugging');
  }

  return `moz-extension://${internalUUID}`;
};
