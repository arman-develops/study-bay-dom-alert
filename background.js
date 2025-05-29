chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if(message.type === "DOM_CHANGED") {
        chrome.notifications.create(
            'dom-change-' + Date.now(),
            {
                type: "basic",
                iconUrl: "./icon.png",
                title: "NEW MESSAGE ALERT",
                message: message.text || "New Offer Accepted"
            }
        );
    } else if(message.type === "PAGE_REFRESHED") {
        chrome.notifications.create(
            'page-refresh-' + Date.now(),
            {
                type: "basic",
                iconUrl: "./icon.png",
                title: "PAGE REFRESHED",
                message: message.text || "Page has been refreshed",
                priority: 1 // Lower priority for refresh notifications
            }
        );
    }
});