import { analyzeJobDescription } from './descriptionAnalysis';

const testCases = [
  {
    name: 'User Example',
    text: `About the job
About Step One

StepOne is an ASX-listed e-commerce company operating across Australia, United Kingdom and United States. With $84.5M in sales last FY, we combine technology, AI, and data-driven growth strategies to reshape how e-commerce brands scale. 

Our Sydney office brings together marketing, production, and engineering teams under one roof, delivering daily deployments and measurable business impact.

The Opportunity

We’re seeking a sharp, entrepreneurial Growth Engineer to join our Ecommerce team. Reporting to the Head of Engineering & CRO, you’ll build growth-focused software, enhance interactive customer experiences, and deliver projects that directly impact business metrics across CRM, CRO, and analytics.

This is a hands-on role perfect for engineers who thrive in fast-paced, startup-like environments and want to see their work make a visible commercial impact. We are looking for a self motivated engineer who can ideate and execute revenue moving projects.

What You’ll Do

Develop and maintain growth-oriented features across our e-commerce stack using Shopify Liquid, JavaScript, HTML/CSS.
Lead end-to-end web development initiatives, including AI-driven personalisation tools.
Collaborate daily with marketing, design, and data teams in an agile, cross-functional environment.
Think strategically about building for scale and seeing into the future business needs.
Enhance analytics and automation through GCP, BigQuery, and CRM/CRO systems.
Take ownership of projects from idea to implementation, driving user engagement and revenue outcomes.

About You

Proven success in small or fast-paced teams where you’ve led end-to-end development and executed impactful features or platform launches.
Strong background in web development or software architecture in e-commerce
Proficiency in JavaScript, Shopify Liquid, HTML/CSS.
Exposure to AI integrations, data analytics, or automation tools is a plus.
Entrepreneurial mindset, self-sufficient, outcome-driven, experimental, and strong collaborator.

Why Join StepOne

Work in a profitable, ASX-listed company with mentorship from experienced engineering leaders.
Collaborate in a flat, fast-moving culture without red tape.
Deliver work seen by thousands of customers daily across high-traffic e-commerce channels.
Access clear career progression and global collaboration opportunities with our London office.

Requirements

Must be based in Sydney with full working rights.
Must be able to work full-time in our Surry Hills office.`,
    expected: {
      workArrangement: 'on-site',
      employmentType: 'full-time',
      experienceLevel: 'unknown', // No explicit level mentioned, though "Growth Engineer" implies mid/senior
      techStackCount: 5,
    },
  },
  {
    name: 'Remote Contract',
    text: `We are looking for a Senior React Developer for a 6-month contract. This is a fully remote role. You must have experience with React, Redux, and TypeScript.`,
    expected: {
      workArrangement: 'remote',
      employmentType: 'contract',
      experienceLevel: 'senior',
      techStackCount: 3,
    },
  },
  {
    name: 'Hybrid Permanent',
    text: `Join our team as a Permanent Full Time Software Engineer. We offer a flexible hybrid working model (2 days in office). Tech stack: Java, Spring Boot, AWS. 5+ years experience required.`,
    expected: {
      workArrangement: 'hybrid',
      employmentType: 'full-time',
      experienceLevel: 'senior', // Inferred from 5+ years
      techStackCount: 3,
    },
  },
  {
    name: 'Junior Role',
    text: `Junior Developer needed. 1 year experience.`,
    expected: {
      workArrangement: 'unknown',
      employmentType: 'unknown',
      experienceLevel: 'junior',
      techStackCount: 0,
    },
  },
];

console.log('Running Enhanced Job Analysis Verification...\n');

testCases.forEach(test => {
  console.log(`--- Testing: ${test.name} ---`);
  const result = analyzeJobDescription(test.text);

  console.log('Work Arrangement:', result.workArrangement);
  console.log('Employment Type:', result.employmentType);
  console.log('Experience Level:', result.experienceLevel);
  console.log('Tech Stack:', result.techStack);

  // Basic assertions
  const waMatch = result.workArrangement.type === test.expected.workArrangement;
  const etMatch = result.employmentType.type === test.expected.employmentType;
  const elMatch = result.experienceLevel.level === test.expected.experienceLevel;
  const tsMatch = result.techStack.count >= test.expected.techStackCount;

  if (waMatch && etMatch && elMatch && tsMatch) {
    console.log('✅ PASS');
  } else {
    console.log('❌ FAIL');
    if (!waMatch)
      console.log(`  Expected Work Arrangement: ${test.expected.workArrangement}, Got: ${result.workArrangement.type}`);
    if (!etMatch)
      console.log(`  Expected Employment Type: ${test.expected.employmentType}, Got: ${result.employmentType.type}`);
    if (!elMatch)
      console.log(
        `  Expected Experience Level: ${test.expected.experienceLevel}, Got: ${result.experienceLevel.level}`,
      );
    if (!tsMatch)
      console.log(`  Expected Tech Stack Count >= ${test.expected.techStackCount}, Got: ${result.techStack.count}`);
  }
  console.log('\n');
});
