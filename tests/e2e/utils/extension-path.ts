/**
 * Returns the Chrome extension path.
 *
 * Instead of scraping the chrome://extensions shadow DOM (which keeps breaking
 * across Chrome versions), we use the Chrome DevTools Protocol via Puppeteer
 * to find the loaded extension's service-worker target. The target URL is
 * `chrome-extension://<id>/...`, so the id can be read directly.
 *
 * @param browser
 * @returns path to the Chrome extension (chrome-extension://<id>)
 */
export const getChromeExtensionPath = async (browser: WebdriverIO.Browser) => {
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

  // The service worker may not be registered the instant the browser opens.
  // Poll for up to ~10s.
  for (let i = 0; !extensionTarget && i < 20; i++) {
    await browser.pause(500);
    extensionTarget = findExtensionTarget();
  }

  if (!extensionTarget) {
    const allTargets = puppeteer
      .targets()
      .map((t: { type: () => string; url: () => string }) => ({ type: t.type(), url: t.url() }));
    throw new Error(
      'Could not locate the loaded extension via CDP. ' +
        'Expected a service_worker or background_page target with a chrome-extension:// URL. ' +
        `Got targets: ${JSON.stringify(allTargets)}. ` +
        'Check that the unpacked extension at dist/ exists and Chrome was launched with --load-extension.',
    );
  }

  const url = new URL(extensionTarget.url());
  return `chrome-extension://${url.hostname}`;
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
