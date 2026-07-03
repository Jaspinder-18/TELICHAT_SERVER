import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let messagingInstance = null;

try {
  let serviceAccount;

  // 1. Try reading from Environment Variable (for Render Deployment)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    // 2. Try reading from local file (for Local Testing)
    const serviceAccountPath = path.resolve(__dirname, '../../telichat-4c031-firebase-adminsdk-fbsvc-99e4e54927.json');
    if (fs.existsSync(serviceAccountPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    }
  }

  if (serviceAccount) {
    const app = initializeApp({
      credential: cert(serviceAccount)
    });
    messagingInstance = getMessaging(app);
    console.log('[Firebase] Admin SDK initialized successfully');
  } else {
    console.warn('[Firebase] Warning: Service account key not found. Please set FIREBASE_SERVICE_ACCOUNT in Render Env.');
  }
} catch (error) {
  console.error('[Firebase] Failed to initialize Admin SDK:', error);
}

export const messaging = messagingInstance;
