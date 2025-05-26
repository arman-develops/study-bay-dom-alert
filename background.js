chrome.runtime.onMessage.addEventListener((message, sender, sendResponse) => {
    if(message.type === "DOM_CHANGED") {
        chrome.notifications.create({
            type: "basic",
            iconUrl: "./icon.png",
            message: message.text || "New Offer Accepted"
        });
    }
});