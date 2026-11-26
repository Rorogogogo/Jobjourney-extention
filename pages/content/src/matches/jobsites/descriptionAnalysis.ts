import { detectCitizenshipRequirements } from '@extension/shared';
import type {
  WorkArrangementResult,
  EmploymentTypeResult,
  TechStackResult,
  ExperienceLevelResult,
  JobAnalysisResult,
} from '@extension/types';

const TECH_KEYWORDS = [
  // Languages
  'JavaScript',
  'TypeScript',
  'Python',
  'Java',
  'C#',
  'C++',
  'Go',
  'Rust',
  'Ruby',
  'PHP',
  'Swift',
  'Kotlin',
  'HTML',
  'CSS',
  'SQL',
  'NoSQL',
  'R',
  'Matlab',
  'Scala',
  'Perl',
  'Shell',
  'Bash',
  'PowerShell',

  // Frontend
  'React',
  'Angular',
  'Vue',
  'Svelte',
  'Next.js',
  'Nuxt',
  'Redux',
  'Tailwind',
  'Bootstrap',
  'jQuery',
  'Webpack',
  'Vite',
  'Babel',
  'Sass',
  'Less',
  'GraphQL',

  // Backend
  'Node.js',
  'Express',
  'NestJS',
  'Django',
  'Flask',
  'FastAPI',
  'Spring',
  'Spring Boot',
  '.NET',
  'ASP.NET',
  'Laravel',
  'Symfony',
  'Rails',
  'Ruby on Rails',

  // Database
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Redis',
  'Elasticsearch',
  'Cassandra',
  'DynamoDB',
  'Firestore',
  'SQLite',
  'MariaDB',
  'Oracle',
  'SQL Server',

  // Cloud & DevOps
  'AWS',
  'Azure',
  'GCP',
  'Google Cloud',
  'Docker',
  'Kubernetes',
  'Terraform',
  'Ansible',
  'Jenkins',
  'CircleCI',
  'GitHub Actions',
  'GitLab CI',
  'Heroku',
  'Netlify',
  'Vercel',
  'DigitalOcean',
  'Cloudflare',

  // Mobile
  'React Native',
  'Flutter',
  'Ionic',
  'Xamarin',
  'Android',
  'iOS',

  // AI/ML/Data
  'TensorFlow',
  'PyTorch',
  'Keras',
  'Scikit-learn',
  'Pandas',
  'NumPy',
  'Spark',
  'Hadoop',
  'BigQuery',
  'Snowflake',
  'Databricks',
  'Tableau',
  'Power BI',
  'Shopify Liquid',
];

// "Remote" about the job, not "remote users", "remote sites" or "remote monitoring".
// "Work from home" and "WFH" are left to hybrid: in Australian ads they're a perk of an
// office job ("2 days WFH", "WFH flexibility").
const REMOTE =
  /\b(?:fully\s+remote|100%\s+remote|remote[\s-](?:first|friendly|role|position|job|opportunity|based)|work(?:ing)?\s+(?:fully\s+)?remotely\s+(?:from|in|anywhere)|fully\s+work\s+from\s+home)\b|\(remote\)|^remote$/im;
const NOT_REMOTE =
  /\b(?:(?:no|not|non)(?:\s+an?)?[\s-]remote|(?:does\s+not|doesn't|cannot|can't)\s+(?:support|offer|allow)\s+remote)\b/i;
// A split week: "3 days in the office", "in office 3 days per week", "2 days WFH".
const HYBRID =
  /\b(?:hybrid(?!\s+benefit)|work(?:ing)?\s+from\s+home|wfh|remote\s+working|flexible\s+work(?:ing)?\s+(?:arrangements?|model|options?)|mix\s+of\s+(?:home|remote)\s+and\s+office|[1-4]\s+days?\s+(?:per\s+week\s+|a\s+week\s+)?(?:in\s+(?:the\s+)?office|onsite|on[\s-]site|wfh|from\s+home|remote(?:ly)?)|in\s+(?:the\s+)?office\s+[1-4]\s+days?)\b/i;
// Where the work is done, not "on-site parking" or "an onsite specialist".
const ON_SITE =
  /\b(?:(?:work(?:ing)?|based|located|role\s+is|position\s+is|fully)\s+on[\s-]?site|on[\s-]?site\s+(?:role|position|presence|work|attendance|full[\s-]time|5\s+days)|\(on[\s-]?site\)|in[\s-]office\s+(?:role|position|presence|full[\s-]time|5\s+days)|work\s+from\s+(?:the\s+)?office|office[\s-]based\s+(?:role|position)|must\s+be\s+based\s+in|5\s+days\s+(?:per\s+week\s+|a\s+week\s+)?(?:in\s+(?:the\s+)?office|on[\s-]?site))\b/i;

export const detectWorkArrangement = (text: string): WorkArrangementResult => {
  // Hybrid first: a hybrid role mentions both the office and working from home.
  const saysHybrid = /\bhybrid(?!\s+benefit)\b/i.test(text);
  const fullWeekInOffice = /\b5\s+days\s+(?:per\s+week\s+)?in\s+(?:the\s+)?office\b/i.test(text);
  // "Does not support remote working" isn't a hybrid role, unless it says hybrid.
  if (HYBRID.test(text) && !fullWeekInOffice && (saysHybrid || !NOT_REMOTE.test(text))) {
    return { type: 'hybrid', confidence: 'high', reasoning: 'Explicitly mentions hybrid work.' };
  }
  if (REMOTE.test(text) && !NOT_REMOTE.test(text)) {
    return { type: 'remote', confidence: 'high', reasoning: 'Explicitly mentions remote work.' };
  }
  if (ON_SITE.test(text)) {
    return { type: 'on-site', confidence: 'high', reasoning: 'Explicitly mentions on-site/office work.' };
  }
  // A mention of an office alone ("Office Administrator", "head office", "Office 365")
  // says nothing about where the work is done.
  return { type: 'unknown', confidence: 'low', reasoning: 'No clear work arrangement found.' };
};

export const detectEmploymentType = (text: string): EmploymentTypeResult => {
  if (/\b(full-time|full time|permanent)\b/i.test(text)) {
    return { type: 'full-time', confidence: 'high', reasoning: 'Explicitly mentions full-time.' };
  }

  if (/\b(contract|contractor|temp|temporary|fixed term)\b/i.test(text)) {
    return { type: 'contract', confidence: 'high', reasoning: 'Explicitly mentions contract.' };
  }

  if (/\b(part-time|part time)\b/i.test(text)) {
    return { type: 'part-time', confidence: 'high', reasoning: 'Explicitly mentions part-time.' };
  }

  if (/\b(casual)\b/i.test(text)) {
    return { type: 'casual', confidence: 'high', reasoning: 'Explicitly mentions casual.' };
  }

  return { type: 'unknown', confidence: 'low', reasoning: 'No clear employment type found.' };
};

type Level = ExperienceLevelResult['level'];

// In a job title the words are about the role itself, so plain keywords are enough.
// "Manager" alone is left out: a Product Manager isn't a people lead.
const TITLE_LEVELS: Array<[Level, RegExp]> = [
  ['intern', /\b(intern|internship)\b/i],
  ['graduate', /\b(graduate|grad)\b/i],
  ['junior', /\b(junior|jr\.?|entry[\s-]level)\b/i],
  // "Staff" only as a level ("Staff Engineer"), not "Retail Staff" or "Staff Accountant".
  [
    'senior',
    /\b(?:senior|sr\.?|principal|staff\s+(?:[a-z-]+\s+){0,2}(?:engineer|developer|designer|scientist|architect))\b/i,
  ],
  // Not "Lead Generator", and not "Business Development Manager" (a sales role).
  [
    'lead',
    /\b(?:lead(?!\s+generat)|head\s+of|director|vp|vice\s+president|(?:engineering|delivery|technology)\s+manager)\b/i,
  ],
  ['mid', /\b(mid[\s-]level|intermediate)\b/i],
];

// A description mentions "senior stakeholders", "graduate degree" or "reporting to the
// Head of…" without saying anything about the role, so only phrases about the role count.
const DESCRIPTION_LEVELS: Array<[Level, RegExp]> = [
  // Not "internship" alone: "internship experience welcomed", "internship programs" in a
  // list of benefits.
  ['intern', /\b(?:student\s+intern|intern\s+(?:program|programme|role|position))\b/i],
  ['graduate', /\bgraduate\s+(?:program|programme|role|position|opportunity|engineer|developer|analyst|consultant)\b/i],
  [
    'junior',
    /\b(?:entry[\s-]level|junior\s+(?:level|role|position|engineer|developer|analyst|designer|consultant))\b/i,
  ],
  // Before senior: "Intermediate to Senior" takes the lower end, as years do.
  // Not "intermediate" alone: "intermediate Excel skills".
  [
    'mid',
    /\b(?:mid[\s-]level|intermediate(?:\s+to\s+senior)?\s+(?:level|role|position|engineer|developer|analyst|designer|consultant|(?:[a-z]+\s+){1,2}(?:engineer|developer)))\b/i,
  ],
  [
    'senior',
    /\b(?:senior|sr\.?)\s+(?:level|role|position|engineer|developer|analyst|designer|consultant|architect|(?:[a-z]+\s+){1,2}(?:engineer|developer))\b/i,
  ],
];

const YEARS = String.raw`(\d{1,2})\s*\+?\s*(?:(?:-|–|to)\s*\d{1,2}\s*)?\+?\s*(?:years?|yrs?)`;
// "3+ years of experience", "3-5 years' commercial experience", "Experience: 5+ years",
// "a minimum of 4 years". A number of years with no experience wording nearby
// ("20 years in business") doesn't count.
const YEARS_PATTERNS = [
  new RegExp(
    String.raw`${YEARS}['’]?(?=[^.;,\n]{0,30}?\b(?:experience|exp\b|commercial|professional|industry|hands[\s-]on))`,
    'i',
  ),
  new RegExp(String.raw`\bexperience\b[^.;\n]{0,30}?${YEARS}`, 'i'),
  new RegExp(String.raw`\b(?:minimum(?:\s+of)?|at\s+least|min\.?)\s+${YEARS}`, 'i'),
];

// The company's own history, not what it asks for: "a leading MSP that has over 10
// years of experience", "With 30+ years of experience, we coach…", "over 25 years of
// experience delivering outcomes for our clients".
const ABOUT_THE_COMPANY_BEFORE = /\b(?:we(?:'ve|\s+have)?|our|company|firm|business|has)\b[^.;\n]{0,20}$/i;
const ABOUT_THE_COMPANY_AFTER =
  /^[^.;\n]{0,45}?(?:\b(?:delivering|serving|providing|helping|supporting)\b|,\s*we\b|\bwe\s+(?:are|have|coach|offer)\b)/i;

/** Jobs rarely ask for more; a bigger number is about something else. */
const MAX_YEARS = 15;

/** The years of experience a description asks for (the lower end of a range), or null. */
export const detectExperienceYears = (text: string): number | null => {
  let found: { index: number; years: number } | null = null;
  for (const pattern of YEARS_PATTERNS) {
    for (const match of text.matchAll(new RegExp(pattern.source, 'gi'))) {
      const years = parseInt(match[1], 10);
      const end = match.index + match[0].length;
      const isAboutCompany =
        ABOUT_THE_COMPANY_BEFORE.test(text.slice(Math.max(0, match.index - 40), match.index)) ||
        ABOUT_THE_COMPANY_AFTER.test(text.slice(end, end + 80));
      if (years > MAX_YEARS || isAboutCompany) continue;
      if (!found || match.index < found.index) found = { index: match.index, years };
      break;
    }
  }
  return found ? found.years : null;
};

const LEVEL_NAMES: Record<Level, string> = {
  intern: 'Intern',
  graduate: 'Graduate',
  junior: 'Junior',
  mid: 'Mid-level',
  senior: 'Senior',
  lead: 'Lead',
  unknown: 'Unknown',
};

export const detectExperienceLevel = (text: string, title = ''): ExperienceLevelResult => {
  const years = detectExperienceYears(text);

  const fromTitle = TITLE_LEVELS.find(([, pattern]) => pattern.test(title));
  if (fromTitle) {
    return {
      level: fromTitle[0],
      years,
      confidence: 'high',
      reasoning: `The title says ${LEVEL_NAMES[fromTitle[0]]}.`,
    };
  }

  const fromDescription = DESCRIPTION_LEVELS.find(([, pattern]) => pattern.test(text));
  if (fromDescription) {
    return {
      level: fromDescription[0],
      years,
      confidence: 'high',
      reasoning: `The description asks for a role at ${LEVEL_NAMES[fromDescription[0]]} level.`,
    };
  }

  if (years !== null) {
    const level: Level = years >= 5 ? 'senior' : years >= 3 ? 'mid' : 'junior';
    return { level, years, confidence: 'medium', reasoning: `Inferred ${LEVEL_NAMES[level]} from ${years}+ years.` };
  }

  return { level: 'unknown', years: null, confidence: 'low', reasoning: 'No level or years found.' };
};

export const extractTechStack = (text: string): TechStackResult => {
  const found = new Set<string>();

  TECH_KEYWORDS.forEach(tech => {
    // Escape special regex characters
    const escapedTech = tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Word boundary check, case insensitive
    // Special handling for C++ and C# and .NET which have symbols at the end or beginning
    let pattern;
    if (tech === 'C++') pattern = /C\+\+/i;
    else if (tech === 'C#') pattern = /C#/i;
    else if (tech === '.NET') pattern = /\.NET/i;
    else if (tech === 'Node.js') pattern = /Node\.js/i;
    else pattern = new RegExp(`\\b${escapedTech}\\b`, 'i');

    if (pattern.test(text)) {
      found.add(tech);
    }
  });

  return {
    technologies: Array.from(found).sort(),
    count: found.size,
  };
};

/** `title` is the job's title, which says more about the level than the description. */
export const analyzeJobDescription = (text: string, title = ''): JobAnalysisResult => {
  return {
    workArrangement: detectWorkArrangement(text),
    employmentType: detectEmploymentType(text),
    experienceLevel: detectExperienceLevel(text, title),
    techStack: extractTechStack(text),
    prDetection: detectCitizenshipRequirements(text),
  };
};
