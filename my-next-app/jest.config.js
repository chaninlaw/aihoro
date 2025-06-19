const nextJest = require('next/jest')

// Providing the path to your Next.js app which will enable loading next.config.js and .env files
const createJestConfig = nextJest({ dir: './' })

// Any custom config you want to pass to Jest
const customJestConfig = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
  moduleNameMapper: {
    // Handle CSS imports (if any - Next.js handles this differently with next/jest)
    // '\\.(css|less|scss|sass)$': 'identity-obj-proxy', // Usually not needed with next/jest for CSS Modules

    // Handle image imports
    '\\.(gif|ttf|eot|svg|png)$': '<rootDir>/__mocks__/fileMock.js',

    // Handle module aliases (if configured in tsconfig.json)
    // Next/jest should handle tsconfig.paths automatically.
    // '^@/components/(.*)$': '<rootDir>/components/$1', // Example, if not picked up automatically
    // '^@/lib/(.*)$': '<rootDir>/lib/$1',
  },
  // If you're using TypeScript, next/jest will take care of the transform
  // clearMocks: true, // This is a good default
}

// createJestConfig is exported in this way to ensure that next/jest can load the Next.js configuration, which is async
module.exports = createJestConfig(customJestConfig)
