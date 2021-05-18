import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';
import builtins from 'rollup-plugin-node-builtins';
import scss from 'rollup-plugin-scss';
import copy from 'rollup-plugin-copy';

// `npm run build` -> `production` is true
// `npm run dev` -> `production` is false
const production = !process.env.ROLLUP_WATCH;

export default {
	input: 'src/main.js',
	output: {
		file: 'public/bundle.js',
		format: 'iife', // immediately-invoked function expression — suitable for <script> tags
		sourcemap: true
	},
	plugins: [
		resolve({
			preferBuiltins: false,
		}), // tells Rollup how to find date-fns in node_modules
		replace({
			preventAssignment: true,
			'process.env': JSON.stringify({
				isProd: production,
				host: 'padington.herokuapp.com'
			}),
		}),
		commonjs(), // converts date-fns to ES modules
		production && terser(), // minify, but only in production
		scss(),
		json(),
		builtins(),
		copy({
			targets: [{
				src: 'node_modules/@fortawesome/fontawesome-free/webfonts/fa-solid-*',
				dest: 'public/webfonts'
			}]
		})
	]
};
