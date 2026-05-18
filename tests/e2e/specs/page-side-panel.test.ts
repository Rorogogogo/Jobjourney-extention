describe('Webextension Side Panel', () => {
  // ChromeDriver + Chrome 137+ in headless automation mode silently drops
  // --load-extension, even with --headless=new, excludeSwitches, and the
  // DisableLoadExtensionCommandLineSwitch feature disabled. The extension
  // never registers as a CDP target, so any test that depends on resolving
  // chrome-extension://<id>/... cannot run reliably in this CI environment.
  // Firefox still exercises the side panel end-to-end.
  before(function () {
    if ((browser.capabilities as WebdriverIO.Capabilities).browserName === 'chrome') {
      this.skip();
    }
  });

  it('should make side panel accessible', async () => {
    const extensionPath = await browser.getExtensionPath();
    const sidePanelUrl = `${extensionPath}/side-panel/index.html`;

    await browser.url(sidePanelUrl);
    await expect(browser).toHaveTitle('Side Panel');
  });
});
