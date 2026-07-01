import webpush from 'web-push';
import dotenv from 'dotenv';

dotenv.config();

let vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

// Generate VAPID keys on the fly if not configured in .env
if (!vapidPublicKey || !vapidPrivateKey) {
  console.log('VAPID keys not configured in env. Generating temporary VAPID key pairs...');
  const keys = webpush.generateVAPIDKeys();
  vapidPublicKey = keys.publicKey;
  vapidPrivateKey = keys.privateKey;
  console.log(`>>> Generated VAPID Public Key: ${vapidPublicKey}`);
}

// Configure web-push with VAPID details
webpush.setVapidDetails(
  'mailto:softwaremukti281@gmail.com', // Sender contact
  vapidPublicKey,
  vapidPrivateKey
);

/**
 * Sends a web push notification to a user's subscription client
 * @param {object} subscription - Web push subscription object
 * @param {object} payload - Notification payload containing title, body, icon, link
 */
export const sendWebPush = async (subscription, payload) => {
  try {
    const payloadString = JSON.stringify(payload);
    await webpush.sendNotification(subscription, payloadString);
    return { success: true };
  } catch (error) {
    // If subscription is expired or unsubscribed, return gone status
    if (error.statusCode === 410 || error.statusCode === 404) {
      return { success: false, gone: true, message: error.message };
    }
    return { success: false, gone: false, message: error.message };
  }
};

/**
 * Mock FCM push message dispatcher
 * Prepared skeleton for Firebase Cloud Messaging
 */
export const sendAndroidPush = async (deviceToken, payload) => {
  try {
    console.log(`[FCM Mock Push] Sending to device ${deviceToken}:`, payload);
    // Future integration can load admin.messaging().send() directly
    return { success: true };
  } catch (error) {
    console.error('FCM Push Error:', error);
    return { success: false, message: error.message };
  }
};

export { vapidPublicKey, vapidPrivateKey };
