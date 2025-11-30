# Test Error Aggregation for AI Analysis

This repository is configured to output test errors in JSON format for AI-assisted debugging.

## How It Works

1. **JSON Reporter**: WebDriverIO is configured with a JSON reporter that outputs test results to `tests/e2e/test-results/`
2. **Artifact Upload**: GitHub Actions automatically uploads test result JSON files as artifacts (even on failure)
3. **Aggregation Script**: Use the aggregation script to combine all errors into a single AI-friendly JSON file

## Local Usage

### Run tests locally
```bash
pnpm e2e              # Chrome
pnpm e2e:firefox      # Firefox
```

### Aggregate test errors for AI analysis
```bash
pnpm aggregate-errors
```

This will create `aggregated-test-errors.json` with a structure like:

```json
{
  "timestamp": "2025-11-30T01:28:00.000Z",
  "totalFiles": 2,
  "summary": {
    "totalTests": 15,
    "passed": 12,
    "failed": 3,
    "skipped": 0
  },
  "errors": [
    {
      "file": "test-results-0-0.json",
      "test": "Content Script - should inject button",
      "error": "Element not found: .save-button",
      "stack": "..."
    }
  ],
  "failedTests": [...]
}
```

## CI/CD Usage

When tests run in GitHub Actions:

1. Go to the **Actions** tab in your repository
2. Click on the failed workflow run
3. Scroll to **Artifacts** section at the bottom
4. Download artifacts named:
   - `test-results-chrome-<scenario>`
   - `test-results-firefox-<scenario>`

### Download and aggregate all errors

```bash
# Download all artifacts to a local directory
# (manually or using GitHub CLI)

# Run the aggregation script
pnpm aggregate-errors --output ci-errors.json
```

### Feed to AI for batch fixing

Once you have `aggregated-test-errors.json` or `ci-errors.json`:

```bash
# Example: Feed to AI assistant
cat aggregated-test-errors.json | your-ai-tool
```

Or upload the JSON file directly to your AI assistant for analysis and batch fixing suggestions.

## Benefits

- **Structured errors**: All errors in a consistent JSON format
- **Batch fixing**: Fix multiple related errors at once with AI assistance
- **Pattern detection**: AI can identify common error patterns across tests
- **Retention**: Test results are kept for 30 days in GitHub Actions artifacts
- **Always captured**: Artifacts are uploaded even when tests fail (`if: always()`)

## Files Modified

- [`tests/e2e/config/wdio.conf.ts`](../tests/e2e/config/wdio.conf.ts) - Added JSON reporter
- [`tests/e2e/package.json`](../tests/e2e/package.json) - Added `@wdio/json-reporter` dependency
- [`.github/workflows/e2e-modular.yml`](../.github/workflows/e2e-modular.yml) - Added artifact upload
- [`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml) - Added artifact upload
- [`scripts/aggregate-test-errors.mjs`](../scripts/aggregate-test-errors.mjs) - Aggregation utility
- [`.gitignore`](../.gitignore) - Excluded `test-results/` directory
