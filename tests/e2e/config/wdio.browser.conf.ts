import { config as baseConfig } from './wdio.conf.js';
import { getChromeExtensionPath, getFirefoxExtensionPath } from '../utils/extension-path.js';
import { IS_CI, IS_FIREFOX } from '@extension/env';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

// Firefox is loaded from the built .xpi via the WebDriver Install Add-on command.
// Chrome is loaded unpacked from the dist/ directory via --load-extension, because
// ChromeDriver's `extensions` capability expects CRX-format files (zip + signature
// header) — a plain .zip is silently ignored, especially under --headless=new.
const firefoxXpiBase64 = IS_FIREFOX
  ? await (async () => {
      const files = await readdir(join(import.meta.dirname, '../../../dist-zip'));
      const latest = files.filter(file => extname(file) === '.xpi').at(-1);
      if (!latest) throw new Error('No .xpi found in dist-zip/. Did `pnpm zip:firefox` run?');
      return (await readFile(join(import.meta.dirname, `../../../dist-zip/${latest}`))).toString('base64');
    })()
  : '';

const unpackedExtensionDir = resolve(import.meta.dirname, '../../../dist');

if (!IS_FIREFOX) {
  try {
    const manifest = await stat(join(unpackedExtensionDir, 'manifest.json'));
    if (!manifest.isFile()) throw new Error('manifest.json is not a file');
  } catch (err) {
    throw new Error(
      `Chrome E2E requires an unpacked extension at ${unpackedExtensionDir} ` +
        `with a manifest.json at its root. ` +
        `Run \`pnpm build\` (or \`pnpm zip\`, which builds before zipping) first. ` +
        `Underlying error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

const chromeCapabilities = {
  browserName: 'chrome',
  acceptInsecureCerts: true,
  'goog:chromeOptions': {
    args: [
      '--disable-web-security',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      `--load-extension=${unpackedExtensionDir}`,
      `--disable-extensions-except=${unpackedExtensionDir}`,
      // Chrome 137+ disables --load-extension by default in automation contexts.
      // Opt out so the unpacked extension actually loads under chromedriver.
      '--disable-features=DisableLoadExtensionCommandLineSwitch',
      // Chrome 109+ requires the "new" headless mode for extensions to load.
      // The legacy "--headless" flag silently runs without any installed extensions.
      ...(IS_CI ? ['--headless=new'] : []),
    ],
    prefs: { 'extensions.ui.developer_mode': true },
    // ChromeDriver injects --enable-automation by default. With Chrome 137+'s
    // enterprise policies this hides extensions loaded via --load-extension.
    // Remove the switch and disable the automation extension so our unpacked
    // extension actually loads.
    excludeSwitches: ['enable-automation'],
    useAutomationExtension: false,
  },
};

const firefoxCapabilities = {
  browserName: 'firefox',
  acceptInsecureCerts: true,
  'moz:firefoxOptions': {
    args: [...(IS_CI ? ['--headless'] : [])],
  },
};

export const config: WebdriverIO.Config = {
  ...baseConfig,
  capabilities: IS_FIREFOX ? [firefoxCapabilities] : [chromeCapabilities],

  maxInstances: IS_CI ? 10 : 1,
  logLevel: 'error',
  execArgv: IS_CI ? [] : ['--inspect'],
  before: async ({ browserName }: WebdriverIO.Capabilities, _specs, browser: WebdriverIO.Browser) => {
    if (browserName === 'firefox') {
      await browser.installAddOn(firefoxXpiBase64, true);

      browser.addCommand('getExtensionPath', async () => getFirefoxExtensionPath(browser));
    } else if (browserName === 'chrome') {
      browser.addCommand('getExtensionPath', async () => getChromeExtensionPath(browser));
    }
  },
  afterTest: async () => {
    if (!IS_CI) {
      await browser.pause(500);
    }
  },
};
