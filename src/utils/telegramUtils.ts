const DEFAULT_BOT_TOKEN = '8722542358:AAF_2J1eM-WB2IiwLuRkYU29A8pvWd3DtTw';

export async function sendTelegramMessage(botToken: string | undefined, chatId: string | undefined, text: string): Promise<boolean> {
  const token = botToken || DEFAULT_BOT_TOKEN;
  if (!token || !chatId || !text) {
    console.warn("Telegram bot token or chat ID is missing.");
    return false;
  }
  
  // Split by comma, semicolon, or whitespace
  const ids = chatId.split(/[,\s;]+/).map(id => id.trim()).filter(id => id.length > 0);
  if (ids.length === 0) {
    return false;
  }

  let allSuccess = true;
  for (const singleId of ids) {
    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id: singleId,
          text: text,
          parse_mode: 'HTML'
        })
      });
      if (!response.ok) {
        allSuccess = false;
      }
    } catch (err) {
      console.error("Failed to send Telegram message to ID: " + singleId, err);
      allSuccess = false;
    }
  }
  return allSuccess;
}

export async function notifyAction(actionAr: string, actionEn: string, details: string, settings: any, explicitUserName?: string) {
  let userName = explicitUserName;
  
  if (!userName) {
    const adminRaw = localStorage.getItem('meridien_logged_in_user');
    if (adminRaw) {
      try {
        const u = JSON.parse(adminRaw);
        userName = u.name || 'مدير النظام (Admin)';
      } catch (e) {}
    } else {
      const waiterRaw = localStorage.getItem('meridien_waiter');
      if (waiterRaw) {
        try {
          const w = JSON.parse(waiterRaw);
          userName = w.name || 'كابتن (Waiter)';
        } catch (e) {}
      }
    }
  }

  if (!userName) {
    userName = 'غير معروف (Unknown)';
  }

  const text = `🔔 <b>إشعار حركة في النظام</b>\n\n` +
               `• <b>المستخدم:</b> ${userName}\n` +
               `• <b>الإجراء:</b> ${actionAr} | ${actionEn}\n` +
               `• <b>التفاصيل:</b>\n${details}`;

  const token = settings?.telegram_bot_token || DEFAULT_BOT_TOKEN;
  const chatId = settings?.telegram_chat_id || '5507184715,7441837470';
  await sendTelegramMessage(token, chatId, text);
}
