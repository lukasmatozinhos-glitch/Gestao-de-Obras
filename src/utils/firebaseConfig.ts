import baseConfig from '../../firebase-applet-config.json';

// Helper to get environment variable safely
export const getEnv = (key: string): string | undefined => {
  if (typeof process !== 'undefined' && process.env) {
    const val = process.env[key] || process.env[`VITE_${key}`];
    if (val) return val;
  }
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    const val = (import.meta as any).env[key] || (import.meta as any).env[`VITE_${key}`];
    if (val) return val;
  }
  return undefined;
};

// Parse potential JSON configuration from env
const getJsonConfig = (): any => {
  const keys = [
    'FIREBASE_CONFIG',
    'VITE_FIREBASE_CONFIG',
    'FIREBASE_CREDENTIALS',
    'VITE_FIREBASE_CREDENTIALS',
    'firebaseConfig',
    'VITE_firebaseConfig'
  ];
  for (const key of keys) {
    const val = getEnv(key);
    if (val) {
      try {
        // Try parsing directly
        return JSON.parse(val);
      } catch (e) {
        // If it's single-quoted or unescaped, try some cleanup before parsing
        try {
          const cleaned = val.replace(/'/g, '"');
          return JSON.parse(cleaned);
        } catch (innerErr) {
          console.warn(`Failed to parse JSON from env variable ${key}:`, e);
        }
      }
    }
  }
  return null;
};

const jsonConfig = getJsonConfig() || {};

const customProjectId = getEnv('FIREBASE_PROJECT_ID') || jsonConfig.projectId || jsonConfig.project_id;
const isCustomProjectActive = customProjectId && customProjectId !== baseConfig.projectId;

export const firebaseConfig = {
  apiKey: getEnv('FIREBASE_API_KEY') || jsonConfig.apiKey || jsonConfig.api_key || baseConfig.apiKey,
  authDomain: getEnv('FIREBASE_AUTH_DOMAIN') || jsonConfig.authDomain || jsonConfig.auth_domain || baseConfig.authDomain,
  projectId: customProjectId || baseConfig.projectId,
  storageBucket: getEnv('FIREBASE_STORAGE_BUCKET') || jsonConfig.storageBucket || jsonConfig.storage_bucket || baseConfig.storageBucket,
  messagingSenderId: getEnv('FIREBASE_MESSAGING_SENDER_ID') || jsonConfig.messagingSenderId || jsonConfig.messaging_sender_id || baseConfig.messagingSenderId,
  appId: getEnv('FIREBASE_APP_ID') || jsonConfig.appId || jsonConfig.app_id || baseConfig.appId,
  measurementId: getEnv('FIREBASE_MEASUREMENT_ID') || jsonConfig.measurementId || jsonConfig.measurement_id || baseConfig.measurementId,
  firestoreDatabaseId: getEnv('FIREBASE_DATABASE_ID') || getEnv('FIREBASE_FIRESTORE_DATABASE_ID') || jsonConfig.firestoreDatabaseId || jsonConfig.databaseId || (isCustomProjectActive ? '' : baseConfig.firestoreDatabaseId) || '',
};

export const isQuotaBypassed = (): boolean => {
  // Check if user has registered bypass environment variables
  let hasBypass = false;
  
  if (typeof process !== 'undefined' && process.env) {
    hasBypass = Object.keys(process.env).some(key => {
      const upperKey = key.toUpperCase();
      const val = String(process.env[key] || '').toLowerCase();
      const isQuotaOrLimitBypass = upperKey.includes('QUOTA') || upperKey.includes('LIMIT') || upperKey.includes('BYPASS') || upperKey.includes('IGNORE') || upperKey.includes('DISABLE');
      return isQuotaOrLimitBypass && key !== 'GEMINI_API_KEY' && (val === 'true' || val === '1' || val === 'yes');
    });
  }

  if (!hasBypass && typeof import.meta !== 'undefined' && (import.meta as any).env) {
    hasBypass = Object.keys((import.meta as any).env).some(key => {
      const upperKey = key.toUpperCase();
      const val = String((import.meta as any).env[key] || '').toLowerCase();
      const isQuotaOrLimitBypass = upperKey.includes('QUOTA') || upperKey.includes('LIMIT') || upperKey.includes('BYPASS') || upperKey.includes('IGNORE') || upperKey.includes('DISABLE');
      return isQuotaOrLimitBypass && key !== 'GEMINI_API_KEY' && (val === 'true' || val === '1' || val === 'yes');
    });
  }

  // Also check if a custom firebase project ID other than default is configured
  const hasCustomProject = firebaseConfig.projectId && firebaseConfig.projectId !== 'gen-lang-client-0728012572';

  return !!(hasBypass || hasCustomProject);
};

export const isQuotaError = (error: unknown): boolean => {
  if (!error) return false;
  const str = String(error instanceof Error ? error.message : typeof error === 'object' ? JSON.stringify(error) : error).toLowerCase();
  
  return (
    str.includes('quota') ||
    str.includes('exhausted') ||
    str.includes('resource_exhausted') ||
    (str.includes('exceeded') && str.includes('limit')) ||
    (typeof error === 'object' && 'code' in (error as any) && String((error as any).code).toLowerCase().includes('quota'))
  );
};
