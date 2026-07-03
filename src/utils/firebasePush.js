import { messaging } from '../config/firebase.js';

export const sendFCMNotification = async (deviceTokens, payload) => {
  if (!messaging || !deviceTokens || deviceTokens.length === 0) {
    console.warn('[FCM] Skipping push: messaging not initialized or no tokens');
    return;
  }
  
  const message = {
    data: {
      title: payload.title || '',
      body: payload.body || '',
      chatId: payload.data?.chatId || '',
      chatType: payload.data?.chatType || '',
      messageId: payload.data?.messageId || '',
    },
    android: {
      priority: 'high',
    },
    tokens: deviceTokens,
  };

  try {
    const response = await messaging.sendEachForMulticast(message);
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`[FCM] Token failure for token ${deviceTokens[idx]}: ${resp.error.message}`);
        }
      });
    }
  } catch (error) {
    console.error('[FCM] Error sending multicast message:', error);
  }
};
