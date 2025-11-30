import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { rimraf } from 'rimraf';
import type { ManifestType } from '@extension/shared';
import { archivePath } from 'lib/paths.js';
import type { ChoicesType, ModuleNameType } from '../types.ts';
import { processSelection } from '../helpers/utils.js';
import { DEFAULT_CHOICES, RECOVER_CHOICE_QUESTION } from '../const.js';
import { recoverModule } from './modules-handler.js';

export const recoverFeature = async (manifestObject: ManifestType, moduleName?: ModuleNameType) => {
  const archiveFiles = existsSync(archivePath) ? readdirSync(archivePath) : [];

  const choices: ChoicesType = DEFAULT_CHOICES.filter(choice => {
    if (choice.value === 'background') {
      return !manifestObject.background;
    }

    return archiveFiles.includes(`${choice.value}.zip`);
  });

  const processResult = await processSelection(choices, RECOVER_CHOICE_QUESTION, moduleName);

  if (processResult) {
    moduleName = processResult;
  }

  if (moduleName === 'tests') {
    recoverModule(manifestObject, moduleName as ModuleNameType);
    const testZipFilePath = resolve(archivePath, `${moduleName}.test.zip`);

    if (existsSync(testZipFilePath)) {
      await rimraf(testZipFilePath);
    }
  } else if (moduleName === 'devtools') {
    recoverModule(manifestObject, moduleName as ModuleNameType);
    recoverModule(manifestObject, 'devtools-panel');
  } else {
    recoverModule(manifestObject, moduleName as ModuleNameType);
  }
};
