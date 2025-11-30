import { existsSync, mkdirSync, rmdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { colorfulLog } from '@extension/shared';
import type { ManifestType } from '@extension/shared';
import { unZipAndDeleteModule, zipAndDeleteModule, zipAndDeleteTests } from '../helpers/index.js';
import { isFolderEmpty, processModuleConfig } from '../helpers/utils.js';
import { archivePath, pagesPath, specsPath, testsPath } from '../paths.js';
import type { ModuleNameType } from '../types.ts';

export const recoverModule = (manifestObject: ManifestType, moduleName: ModuleNameType) => {
  const zipFilePath = resolve(archivePath, `${moduleName}.zip`);
  const zipTestFilePath = resolve(archivePath, `${moduleName}.test.zip`);

  if (!existsSync(zipFilePath)) {
    colorfulLog(`No archive found for ${moduleName}`, 'info');
    process.exit(0);
  }

  processModuleConfig(manifestObject, moduleName, true);

  unZipAndDeleteModule(zipFilePath, pagesPath);

  if (existsSync(zipTestFilePath)) {
    unZipAndDeleteModule(zipTestFilePath, specsPath);
  }

  colorfulLog(`Recovered: ${moduleName}`, 'info');

  if (isFolderEmpty(archivePath)) {
    rmdirSync(archivePath);
  }
};

export const deleteModule = async (manifestObject: ManifestType, moduleName: ModuleNameType) => {
  processModuleConfig(manifestObject, moduleName);

  if (!existsSync(archivePath)) {
    mkdirSync(archivePath, { recursive: true });
  }

  if (moduleName === 'tests') {
    await zipAndDeleteTests(testsPath, archivePath);
  } else {
    await zipAndDeleteModule(moduleName, pagesPath, archivePath, specsPath);
  }

  colorfulLog(`Deleted: ${moduleName}`, 'info');
};
