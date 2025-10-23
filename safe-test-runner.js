#!/usr/bin/env node

/**
 * Safe Test Runner - job-finder-BE
 * 
 * Prevents test explosions through process locking and resource control.
 * This is the ONLY way to run tests in this repository.
 */

const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const chalk = require('chalk').default

// Configuration
const LOCK_FILE = path.join(__dirname, '.test-lock')
const MAX_MEMORY_MB = 2048 // 2GB max memory
const MAX_EXECUTION_TIME = 10 * 60 * 1000 // 10 minutes

class SafeTestRunner {
  constructor() {
    this.startTime = Date.now()
    this.lockAcquired = false
  }

  /**
   * Acquire execution lock to prevent concurrent test runs
   */
  acquireLock() {
    if (fs.existsSync(LOCK_FILE)) {
      const lockData = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'))
      const lockAge = Date.now() - new Date(lockData.startTime).getTime()
      
      // If lock is older than 15 minutes, consider it stale
      if (lockAge > 15 * 60 * 1000) {
        console.log(chalk.yellow('⚠️  Removing stale lock file'))
        fs.unlinkSync(LOCK_FILE)
      } else {
        console.error(chalk.red('❌ Another test process is already running'))
        console.error(chalk.red('   PID: ' + lockData.pid))
        console.error(chalk.red('   Started: ' + lockData.startTime))
        process.exit(1)
      }
    }

    // Create lock file
    const lockData = {
      pid: process.pid,
      startTime: new Date().toISOString(),
      repository: 'job-finder-BE',
      testSuite: 'unit'
    }
    
    fs.writeFileSync(LOCK_FILE, JSON.stringify(lockData, null, 2))
    this.lockAcquired = true
    console.log(chalk.green('🔒 Test execution lock acquired'))
  }

  /**
   * Release execution lock
   */
  releaseLock() {
    if (this.lockAcquired && fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE)
      console.log(chalk.green('🔓 Test execution lock released'))
    }
  }

  /**
   * Monitor system resources during test execution
   */
  startResourceMonitoring() {
    const monitorInterval = setInterval(() => {
      const memUsage = process.memoryUsage()
      const memUsageMB = memUsage.heapUsed / 1024 / 1024
      const executionTime = Date.now() - this.startTime

      // Check memory usage
      if (memUsageMB > MAX_MEMORY_MB) {
        console.error(chalk.red('\n⚠️  CRITICAL: Memory usage exceeded ' + MAX_MEMORY_MB + 'MB'))
        console.error(chalk.red('Current usage: ' + memUsageMB.toFixed(1) + 'MB'))
        this.terminateTests()
        process.exit(1)
      }

      // Check execution time
      if (executionTime > MAX_EXECUTION_TIME) {
        console.error(chalk.red('\n⚠️  CRITICAL: Test execution exceeded ' + (MAX_EXECUTION_TIME / 1000) + 's'))
        this.terminateTests()
        process.exit(1)
      }

      // Log status every 30 seconds
      if (executionTime % 30000 < 1000) {
        console.log(chalk.gray('[Monitor] Memory: ' + memUsageMB.toFixed(1) + 'MB | Time: ' + (executionTime / 1000).toFixed(1) + 's'))
      }
    }, 1000)

    // Store interval for cleanup
    this.monitorInterval = monitorInterval
  }

  /**
   * Stop resource monitoring
   */
  stopResourceMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval)
      this.monitorInterval = null
    }
  }

  /**
   * Terminate all test processes
   */
  terminateTests() {
    console.log(chalk.red('\n🛑 Terminating test processes...'))
    try {
      if (process.platform === 'win32') {
        require('child_process').execSync('taskkill /F /IM vitest* /T', { stdio: 'inherit' })
      } else {
        require('child_process').execSync('pkill -9 -f vitest', { stdio: 'inherit' })
      }
    } catch (error) {
      console.log(chalk.yellow('No test processes to terminate'))
    }
  }

  /**
   * Run tests using the safe configuration
   */
  async runTests() {
    return new Promise((resolve) => {
      console.log(chalk.cyan('\n🧪 Running tests...'))
      
      const [cmd, ...args] = 'vitest run'.split(' ')
      const testProcess = spawn(cmd, args, {
        stdio: 'inherit',
        shell: process.platform === 'win32',
        env: { 
          ...process.env, 
          NODE_OPTIONS: '--max-old-space-size=2048' 
        }
      })

      testProcess.on('close', (code) => {
        if (code === 0) {
          console.log(chalk.green('✅ Tests completed successfully'))
          resolve(true)
        } else {
          console.log(chalk.red('❌ Tests failed (exit code: ' + code + ')'))
          resolve(false)
        }
      })

      testProcess.on('error', (error) => {
        console.error(chalk.red('Error running tests:'), error)
        resolve(false)
      })
    })
  }

  /**
   * Main execution
   */
  async run() {
    console.log(chalk.bold.cyan('\n🛡️  Safe Test Runner - job-finder-BE\n'))
    
    try {
      // Acquire lock
      this.acquireLock()
      
      // Start monitoring
      this.startResourceMonitoring()
      
      // Run tests
      const success = await this.runTests()
      
      // Cleanup
      this.stopResourceMonitoring()
      this.releaseLock()
      
      // Exit with appropriate code
      process.exit(success ? 0 : 1)
      
    } catch (error) {
      console.error(chalk.red('Fatal error:'), error)
      this.stopResourceMonitoring()
      this.releaseLock()
      process.exit(1)
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\nReceived SIGINT, cleaning up...'))
  const runner = new SafeTestRunner()
  runner.terminateTests()
  runner.releaseLock()
  process.exit(130)
})

process.on('SIGTERM', () => {
  console.log(chalk.yellow('\n\nReceived SIGTERM, cleaning up...'))
  const runner = new SafeTestRunner()
  runner.terminateTests()
  runner.releaseLock()
  process.exit(143)
})

// Run the test runner
const runner = new SafeTestRunner()
runner.run().catch((error) => {
  console.error(chalk.red('Fatal error:'), error)
  process.exit(1)
})
