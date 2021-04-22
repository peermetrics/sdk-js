import typescript from '@rollup/plugin-typescript'
import babel from '@rollup/plugin-babel'
import resolve from '@rollup/plugin-node-resolve'
import commonJS from '@rollup/plugin-commonjs'

import nodePolyfills from 'rollup-plugin-node-polyfills'
import { terser } from 'rollup-plugin-terser'

import pkg from './package.json'
import babelConfig from './.babelrc.json'

const plugins = [
  nodePolyfills(),
  resolve(),
  commonJS({
    include: 'node_modules/**'
  }),
  typescript()
]

export default [{
  input: 'src/index.js',
  output: [
    {
      file: 'dist/browser.js',
      name: 'window',
      format: 'iife',
      extend: true
    },
    {
      file: 'dist/browser.min.js',
      format: 'iife',
      name: 'window',
      extend: true,
      plugins: [
        babel({
          ...babelConfig,
          babelHelpers: 'runtime'
        }),
        terser()
      ]
    },
    {
      file: pkg.main,
      format: 'cjs'
    }
  ],
  plugins: plugins
}]
