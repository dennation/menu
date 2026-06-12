import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
	build: {
		target: 'esnext',
		lib: {
			entry: {
				'index': resolve(__dirname, 'src/index.ts'),
				'react/index': resolve(__dirname, 'src/react/index.ts'),
				'tanstack-router/index': resolve(__dirname, 'src/tanstack-router/index.ts'),
			},
			formats: ['es'],
		},
		rollupOptions: {
			external: [
				'react',
				'react-dom',
				'react/jsx-runtime',
				/^node:/,
				/^@tanstack\//,
			],
			output: {
				entryFileNames: '[name].mjs',
				chunkFileNames: '[name]-[hash].mjs',
			},
		},
		outDir: 'dist',
		emptyOutDir: true,
	},
	plugins: [
		dts({
			include: ['src/**/*.ts', 'src/**/*.tsx'],
			exclude: ['src/**/__tests__/**'],
			outDir: 'dist',
			entryRoot: 'src',
		}),
	],
})
