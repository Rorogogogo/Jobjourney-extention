import type { PrRequirementResult } from '@extension/types';

import { detectCitizenshipRequirements } from './pr-detection.js';

type SharedField = PrRequirementResult['isRPRequired'];
type UtilityField = ReturnType<typeof detectCitizenshipRequirements>['isRPRequired'];
type LegacyFieldName = `is${'Pr'}Required`;

// @ts-expect-error legacy field should not exist on the shared type
type LegacySharedField = PrRequirementResult[LegacyFieldName];

// @ts-expect-error legacy field should not exist on the utility result
type LegacyUtilityField = ReturnType<typeof detectCitizenshipRequirements>[LegacyFieldName];

export type PrDetectionTypeAssertions = {
  shared: SharedField;
  utility: UtilityField;
};
