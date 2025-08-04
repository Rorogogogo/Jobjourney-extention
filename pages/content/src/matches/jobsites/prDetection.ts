// PR Detection utility functions for job descriptions

export const PR_REQUIRED_PATTERNS = [
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

export const PR_NOT_REQUIRED_PATTERNS = [
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

export function detectPRRequirement(jobText: string): boolean {
  if (!jobText || typeof jobText !== 'string') {
    return false;
  }

  const text = jobText.toLowerCase();
  let prRequiredScore = 0;
  let prNotRequiredScore = 0;

  // Check for PR required patterns
  PR_REQUIRED_PATTERNS.forEach(pattern => {
    if (pattern.test(text)) {
      prRequiredScore += 2; // Higher weight for PR required patterns
    }
  });

  // Check for PR not required patterns
  PR_NOT_REQUIRED_PATTERNS.forEach(pattern => {
    if (pattern.test(text)) {
      prNotRequiredScore += 1;
    }
  });

  // Return true if PR is likely required based on score
  return prRequiredScore > prNotRequiredScore;
}
