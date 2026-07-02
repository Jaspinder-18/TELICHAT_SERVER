import admin from '../config/firebase.js';

export const sendFCMNotification = async (deviceTokens, payload) => {
  if (!admin || !deviceTokens || deviceTokens.length === 0) return;
  
  const message = {
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data || {},
    tokens: deviceTokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`[FCM] Token failure for token ${deviceTokens[idx]}: ${resp.error}`);
        }
      });
    }
  } catch (error) {
    console.error('[FCM] Error sending multicast message:', error);
  }
};
