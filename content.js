// const targetSelector = ".messages__left-wraper";
const targetSelector = ".messages-wraper";
const target = document.querySelector(targetSelector);
let observer;
let pageRefreshObserver;

//tracing states between refreshes
let lastKnownMessageCount = 0;
let lastFullContent = ""
let isTyping = false;
let typingTimeout;

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

function notifyChange(text, isRefresh = false) {
    if (!isExtensionValid()) {
        console.warn("Extension context invalidated, stopping observer");
        if (observer) {
            observer.disconnect();
        }
        if(pageRefreshObserver) {
            pageRefreshObserver.disconnect();
        }
        return;
    }
    
    chrome.runtime.sendMessage({
        type: isRefresh ? "PAGE_REFRESHED" : "DOM_CHANGED",
        text: text
    }).catch(error => {
        console.warn("Failed to send message:", error);
        if (observer) {
            observer.disconnect();
        }
        if(pageRefreshObserver) {
            pageRefreshObserver.disconnect();
        }
    });
    if(!isRefresh) {
        playSoundNotification();
    }
}

function getMessageCount() {
    const auctionItems = target?.querySelectorAll('.messages__left_item[data-stage="Auction"]') || []
    return {
        auction: auctionItems.length,
        auctionItems: Array.from(auctionItems)
    };
}

// Check for unread message indicators on Auction items only
function getUnreadCounts() {
    const unreadElements = target?.querySelectorAll('.messages__left_item[data-stage="Auction"] #unreadMessageCnt_*') || [];
    let totalUnread = 0;
    
    unreadElements.forEach(el => {
        const text = el.textContent.trim();
        const match = text.match(/\+(\d+)/);
        if (match) {
            totalUnread += parseInt(match[1]);
        }
    });
    
    return totalUnread;
}

// Get specific order details for notifications
function getOrderDetails(item) {
    const orderId = item.getAttribute('data-id');
    const title = item.getAttribute('data-title');
    const customerNick = item.getAttribute('data-cutomer_nick_name');
    const stage = item.getAttribute('data-stage');
    
    return {
        orderId,
        title,
        customerNick,
        stage
    };
}

// Detect if user is typing in input fields
function setupTypingDetection() {
    const inputSelectors = 'input[type="text"], textarea, [contenteditable="true"]';
    
    document.addEventListener('input', (e) => {
        if (e.target.matches(inputSelectors)) {
            isTyping = true;
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                isTyping = false;
            }, 2000); // Consider typing stopped after 2 seconds of no input
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.target.matches(inputSelectors)) {
            isTyping = true;
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                isTyping = false;
            }, 2000);
        }
    });
}

// Monitor for page refreshes/reloads
function setupRefreshDetection() {
    // Detect when the page is about to refresh
    window.addEventListener('beforeunload', () => {
        // Store current state before refresh
        const counts = getMessageCounts();
        sessionStorage.setItem('preRefreshCounts', JSON.stringify(counts));
        sessionStorage.setItem('preRefreshContent', target?.innerText || '');
    });
    
    // Check after page loads if it was refreshed
    window.addEventListener('load', () => {
        const preRefreshCounts = JSON.parse(sessionStorage.getItem('preRefreshCounts') || '{"auction":0}');
        const preRefreshContent = sessionStorage.getItem('preRefreshContent') || '';
        
        if (preRefreshCounts.auction > 0 || preRefreshContent) {
            notifyChange("Page refreshed - checking for new content", true);
            
            // Clear the stored data
            sessionStorage.removeItem('preRefreshCounts');
            sessionStorage.removeItem('preRefreshContent');
            
            // Wait a bit for the page to fully load, then check for new content
            setTimeout(() => {
                const currentCounts = getMessageCounts();
                const currentContent = target?.innerText || '';
                
                if (currentCounts.auction > preRefreshCounts.auction || 
                    (currentContent !== preRefreshContent && currentContent.length > preRefreshContent.length)) {
                    
                    let changeText = "New auction content detected after refresh!";
                    if (currentCounts.auction > preRefreshCounts.auction) {
                        changeText = `🔥 ${currentCounts.auction - preRefreshCounts.auction} NEW AUCTION${currentCounts.auction - preRefreshCounts.auction > 1 ? 'S' : ''} detected after refresh!`;
                    }
                    
                    notifyChange(changeText);
                }
            }, 1000);
        }
    });
}

if(target) {
    // Initialize tracking - auction only
    const initialCounts = getMessageCounts();
    lastKnownCounts = {
        auction: initialCounts.auction
    };
    lastFullContent = target.innerText;
    
    // Setup typing detection
    setupTypingDetection();
    
    // Setup refresh detection
    setupRefreshDetection();
    
    observer = new MutationObserver((mutations) => {
        if (!isExtensionValid()) {
            observer.disconnect();
            return;
        }
        
        // Skip if user is currently typing
        if (isTyping) {
            return;
        }
        
        const currentCounts = getMessageCounts();
        const currentContent = target.innerText;
        const unreadCount = getUnreadCounts();
        
        // Check for new auctions (primary focus)
        if (currentCounts.auction > lastKnownCounts.auction) {
            const newAuctions = currentCounts.auction - lastKnownCounts.auction;
            notifyChange(`🔥 ${newAuctions} NEW AUCTION${newAuctions > 1 ? 'S' : ''} AVAILABLE!`);
            lastKnownCounts.auction = currentCounts.auction;
        }
        // Check for unread message indicators on auction items
        else if (unreadCount > 0) {
            notifyChange(`💬 ${unreadCount} unread auction message${unreadCount > 1 ? 's' : ''}!`);
        }
        // Check for significant content changes in auction-related content
        else if (currentContent.length > lastFullContent.length + 20) {
            const newContent = currentContent.substring(lastFullContent.length).toLowerCase();
            const auctionKeywords = ['auction', 'bid', 'offer', 'proposal', 'quote', 'deadline'];
            
            if (auctionKeywords.some(keyword => newContent.includes(keyword))) {
                notifyChange("🎯 New auction-related activity detected!");
            }
        }
        
        // Update tracking
        lastFullContent = currentContent;
    });
    
    observer.observe(target, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true // Now we want to monitor data-stage changes
    });
    
} else {
    console.warn(`Target ${targetSelector} not found`);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (observer) observer.disconnect();
    if (pageRefreshObserver) pageRefreshObserver.disconnect();
});