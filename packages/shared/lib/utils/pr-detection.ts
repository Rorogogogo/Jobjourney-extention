/**
 * Utility for detecting Permanent Residency (PR) requirements in job descriptions
 */
import type { PrRequirementResult } from '@extension/types';

/** @deprecated Use PrRequirementResult from @extension/types */
export type CitizenshipRequirementResult = PrRequirementResult;

// Common patterns that indicate PR requirement
const PR_REQUIRED_PATTERNS = [
  /\b(permanent\s+resident|pr\s+required|pr\s+only|permanent\s+residency|pr\s+status)\b/i,
  /\b(must\s+be\s+(a\s+)?permanent\s+resident|require\s+permanent\s+residency)\b/i,
  /\b(only\s+permanent\s+residents|permanent\s+residents\s+only)\b/i,
  /\b(citizen(ship)?\s+(required|only)|must\s+be\s+(a\s+)?citizen)\b/i,
  /\b(only\s+citizens|citizens\s+only)\b/i,
  /\b(must\s+have\s+(valid\s+)?work\s+authorization|authorized\s+to\s+work\s+without\s+sponsorship)\b/i,
  /\b(no\s+visa\s+sponsorship|not\s+sponsoring\s+visas?)\b/i,
  /\b(must\s+be\s+eligible\s+to\s+work\s+without\s+sponsorship)\b/i,
  /\b(legal\s+right\s+to\s+work|legally\s+authorized\s+to\s+work)\b/i,
  /\b(right\s+to\s+work\s+in\s+(australia|canada|uk|united\s+states))\b/i,
  /\b(no\s+work\s+visa\s+required|must\s+not\s+require\s+sponsorship)\b/i,
  /\b(unable\s+to\s+sponsor|cannot\s+sponsor\s+visa)\b/i,
  /\b(australian\s+citizen|canadian\s+citizen|british\s+citizen|us\s+citizen)\b/i,
  /\b(indefinite\s+leave\s+to\s+remain|settled\s+status)\b/i,
  /\b(landed\s+immigrant)\b/i,
];

// Patterns that might indicate NO PR requirement (work visa friendly)
const PR_NOT_REQUIRED_PATTERNS = [
  /\b(visa\s+sponsorship\s+available|will\s+sponsor\s+visa)\b/i,
  /\b(sponsoring\s+eligible\s+candidates|open\s+to\s+sponsorship)\b/i,
  /\b(h1b\s+transfer|h1b\s+sponsorship)\b/i,
  /\b(work\s+permit\s+assistance|visa\s+support)\b/i,
  /\b(all\s+visa\s+types\s+welcome|international\s+candidates\s+welcome)\b/i,
  /\b(485\s+(working\s+)?visa|graduate\s+visa|temporary\s+visa)\b/i,
  /\b(visa\s+status.*citizen.*permanent\s+resident.*visa\s+holder)\b/i,
  /\b(whether\s+you\s+are.*citizen.*permanent\s+resident.*or\s+other)\b/i,
  /\b(please\s+list.*citizen.*permanent\s+resident.*visa)\b/i,
];

// Security Clearance Patterns
const SECURITY_CLEARANCE_PATTERNS = [
  { level: 'NV2', pattern: /\b(nv2|negative\s+vetting\s+(level\s+)?2)\b/i },
  { level: 'NV1', pattern: /\b(nv1|negative\s+vetting\s+(level\s+)?1)\b/i },
  { level: 'Baseline', pattern: /\b(baseline\s+clearance|baseline\s+security\s+clearance)\b/i },
  { level: 'AGSVA', pattern: /\b(agsva|security\s+clearance|defence\s+clearance)\b/i },
  { level: 'Defence', pattern: /\b(defence\s+experience|experience\s+in\s+defence)\b/i },
];

// Citizenship Specific Patterns (Stronger than PR)
const CITIZENSHIP_PATTERNS = [
  /\b(must\s+be\s+(an\s+)?australian\s+citizen)\b/i,
  /\b(australian\s+citizens\s+only)\b/i,
  /\b(citizenship\s+is\s+required)\b/i,
];

// Keywords that add context but don't directly indicate PR requirement
const CONTEXT_KEYWORDS = [/\b(work\s+permit|visa|immigration|sponsorship|authorization)\b/i];

/**
 * Analyze job text to determine Citizenship and PR requirements, including security clearances.
 */
export const detectCitizenshipRequirements = (jobText: string): CitizenshipRequirementResult => {
  if (!jobText || typeof jobText !== 'string') {
    return {
      isRPRequired: false,
      isCitizenRequired: false,
      securityClearance: null,
      confidence: 'low',
      matchedPatterns: [],
      reasoning: 'No job text provided',
    };
  }

  const text = jobText.toLowerCase();
  const matchedPatterns: string[] = [];
  let prRequiredScore = 0;
  let prNotRequiredScore = 0;
  let isCitizenRequired = false;
  let securityClearance: string | null = null;

  let earliestClearanceMatch: { level: string; matchText: string; index: number } | null = null;

  for (const { level, pattern } of SECURITY_CLEARANCE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches && matches.index !== undefined) {
      if (!earliestClearanceMatch || matches.index < earliestClearanceMatch.index) {
        earliestClearanceMatch = {
          level,
          matchText: matches[0],
          index: matches.index,
        };
      }
    }
  }

  if (earliestClearanceMatch) {
    securityClearance = earliestClearanceMatch.level;
    isCitizenRequired = true;
    matchedPatterns.push(`SECURITY_CLEARANCE_${earliestClearanceMatch.level}: "${earliestClearanceMatch.matchText}"`);
  }

  CITIZENSHIP_PATTERNS.forEach((pattern, index) => {
    const matches = text.match(pattern);
    if (matches) {
      isCitizenRequired = true;
      matchedPatterns.push(`CITIZENSHIP_REQUIRED_${index}: "${matches[0]}"`);
    }
  });

  PR_REQUIRED_PATTERNS.forEach((pattern, index) => {
    const matches = text.match(pattern);
    if (matches) {
      matchedPatterns.push(`PR_REQUIRED_${index}: "${matches[0]}"`);
      prRequiredScore += 2;
    }
  });

  PR_NOT_REQUIRED_PATTERNS.forEach((pattern, index) => {
    const matches = text.match(pattern);
    if (matches) {
      matchedPatterns.push(`PR_NOT_REQUIRED_${index}: "${matches[0]}"`);
      prNotRequiredScore += 1;
    }
  });

  let hasWorkAuthContext = false;
  CONTEXT_KEYWORDS.forEach(pattern => {
    if (pattern.test(text)) {
      hasWorkAuthContext = true;
    }
  });

  const isRPRequired = isCitizenRequired || prRequiredScore > prNotRequiredScore;

  let confidence: 'high' | 'medium' | 'low';
  if (isCitizenRequired || prRequiredScore >= 4) {
    confidence = 'high';
  } else if (prRequiredScore >= 2 || (prRequiredScore > 0 && hasWorkAuthContext)) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  let reasoning = '';
  if (isCitizenRequired) {
    reasoning = `Citizenship required${securityClearance ? ` with ${securityClearance} clearance` : ''}`;
  } else if (isRPRequired) {
    reasoning = `PR likely required - found ${prRequiredScore} positive indicators`;
    if (prNotRequiredScore > 0) {
      reasoning += ` and ${prNotRequiredScore} negative indicators`;
    }
  } else if (prNotRequiredScore > 0) {
    reasoning = `PR likely not required - found ${prNotRequiredScore} sponsorship indicators`;
  } else {
    reasoning = 'No clear PR requirement indicators found';
  }

  return {
    isRPRequired,
    isCitizenRequired,
    securityClearance,
    confidence,
    matchedPatterns,
    reasoning,
  };
};

/**
 * Analyze job text to determine if Permanent Residency is required.
 */
export const detectPRRequirement = (
  jobText: string,
): {
  isRPRequired: boolean;
  confidence: 'high' | 'medium' | 'low';
  matchedPatterns: string[];
  reasoning: string;
} => {
  const result = detectCitizenshipRequirements(jobText);
  return {
    isRPRequired: result.isRPRequired,
    confidence: result.confidence,
    matchedPatterns: result.matchedPatterns,
    reasoning: result.reasoning,
  };
};

/**
 * Simple boolean check for PR requirement (for backward compatibility).
 */
export const isPRRequired = (jobText: string): boolean => {
  const result = detectPRRequirement(jobText);
  return result.isRPRequired && result.confidence !== 'low';
};

/**
 * Get a human-readable summary of PR requirement analysis.
 */
export const getPRAnalysisSummary = (jobText: string): string => {
  const result = detectCitizenshipRequirements(jobText);

  let summary = `PR Required: ${result.isRPRequired ? 'Yes' : 'No'} (${result.confidence} confidence)\n`;
  if (result.isCitizenRequired) {
    summary += `Citizenship Required: Yes\n`;
  }
  if (result.securityClearance) {
    summary += `Security Clearance: ${result.securityClearance}\n`;
  }
  summary += `Reasoning: ${result.reasoning}\n`;

  if (result.matchedPatterns.length > 0) {
    summary += `Matched patterns:\n`;
    result.matchedPatterns.forEach((pattern: string) => {
      summary += `  - ${pattern}\n`;
    });
  }

  return summary;
};
