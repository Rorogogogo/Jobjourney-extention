# JobJourney Browser Extension

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/Rorogogogo/Jobjourney-extention/blob/main/LICENSE)
[![GitHub Issues](https://img.shields.io/github/issues/Rorogogogo/Jobjourney-extention)](https://github.com/Rorogogogo/Jobjourney-extention/issues)

**Enhance your job search workflow with the JobJourney Browser Extension.**

This powerful tool integrates directly with your browser and the [JobJourney](https://jobjourney.me/) platform (Note: main platform link provided, adjust if needed). It helps streamline the process of finding and tracking job opportunities by automatically gathering listing details from popular job boards.

The primary goal of this extension is to serve as a **personal assistant for job seekers** and as a **tool for technical study and educational purposes**.

## ⚠️ Important Disclaimers & Responsible Use

This extension utilizes web scraping techniques to collect publicly available information from job listing websites. Users must understand and agree to the following conditions:

1. **Purpose of Use**: This tool is intended **strictly for personal, non-commercial use** to assist individual job searching efforts and for **educational purposes** related to web technologies and scraping techniques.
2. **Commercial Use Prohibited**: Any use of this extension for commercial purposes, data resale, or any activity beyond personal job seeking and technical study is **strictly prohibited**. Users engaging in such activities do so **at their own risk and assume all responsibility** for their actions.
3. **Compliance with Terms of Service**: Users are **solely responsible** for ensuring their use of this extension complies with the terms of service of the websites they scrape (e.g., LinkedIn, Indeed, SEEK). Excessive or abusive scraping can violate these terms.
4. **Rate Limiting & Ethical Use**: To maintain respectful interaction with job sites and avoid potential temporary blocks:
   - Use the search function thoughtfully; avoid excessively frequent searches (e.g., multiple full searches within a few minutes).
   - Do not use automated tools to interact with this extension in rapid succession.
   - Treat the tool as a helper for your normal browsing habits, not a high-speed data harvesting engine.
5. **Data Accuracy**: While the extension strives for accuracy, scraped data reflects the information publicly available at the time of scraping. Job listings can change or be removed. **Always verify details on the original job posting.** The creators cannot guarantee 100% accuracy or completeness of the data.
6. **Website Changes**: Job platforms frequently update their website structure. These changes may temporarily break the extension's scraping functionality. Updates will be released to address compatibility issues, but delays may occur. Please report any broken functionality.
7. **No Liability**: This extension is provided "as is" without warranty of any kind. The creators and maintainers assume **no liability** for any misuse of this tool, any violation of third-party terms of service by the user, any consequences arising from the use of scraped data, or any damages resulting from the use or inability to use this software. **Users bear full responsibility for their use of the extension.**

By using this extension, you acknowledge and agree to these terms and responsibilities.

## Core Features

- **Multi-Platform Scraping**: Automatically gathers job listing details from:
  - LinkedIn
  - Indeed (various regional sites)
  - SEEK (AU & NZ)
- **Rich Data Extraction**: Captures key information including:
  - Job Title
  - Company Name
  - Location (including Workplace Type like Remote/Hybrid when available)
  - Salary Information (when available)
  - Job Type (Full-time, Contract, etc.)
  - Posted Date
  - Company Logo
  - Job Description Snippets/Details
  - Direct Link to the Original Job Posting
- **Side Panel Interface**: Provides a convenient panel within your browser to:
  - Initiate targeted job searches across selected platforms and locations.
  - View scraped job results directly in the panel.
  - Monitor scraping progress.
- **JobJourney Integration**: (Requires connection to the main JobJourney application)
  - Potentially syncs scraped jobs to your JobJourney dashboard.
  - Helps centralize your job application tracking.

## Installation

1. **Download**: Obtain the extension files (e.g., download or clone this repository).
2. **Enable Developer Mode**: Open your Chrome-based browser, navigate to `chrome://extensions/`.
3. **Activate**: Toggle on "Developer mode" (usually in the top-right corner).
4. **Load Extension**: Click "Load unpacked" and select the directory containing the extension's `manifest.json` file.
5. **Pin (Optional)**: Pin the JobJourney extension icon to your toolbar for easy access.

## How to Use

1. **Open the Panel**: Click the JobJourney extension icon in your browser toolbar to open the side panel.
2. **Configure Search**:
   - Enter your desired job title or keywords in the search input.
   - Select the target country.
   - Select the specific location within that country.
   - Choose the job platforms (LinkedIn, Indeed, SEEK) you want to search on using the checkboxes.
3. **Initiate Search**: Click the "Search" button.
   - A confirmation prompt will appear reminding you about responsible usage.
   - If confirmed, the extension will open new browser windows for each selected platform and begin scraping. You will see progress updates in the panel.
4. **View Results**: Scraped jobs will appear in the panel's job list as they are found.
5. **Interact with Jobs**:
   - Click "View Job" on a card to open the original job posting in a new tab.
   - Use the "Show in JobJourney" button (if applicable and integrated) to manage the collected jobs in the main platform.

## Supported Platforms

- LinkedIn ([linkedin.com/jobs](https://www.linkedin.com/jobs/))
- Indeed (various domains like [indeed.com](https://www.indeed.com/), [au.indeed.com](https://au.indeed.com/), [uk.indeed.com](https://uk.indeed.com/), etc.)
- SEEK ([seek.com.au](https://www.seek.com.au/), [seek.co.nz](https://www.seek.co.nz/))

_Note: Platform compatibility depends on the current website structure and may require updates._

## Privacy & Security

- The extension primarily operates locally within your browser.
- It only activates its core scraping functions on the supported job board websites.
- It scrapes publicly available job listing data. No private user account information is accessed or stored beyond what's necessary for interacting with the JobJourney platform (if integrated).
- Network requests are made to the job sites for scraping and potentially to the JobJourney backend for syncing (if integrated).

## Development

Contributions are welcome!

### Prerequisites

- A Chrome-based Browser (Chrome, Edge, Brave, etc.)
- Node.js and npm (optional, for potential build steps or linting if added later)
- Basic understanding of HTML, CSS, JavaScript, and Browser Extension APIs (Manifest V3).

### Getting Started

1. Fork the repository.
2. Clone your fork locally.
3. Load the extension into your browser using "Load unpacked" as described in the Installation section.
4. Make your changes.
5. Test thoroughly.
6. Create a Pull Request back to the main repository.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For questions, bug reports, or feature requests:

- Create an [Issue](https://github.com/Rorogogogo/Jobjourney-extention/issues) on GitHub.
- Email: **jobjourney.au@gmail.com**

## Acknowledgments

- Thanks to all contributors.
- Built with ❤️ for job seekers and tech enthusiasts.
