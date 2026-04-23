/**
 * Jest config for PeerMetrics SDK unit tests.
 *
 * Uses ts-jest to match the TypeScript semantics rollup-plugin-ts applies at
 * build time (e.g. proper handling of `import type` / `export type` aliases).
 * JS files (e.g. dependencies in node_modules if ever needed) go through
 * babel-jest with a minimal test-only config to avoid the build-time `minify`
 * preset declared in .babelrc.json.
 */
module.exports = {
  testEnvironment: 'jsdom',
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.(ts|js)',
    '<rootDir>/src/**/*.test.(ts|js)'
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'es2019',
          module: 'commonjs',
          moduleResolution: 'node',
          esModuleInterop: true,
          allowJs: true,
          isolatedModules: true,
          lib: ['es2019', 'dom'],
          // Match the loose posture the source expects (rollup build is also not in strict mode)
          strict: false,
          types: ['jest', 'node']
        },
        diagnostics: false,
        isolatedModules: true
      }
    ],
    '^.+\\.jsx?$': [
      'babel-jest',
      {
        presets: [
          ['@babel/env', { targets: { node: 'current' } }]
        ],
        plugins: [['@babel/transform-runtime']],
        babelrc: false,
        configFile: false
      }
    ]
  },
  clearMocks: true,
  restoreMocks: true,
  testTimeout: 10000
}
