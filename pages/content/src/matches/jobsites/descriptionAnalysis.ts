import { detectCitizenshipRequirements, type CitizenshipRequirementResult } from './prDetection';

export interface WorkArrangementResult {
  type: 'remote' | 'hybrid' | 'on-site' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface EmploymentTypeResult {
  type: 'full-time' | 'contract' | 'part-time' | 'casual' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface TechStackResult {
  technologies: string[];
  count: number;
}

export interface ExperienceLevelResult {
  level: 'senior' | 'mid' | 'junior' | 'lead' | 'graduate' | 'intern' | 'unknown';
  years: number | null;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface JobAnalysisResult {
  workArrangement: WorkArrangementResult;
  employmentType: EmploymentTypeResult;
  experienceLevel: ExperienceLevelResult;
  techStack: TechStackResult;
  prDetection: CitizenshipRequirementResult;
}

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
  const lowerText = text.toLowerCase();

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

export const detectExperienceLevel = (text: string): ExperienceLevelResult => {
  const lowerText = text.toLowerCase();
  let level: ExperienceLevelResult['level'] = 'unknown';
  let years: number | null = null;
  let confidence: ExperienceLevelResult['confidence'] = 'low';
  let reasoning = '';

  // Detect years of experience
  const yearsMatch = text.match(/(\d+)(\+)?\s*(?:-\s*\d+\s*)?years?/i);
  if (yearsMatch) {
    years = parseInt(yearsMatch[1], 10);
  }

  // Detect level keywords
  // Senior
  if (/\b(senior|sr\.?|principal|staff\s+(?:engineer|developer|software))\b/i.test(text)) {
    level = 'senior';
    confidence = 'high';
    reasoning = 'Explicitly mentions Senior/Principal/Staff role.';
  }
  // Lead / Manager
  else if (
    /\b((?:team|tech|technical|engineering|product)\s+lead|lead\s+(?:developer|engineer|designer|data)|manager|head\s+of|director|vp)\b/i.test(
      text,
    )
  ) {
    // Check if it says "Reporting to..." which might trigger false positives for "Head of" etc.
    // This is a simple check, might need more robust context analysis later
    if (!/reporting\s+to\s+(?:the\s+)?(?:head\s+of|director|vp|manager)/i.test(text)) {
      level = 'lead';
      confidence = 'high';
      reasoning = 'Explicitly mentions Lead/Manager/Director role.';
    }
  }
  // Junior / Entry
  else if (/\b(junior|jr\.?|entry\s+level|entry-level)\b/i.test(text)) {
    level = 'junior';
    confidence = 'high';
    reasoning = 'Explicitly mentions Junior/Entry Level.';
  }
  // Graduate
  else if (/\b(graduate|grad)\b/i.test(text)) {
    level = 'graduate';
    confidence = 'high';
    reasoning = 'Explicitly mentions Graduate.';
  }
  // Intern
  else if (/\b(intern|internship)\b/i.test(text)) {
    level = 'intern';
    confidence = 'high';
    reasoning = 'Explicitly mentions Intern.';
  }
  // Mid-level
  else if (/\b(mid-level|mid\s+level|intermediate)\b/i.test(text)) {
    level = 'mid';
    confidence = 'high';
    reasoning = 'Explicitly mentions Mid-level.';
  } else {
    // Heuristics based on years
    if (years !== null) {
      if (years >= 5) {
        level = 'senior';
        confidence = 'medium';
        reasoning = `Inferred Senior from ${years}+ years experience.`;
      } else if (years >= 3) {
        level = 'mid';
        confidence = 'medium';
        reasoning = `Inferred Mid-level from ${years}+ years experience.`;
      } else if (years >= 0) {
        level = 'junior';
        confidence = 'medium';
        reasoning = `Inferred Junior from ${years} years experience.`;
      }
    }
  }

  return { level, years, confidence, reasoning };
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

export const analyzeJobDescription = (text: string): JobAnalysisResult => {
  return {
    workArrangement: detectWorkArrangement(text),
    employmentType: detectEmploymentType(text),
    experienceLevel: detectExperienceLevel(text),
    techStack: extractTechStack(text),
    prDetection: detectCitizenshipRequirements(text),
  };
};
