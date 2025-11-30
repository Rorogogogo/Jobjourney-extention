#!/usr/bin/env node

/**
 * Aggregate Test Errors for AI Analysis
 * 
 * This script reads all JSON test result files and aggregates errors
 * into a single JSON file that can be fed to AI for batch fixing.
 * 
 * Usage:
 *   node scripts/aggregate-test-errors.mjs
 *   node scripts/aggregate-test-errors.mjs --output errors.json
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const TEST_RESULTS_DIR = 'tests/e2e/test-results'
const DEFAULT_OUTPUT = 'aggregated-test-errors.json'

async function aggregateTestErrors (outputFile = DEFAULT_OUTPUT) {
  try {
    const files = await readdir(TEST_RESULTS_DIR)
    const jsonFiles = files.filter(f => f.endsWith('.json'))

    if (jsonFiles.length === 0) {
      console.log('✅ No test result files found. Either tests passed or haven\'t run yet.')
      return
    }

    const aggregatedErrors = {
      timestamp: new Date().toISOString(),
      totalFiles: jsonFiles.length,
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
      },
      errors: [],
      failedTests: [],
    }

    for (const file of jsonFiles) {
      const filePath = join(TEST_RESULTS_DIR, file)
      const content = await readFile(filePath, 'utf-8')
      const testResult = JSON.parse(content)

      // Extract test statistics
      if (testResult.stats) {
        aggregatedErrors.summary.totalTests += testResult.stats.tests || 0
        aggregatedErrors.summary.passed += testResult.stats.passes || 0
        aggregatedErrors.summary.failed += testResult.stats.failures || 0
        aggregatedErrors.summary.skipped += testResult.stats.skipped || 0
      }

      // Extract failed tests with full context
      if (testResult.suites) {
        extractFailuresFromSuites(testResult.suites, aggregatedErrors, file)
      }
    }

    // Write aggregated results
    await writeFile(outputFile, JSON.stringify(aggregatedErrors, null, 2))

    console.log('\n📊 Test Results Summary:')
    console.log(`   Total Tests: ${aggregatedErrors.summary.totalTests}`)
    console.log(`   ✅ Passed: ${aggregatedErrors.summary.passed}`)
    console.log(`   ❌ Failed: ${aggregatedErrors.summary.failed}`)
    console.log(`   ⏭️  Skipped: ${aggregatedErrors.summary.skipped}`)
    console.log(`\n📁 Aggregated errors saved to: ${outputFile}`)
    console.log(`\n💡 Feed this file to AI for batch fixing!`)

    if (aggregatedErrors.summary.failed > 0) {
      process.exit(1)
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('✅ No test-results directory found. Tests may have passed or not run yet.')
      return
    }
    console.error('❌ Error aggregating test results:', error)
    process.exit(1)
  }
}

function extractFailuresFromSuites (suites, aggregated, sourceFile) {
  for (const suite of suites) {
    // Check tests in this suite
    if (suite.tests) {
      for (const test of suite.tests) {
        if (test.state === 'failed') {
          aggregated.failedTests.push({
            sourceFile,
            suite: suite.title,
            test: test.title,
            error: test.error?.message || 'No error message',
            stack: test.error?.stack || '',
            duration: test.duration,
            fullTitle: test.fullTitle || `${suite.title} - ${test.title}`,
          })

          // Also add to simplified errors array for AI
          aggregated.errors.push({
            file: sourceFile,
            test: test.fullTitle || test.title,
            error: test.error?.message || 'No error message',
            stack: test.error?.stack,
          })
        }
      }
    }

    // Recursively check nested suites
    if (suite.suites && suite.suites.length > 0) {
      extractFailuresFromSuites(suite.suites, aggregated, sourceFile)
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const outputIndex = args.indexOf('--output')
const outputFile = outputIndex !== -1 ? args[outputIndex + 1] : DEFAULT_OUTPUT

aggregateTestErrors(outputFile)
