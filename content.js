const targetSelector = ".messages";
const target = document.querySelector(targetSelector);

function notifyChange(text) {
    chrome.runtime.sendMessage({
        type: "DOM_CHANGED",
        text: text
    });
}

if(target) {
    let lastValue = target.innerText;

    const observer = new MutationObserver(() => {
        const newValue = target.innerText;
        if(newValue !== lastValue) {
            lastValue = newValue;
            notifyChange()
        }
    });

    observer.observe(target, {childList: true, subtree: true, characterData: true});
} else {
    console.warn(`Target ${targetSelector} not found`);
}