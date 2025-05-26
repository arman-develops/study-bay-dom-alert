// const targetSelector = ".messages__left-wraper";
const targetSelector = ".messages-wraper";
const target = document.querySelector(targetSelector);
let observer;

function isExtensionValid() {
    try {
        return chrome.runtime && chrome.runtime.id;
    } catch {
        return false;
    }
}

function playSoundNotification() {
    try {
        const audio = new Audio(chrome.runtime.getURL("sound-notification.mp3"));
        audio.play();
    } catch(e) {
        console.warn("Could not play sound: ", e);
    }
}

function notifyChange(text) {
    if (!isExtensionValid()) {
        console.warn("Extension context invalidated, stopping observer");
        if (observer) {
            observer.disconnect();
        }
        return;
    }
    
    chrome.runtime.sendMessage({
        type: "DOM_CHANGED",
        text: text
    }).catch(error => {
        console.warn("Failed to send message:", error);
        if (observer) {
            observer.disconnect();
        }
    });
    playSoundNotification();
}

if(target) {
    let lastValue = target.innerText;

    observer = new MutationObserver(() => {
        if (!isExtensionValid()) {
            observer.disconnect();
            return;
        }
        
        const newValue = target.innerText;
        if(newValue !== lastValue) {
            lastValue = newValue;
            notifyChange("Got an Offer or Client Responded, check it out");
        }
    });

    observer.observe(target, {childList: true, subtree: true, characterData: true});
} else {
    console.warn(`Target ${targetSelector} not found`);
}