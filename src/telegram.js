// Telegram bot configuration
const TELEGRAM_BOT_TOKEN = ''; //add your bot token here
const TELEGRAM_CHAT_ID = ''; //add your tg id here

// Function to format message for Telegram
function formatTelegramMessage(message) {
    // Extract emoji and type of notification
    const emoji = message.match(/^[^\s]+/)?.[0] || '🔔';
    const type = message.includes('NEW AUCTION') ? 'AUCTION' :
                message.includes('CUSTOMER ONLINE') ? 'CUSTOMER' :
                message.includes('unread') ? 'MESSAGE' : 'UPDATE';

    // Format based on notification type
    switch(type) {
        case 'AUCTION':
            return `🎯 <b>New Auction Alert</b>\n\n${message.replace(/^🔥\s*/, '')}`;
        case 'CUSTOMER':
            return `👤 <b>Customer Online</b>\n\n${message.replace(/^🟢\s*/, '')}`;
        case 'MESSAGE':
            return `💬 <b>New Message</b>\n\n${message.replace(/^💬\s*/, '')}`;
        default:
            return `📢 <b>StudyBay Update</b>\n\n${message}`;
    }
}

// Function to send message to Telegram
async function sendTelegramMessage(message) {
    try {
        const formattedMessage = formatTelegramMessage(message);
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: formattedMessage,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });

        if (!response.ok) {
            throw new Error('Failed to send Telegram message');
        }
    } catch (error) {
        console.error('Error sending Telegram message:', error);
    }
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if(message.type === "DOM_CHANGED") {
        // Create Chrome notification
        chrome.notifications.create(
            'dom-change-' + Date.now(),
            {
                type: "basic",
                iconUrl: "./icon.png",
                title: "StudyBay Alert",
                message: message.text || "New Update"
            }
        );

        // Forward the formatted message to Telegram
        sendTelegramMessage(message.text || "New Update");
    } 
});
