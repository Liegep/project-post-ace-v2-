import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
export default defineConfig({ plugins: [react()], resolve: { alias: { react: path.resolve(__dirname, '../../../node_modules/react'), 'react-dom': path.resolve(__dirname, '../../../node_modules/react-dom') } }, test: { environment: 'jsdom', include: ['tests/report-analysis.test.tsx'], clearMocks: true } });
