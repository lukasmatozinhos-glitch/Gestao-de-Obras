import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const allVars = { ...process.env, ...env };
  
  // Build dynamic process.env object with key environment variables
  const processEnv: Record<string, string> = {
    'process.env.GEMINI_API_KEY': JSON.stringify(allVars.GEMINI_API_KEY || ''),
  };

  const filteredEnv: Record<string, string> = {};

  // Expose any Firebase or Quota/Limit/Bypass/Ignore environment variables
  for (const key of Object.keys(allVars)) {
    const upperKey = key.toUpperCase();
    if (
      upperKey.includes('FIREBASE') ||
      upperKey.includes('QUOTA') ||
      upperKey.includes('LIMIT') ||
      upperKey.includes('BYPASS') ||
      upperKey.includes('IGNORE') ||
      upperKey.includes('DISABLE') ||
      upperKey.includes('CONFIG') ||
      upperKey.includes('CREDENTIALS') ||
      upperKey === 'GEMINI_API_KEY'
    ) {
      filteredEnv[key] = allVars[key] || '';
      processEnv[`process.env.${key}`] = JSON.stringify(allVars[key] || '');
    }
  }

  processEnv['process.env'] = JSON.stringify(filteredEnv);
  processEnv['process'] = JSON.stringify({ env: filteredEnv });

  console.log("=== VITE BUILD CONFIGURATION ===");
  console.log("Found env keys in process.env/env:", Object.keys(allVars).filter(k => k.startsWith('FIREBASE_') || k.toUpperCase().includes('QUOTA') || k.toUpperCase().includes('LIMIT') || k.toUpperCase().includes('BYPASS')));
  console.log("Filtered env keys being injected:", Object.keys(filteredEnv));
  console.log("================================");

  return {
    plugins: [react(), tailwindcss()],
    define: processEnv,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
