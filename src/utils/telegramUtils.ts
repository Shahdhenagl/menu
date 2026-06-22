const DEFAULT_BOT_TOKEN = '8722542358:AAF_2J1eM-WB2IiwLuRkYU29A8pvWd3DtTw';

export async function sendTelegramMessage(botToken: string | undefined, chatId: string | undefined, text: string): Promise<boolean> {
  const token = botToken || DEFAULT_BOT_TOKEN;
  if (!token || !chatId || !text) {
    console.warn("Telegram bot token or chat ID is missing.");
    return false;
  }
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    });
    return response.ok;
  } catch (err) {
    console.error("Failed to send Telegram message", err);
    return false;
  }
}
