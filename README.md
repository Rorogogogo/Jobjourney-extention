# JobJourney Browser Extension

<div align="center">

<picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/user-attachments/assets/99cb6303-64e4-4bed-bf3f-35735353e6de" />
    <source media="(prefers-color-scheme: light)" srcset="https://github.com/user-attachments/assets/a5dbf71c-c509-4c4f-80f4-be88a1943b0a" />
    <img alt="JobJourney Logo" src="https://github.com/user-attachments/assets/99cb6303-64e4-4bed-bf3f-35735353e6de" />
</picture>

![](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)
![](https://img.shields.io/badge/Typescript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![](https://badges.aleen42.com/src/vitejs.svg)
![](https://img.shields.io/badge/License-MIT-green.svg)

**Enhance your job search workflow with the JobJourney Browser Extension.**

This powerful tool integrates directly with your browser and the [JobJourney platform](https://jobjourney.me) to streamline the process of finding and tracking job opportunities by automatically gathering listing details from popular job boards.

</div>

## ⚠️ Important Disclaimers & Responsible Use

This extension utilizes web scraping techniques to collect publicly available information from job listing websites. Users must understand and agree to the following conditions:

- **Purpose of Use**: This tool is intended strictly for personal, non-commercial use to assist individual job searching efforts and for educational purposes related to web technologies and scraping techniques.
- **Commercial Use Prohibited**: Any use of this extension for commercial purposes, data resale, or any activity beyond personal job seeking and technical study is strictly prohibited.
- **Compliance with Terms of Service**: Users are solely responsible for ensuring their use of this extension complies with the terms of service of the websites they scrape (e.g., LinkedIn, Indeed, SEEK).
- **Rate Limiting & Ethical Use**: Use the search function thoughtfully; avoid excessively frequent searches. Treat the tool as a helper for your normal browsing habits, not a high-speed data harvesting engine.
- **No Liability**: This extension is provided "as is" without warranty of any kind. Users bear full responsibility for their use of the extension.

By using this extension, you acknowledge and agree to these terms and responsibilities.

## 🚀 Core Features

### Multi-Platform Scraping
Automatically gathers job listing details from:
- **LinkedIn** (linkedin.com/jobs)
- **Indeed** (various regional sites)
- **SEEK** (AU & NZ)
- **Reed** (UK)

### Rich Data Extraction
Captures key information including:
- Job Title & Company Name
- Location (including Remote/Hybrid when available)
- Salary Information (when available)
- Job Type (Full-time, Contract, etc.)
- Posted Date & Company Logo
- Job Description & Direct Link to Original Posting

### Side Panel Interface
Provides a convenient panel within your browser to:
- Initiate targeted job searches across selected platforms and locations
- View scraped job results directly in the panel
- Monitor scraping progress with real-time updates

### JobJourney Integration
- Authentication sync between extension and JobJourney web app
- Centralized job application tracking
- Sign-out functionality across all tabs
- Event-driven authentication monitoring with toast notifications

## 📦 Installation

### Prerequisites
- Chrome-based browser (Chrome, Edge, Brave, etc.)
- Node.js and pnpm (for development builds)

### Quick Setup
1. **Download**: Clone or download this repository
2. **Enable Developer Mode**: Navigate to `chrome://extensions/` and toggle "Developer mode"
3. **Load Extension**: Click "Load unpacked" and select the `dist` directory
4. **Pin Extension**: Pin the JobJourney extension icon to your toolbar for easy access

### Development Setup
```bash
# Clone the repository
git clone https://github.com/your-repo/jobjourney-extension.git
cd jobjourney-extension

# Install dependencies
npm install -g pnpm
pnpm install

# Development build (includes localhost permissions)
pnpm manifest:dev
pnpm dev

# Production build (Chrome Web Store ready)
pnpm manifest:prod
pnpm build

# Create distribution zip
pnpm build && pnpm zip
```

## 🎯 How to Use

1. **Open the Panel**: Click the JobJourney extension icon in your browser toolbar
2. **Configure Search**:
   - Enter your desired job title or keywords
   - Select target country and specific location
   - Choose job platforms (LinkedIn, Indeed, SEEK) using checkboxes
3. **Initiate Search**: Click "Search" and confirm responsible usage
4. **View Results**: Scraped jobs appear in the panel as they're found
5. **Interact with Jobs**:
   - Click "View Job" to open the original posting
   - Use "Show in JobJourney" to manage jobs in the main platform

## 🏗️ Architecture Overview

### Background Service Worker
Service-oriented architecture with dependency injection:
- **BackgroundService**: Main orchestrator
- **AuthService**: Authentication state and token management
- **ScrapingService**: Job scraping coordination
- **ApiService**: JobJourney API communications
- **StorageService**: Chrome storage abstraction
- **EventManager**: Internal pub/sub system

### Content Scripts
- Event-driven authentication monitoring
- Smart toast notification system with deduplication
- Platform-specific job data extraction
- Extension-to-frontend communication

### Environment Management
Two distinct environments with automatic manifest switching:

#### Development Environment
```bash
pnpm manifest:dev  # Switch to development manifest
pnpm dev          # Build with localhost permissions
```
- Includes localhost permissions for development servers
- Named "JobJourney Assistant (Dev)"

#### Production Environment
```bash
pnpm manifest:prod # Switch to production manifest
pnpm build        # Chrome Web Store ready build
```
- Chrome Web Store compliant
- Named "JobJourney Assistant"

## 🛠️ Development Commands

### Environment Management
```bash
pnpm manifest:dev    # Switch to development manifest
pnpm manifest:prod   # Switch to production manifest
```

### Building & Development
```bash
pnpm dev            # Development mode (Chrome)
pnpm dev:firefox    # Development mode (Firefox)
pnpm build          # Production build (Chrome)
pnpm build:firefox  # Production build (Firefox)
pnpm build && pnpm zip  # Create Chrome Web Store zip
```

### Code Quality
```bash
pnpm lint          # Run linting
pnpm lint:fix      # Fix linting issues
pnpm format        # Format code
pnpm type-check    # Type checking
```

### Testing & Management
```bash
pnpm e2e           # End-to-end tests
pnpm module-manager # Enable/disable modules
pnpm clean:bundle && pnpm build # Clean rebuild
```

## 🔒 Privacy & Security

- Extension operates locally within your browser
- Only activates scraping functions on supported job board websites
- Scrapes publicly available job listing data only
- No private user account information accessed beyond JobJourney integration
- Network requests limited to job sites and JobJourney backend

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes and test thoroughly
4. Create a Pull Request with detailed description

### Development Prerequisites
- Chrome-based browser for testing
- Node.js 18+ and pnpm
- Basic understanding of Chrome Extension APIs (Manifest V3)
- Familiarity with React, TypeScript, and Vite

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For questions, bug reports, or feature requests:
- **GitHub Issues**: [Create an Issue](https://github.com/Rorogogogo/Jobjourney-extention/issues)
- **Email**: jobjourney.au@gmail.com

## 🙏 Acknowledgments

- Built with ❤️ for job seekers and tech enthusiasts
- Thanks to all contributors and the open-source community
- Based on the Chrome Extension Boilerplate with React + Vite + TypeScript

---

**Disclaimer**: This extension is designed for personal job searching assistance and educational purposes. Please use responsibly and in compliance with job site terms of service.