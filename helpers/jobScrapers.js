class Job {
  constructor({
    title,
    company,
    location,
    jobUrl,
    description = '',
    salary = '',
    postedDate = '',
    companyLogoUrl = null,
    platform,
    jobType = '',
    workplaceType = '',
    applicantCount = ''
  }) {
    this.title = title?.trim() || ''
    this.company = company?.trim() || ''
    this.location = location?.trim() || ''
    this.jobUrl = jobUrl || ''
    this.description = description?.trim() || ''
    this.salary = salary?.trim() || ''
    this.postedDate = postedDate?.trim() || ''
    this.companyLogoUrl = companyLogoUrl || null
    this.platform = platform || ''
    this.jobType = jobType?.trim() || ''
    this.workplaceType = workplaceType?.trim() || ''
    this.applicantCount = applicantCount?.trim() || ''
  }

  static createFromLinkedIn (data) {
    return new Job({
      title: data.title,
      company: data.company,
      location: data.location,
      jobUrl: data.jobUrl,
      description: data.description,
      salary: data.salary,
      postedDate: data.postedDate,
      companyLogoUrl: data.companyLogoUrl,
      platform: 'LinkedIn',
      jobType: data.jobType || '',
      workplaceType: data.workplaceType || '',
      applicantCount: data.applicantCount || ''
    })
  }

  static createFromSEEK (data) {
    return new Job({
      title: data.title,
      company: data.company,
      location: data.location,
      jobUrl: data.jobUrl,
      description: data.description,
      salary: data.salary,
      postedDate: data.postedDate,
      companyLogoUrl: data.companyLogoUrl,
      platform: 'SEEK',
      jobType: data.jobType || '',
      workplaceType: data.workplaceType || '',
      applicantCount: data.applicantCount || ''
    })
  }

  static createFromIndeed (data) {
    return new Job({
      title: data.title,
      company: data.company,
      location: data.location,
      jobUrl: data.jobUrl,
      description: data.description,
      salary: data.salary,
      postedDate: data.postedDate,
      companyLogoUrl: data.companyLogoUrl,
      platform: 'Indeed',
      jobType: data.jobType || '',
      workplaceType: data.workplaceType || '',
      applicantCount: data.applicantCount || ''
    })
  }
}

// Job scraping functions for different platforms
// const scrapers = {
//   // LinkedIn, SEEK, Indeed logic removed - now in separate files
// }

// Export the Job class to make it available globally
window.Job = Job
// window.scrapers = scrapers // Removed as scrapers object is now empty/unnecessary 