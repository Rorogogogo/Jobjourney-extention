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

export const detectWorkArrangement = (text: string): WorkArrangementResult => {
  const lowerText = text.toLowerCase();

  // Remote
  if (/\b(remote|work from home|wfh|fully remote)\b/i.test(text)) {
    // Check for "no remote" or "not remote"
    if (!/\b(no|not|non)\s+(remote|work from home|wfh)\b/i.test(text)) {
      return { type: 'remote', confidence: 'high', reasoning: 'Explicitly mentions remote work.' };
    }
  }

  // Hybrid
  if (/\b(hybrid|flexible work|mix of home and office|days? in office)\b/i.test(text)) {
    return { type: 'hybrid', confidence: 'high', reasoning: 'Explicitly mentions hybrid work.' };
  }

  // On-site
  if (/\b(on-site|in-office|work from office|must be based in|office based)\b/i.test(text)) {
    return { type: 'on-site', confidence: 'high', reasoning: 'Explicitly mentions on-site/office work.' };
  }

  // Fallback heuristics
  if (lowerText.includes('office') && !lowerText.includes('remote')) {
    return { type: 'on-site', confidence: 'medium', reasoning: 'Mentions office without remote context.' };
  }

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
  ['senior', /\b(senior|sr\.?|principal|staff)\b/i],
  [
    'lead',
    /\b(lead|head\s+of|director|vp|vice\s+president|(?:engineering|development|delivery|technology)\s+manager)\b/i,
  ],
  ['mid', /\b(mid[\s-]level|intermediate)\b/i],
];

// A description mentions "senior stakeholders", "graduate degree" or "reporting to the
// Head of…" without saying anything about the role, so only phrases about the role count.
const DESCRIPTION_LEVELS: Array<[Level, RegExp]> = [
  ['intern', /\b(internship|intern\s+(?:program|programme|role|position))\b/i],
  ['graduate', /\bgraduate\s+(?:program|programme|role|position|opportunity|engineer|developer|analyst|consultant)\b/i],
  [
    'junior',
    /\b(?:entry[\s-]level|junior\s+(?:level|role|position|engineer|developer|analyst|designer|consultant))\b/i,
  ],
  [
    'senior',
    /\b(?:senior|sr\.?)\s+(?:level|role|position|engineer|developer|analyst|designer|consultant|architect|[a-z]+\s+(?:engineer|developer))\b/i,
  ],
  ['mid', /\b(mid[\s-]level|intermediate)\b/i],
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

/** The years of experience a description asks for (the lower end of a range), or null. */
export const detectExperienceYears = (text: string): number | null => {
  let found: { index: number; years: number } | null = null;
  for (const pattern of YEARS_PATTERNS) {
    const match = pattern.exec(text);
    if (match && (!found || match.index < found.index)) {
      found = { index: match.index, years: parseInt(match[1], 10) };
    }
  }
  return found && found.years <= 30 ? found.years : null;
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
      reasoning: `The description asks for a ${LEVEL_NAMES[fromDescription[0]]} role.`,
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
