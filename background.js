chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if(message.type === "DOM_CHANGED") {
        chrome.notifications.create(
            'dom-change-' + Date.now(), // Add unique ID
            {
                type: "basic",
                iconUrl: "./icon.png",
                title: "DOM Changed", // Add title (required)
                message: message.text || "New Offer Accepted"
            }
        );
    }
});