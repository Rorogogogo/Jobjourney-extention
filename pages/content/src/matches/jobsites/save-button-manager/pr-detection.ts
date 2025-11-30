/**
 * Utility for detecting Permanent Residency (PR) requirements in job descriptions
 */

// Common patterns that indicate PR requirement
const PR_REQUIRED_PATTERNS = [
  // Direct PR mentions
  /\b(permanent\s+resident|pr\s+required|pr\s+only|permanent\s+residency|pr\s+status)\b/i,
  /\b(must\s+be\s+(a\s+)?permanent\s+resident|require\s+permanent\s+residency)\b/i,
  /\b(only\s+permanent\s+residents|permanent\s+residents\s+only)\b/i,

  // Citizenship requirements (often equivalent to PR)
  /\b(citizen(ship)?\s+(required|only)|must\s+be\s+(a\s+)?citizen)\b/i,
  /\b(only\s+citizens|citizens\s+only)\b/i,

  // Work authorization with PR implications
  /\b(must\s+have\s+(valid\s+)?work\s+authorization|authorized\s+to\s+work\s+without\s+sponsorship)\b/i,
  /\b(no\s+visa\s+sponsorship|not\s+sponsoring\s+visas?)\b/i,
  /\b(must\s+be\s+eligible\s+to\s+work\s+without\s+sponsorship)\b/i,

  // Legal right to work (often implies PR)
  /\b(legal\s+right\s+to\s+work|legally\s+authorized\s+to\s+work)\b/i,
  /\b(right\s+to\s+work\s+in\s+(australia|canada|uk|united\s+states))\b/i,

  // Visa restrictions
  /\b(no\s+work\s+visa\s+required|must\s+not\s+require\s+sponsorship)\b/i,
  /\b(unable\s+to\s+sponsor|cannot\s+sponsor\s+visa)\b/i,

  // Country-specific terms
  /\b(australian\s+citizen|canadian\s+citizen|british\s+citizen|us\s+citizen)\b/i,
  /\b(indefinite\s+leave\s+to\s+remain|settled\s+status)\b/i, // UK specific
  /\b(landed\s+immigrant)\b/i, // Canada specific
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

// Keywords that add context but don't directly indicate PR requirement
const CONTEXT_KEYWORDS = [/\b(work\s+permit|visa|immigration|sponsorship|authorization)\b/i];

/**
 * Analyze job text to determine if Permanent Residency is required
 * @param jobText - The job description text to analyze
 * @returns Object with detection results
 */
export const detectPRRequirement = (
  jobText: string,
): {
  isRPRequired: boolean;
  confidence: 'high' | 'medium' | 'low';
  matchedPatterns: string[];
  reasoning: string;
} => {
  if (!jobText || typeof jobText !== 'string') {
    return {
      isRPRequired: false,
      confidence: 'low',
      matchedPatterns: [],
      reasoning: 'No job text provided',
    };
  }

  const text = jobText.toLowerCase();
  const matchedPatterns: string[] = [];
  let prRequiredScore = 0;
  let prNotRequiredScore = 0;

  // Check for PR required patterns
  PR_REQUIRED_PATTERNS.forEach((pattern, index) => {
    const matches = text.match(pattern);
    if (matches) {
      matchedPatterns.push(`PR_REQUIRED_${index}: "${matches[0]}"`);
      prRequiredScore += 2; // Higher weight for PR required patterns
    }
  });

  // Check for PR not required patterns
  PR_NOT_REQUIRED_PATTERNS.forEach((pattern, index) => {
    const matches = text.match(pattern);
    if (matches) {
      matchedPatterns.push(`PR_NOT_REQUIRED_${index}: "${matches[0]}"`);
      prNotRequiredScore += 1;
    }
  });

  // Check for context keywords
  let hasWorkAuthContext = false;
  CONTEXT_KEYWORDS.forEach(pattern => {
    if (pattern.test(text)) {
      hasWorkAuthContext = true;
    }
  });

  // Determine result based on scores
  const isRPRequired = prRequiredScore > prNotRequiredScore;

  // Determine confidence level
  let confidence: 'high' | 'medium' | 'low';
  if (prRequiredScore >= 4) {
    confidence = 'high'; // Multiple strong indicators
  } else if (prRequiredScore >= 2 || (prRequiredScore > 0 && hasWorkAuthContext)) {
    confidence = 'medium'; // Some indicators with context
  } else if (prRequiredScore > 0) {
    confidence = 'low'; // Weak indicators
  } else {
    confidence = 'low'; // No clear indicators
  }

  // Generate reasoning
  let reasoning = '';
  if (isRPRequired) {
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
    confidence,
    matchedPatterns,
    reasoning,
  };
};

/**
 * Simple boolean check for PR requirement (for backward compatibility)
 * @param jobText - The job description text to analyze
 * @returns true if PR is likely required, false otherwise
 */
export const isPRRequired = (jobText: string): boolean => {
  const result = detectPRRequirement(jobText);
  return result.isRPRequired && result.confidence !== 'low';
};

/**
 * Get a human-readable summary of PR requirement analysis
 * @param jobText - The job description text to analyze
 * @returns Formatted string with analysis results
 */
export const getPRAnalysisSummary = (jobText: string): string => {
  const result = detectPRRequirement(jobText);

  let summary = `PR Required: ${result.isRPRequired ? 'Yes' : 'No'} (${result.confidence} confidence)\n`;
  summary += `Reasoning: ${result.reasoning}\n`;

  if (result.matchedPatterns.length > 0) {
    summary += `Matched patterns:\n`;
    result.matchedPatterns.forEach(pattern => {
      summary += `  - ${pattern}\n`;
    });
  }

  return summary;
};
