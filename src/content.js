// const targetSelector = ".messages__left-wraper";
const targetSelector = ".messages__left";
const target = document.querySelector(targetSelector);
let observer;
let pageRefreshObserver;

//tracing states between refreshes
let lastKnownMessageCount = 0;
let lastFullContent = ""
let isTyping = false;
let typingTimeout;

//order number tracking
let lastKnownOrderNumbers = new Set();
let lastKnownOnlineUsers = new Set();

function isExtensionValid() {
    try {
        return chrome.runtime && chrome.runtime.id;
    } catch {
        return false;
    }
}

let audioContext = null;
let audioEnabled = false;

function initializeAudio() {
    // Try to enable audio after user interaction
    const enableAudio = () => {
        try {
            const audio = new Audio(chrome.runtime.getURL("sound-notification.mp3"));
            audio.volume = 0.1; // Very quiet test
            audio.play().then(() => {
                audioEnabled = true;
                console.log("Audio notifications enabled");
                // Remove the listeners once audio is enabled
                document.removeEventListener('click', enableAudio);
                document.removeEventListener('keydown', enableAudio);
                document.removeEventListener('scroll', enableAudio);
            }).catch(() => {
                console.log("Audio still not allowed, will try visual notifications only");
            });
        } catch(e) {
            console.log("Audio setup failed, using visual notifications only");
        }
    };
    
    // Set up listeners for user interaction
    document.addEventListener('click', enableAudio, { once: true });
    document.addEventListener('keydown', enableAudio, { once: true });
    document.addEventListener('scroll', enableAudio, { once: true });
}

function playSoundNotification() {
    if (!audioEnabled) {
        console.log("Audio not enabled yet - notification sent visually");
        return;
    }
    
    try {
        const audio = new Audio(chrome.runtime.getURL("sound-notification.wav"));
        audio.volume = 0.5; // Adjust volume as needed
        audio.play().catch(e => {
            console.warn("Could not play sound: ", e);
            audioEnabled = false; // Reset if it fails
        });
    } catch(e) {
        console.warn("Could not play sound: ", e);
        audioEnabled = false;
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
        type: "DOM_CHANGED",
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
    
    playSoundNotification();
    
}

// get all order numbers from auction items
function getOrderNumbers() {
    const auctionItems = target?.querySelectorAll('.messages__left_item[data-stage="Auction"]') || [];
    const orderNumbers = new Set();

    auctionItems.forEach(item => {
        const orderId = item.getAttribute("data-id");
        if(orderId) {
            orderNumbers.add(orderId);
        }
    });

    return orderNumbers;
}

// Get online users from all items
function getOnlineUsers() {
    const allItems = target?.querySelectorAll('.messages__left_item') || [];
    const onlineUsers = new Set();

    allItems.forEach(item => {
        const onlineStatus = item.getAttribute('data-online');
        const customerNick = item.getAttribute('data-cutomer_nick_name');
        const orderId = item.getAttribute('data-id')
        
        if(onlineStatus === 'online' && customerNick && orderId) {
            onlineUsers.add(`${customerNick}|${orderId}`);
        }
    });

    return onlineUsers;
}

// compare orders and detect changes
function checkForNewOrders() {
    const currentOrderNumbers = getOrderNumbers();
    const newOrders = [...currentOrderNumbers].filter(
        orderId => !lastKnownOrderNumbers.has(orderId)
    );

    if(newOrders.length > 0) {
        // get new order details
        const newOrderDetails = [];
        newOrders.forEach(orderId => {
            const item = target?.querySelector(`.messages__left_item[data-id="${orderId}"]`);
            if (item) {
                const title = item.getAttribute('data-title') || 'Unknown';
                const customerNick = item.getAttribute('data-cutomer_nick_name') || 'Unknown';
                newOrderDetails.push({ orderId, title, customerNick });
            }
        })

        let notificationText = `🔥 ${newOrders.length} NEW AUCTION${newOrders.length > 1 ? 'S' : ''}!`;
        if (newOrderDetails.length > 0) {
            const firstOrder = newOrderDetails[0];
            notificationText += ` #${firstOrder.orderId} "${firstOrder.title}" from ${firstOrder.customerNick}`;
            if (newOrders.length > 1) {
                notificationText += ` (+${newOrders.length - 1} more)`;
            }
        }
        
        notifyChange(notificationText);
    }
    
    lastKnownOrderNumbers = currentOrderNumbers;
    return newOrders.length > 0;
}

// New: Check for users coming online
function checkForNewOnlineUsers() {
    const currentOnlineUsers = getOnlineUsers();
    const newOnlineUsers = [...currentOnlineUsers].filter(userOrder => !lastKnownOnlineUsers.has(userOrder));
    
    if (newOnlineUsers.length > 0) {
        newOnlineUsers.forEach(userOrder => {
            const [customerNick, orderId] = userOrder.split('|');
            const item = target?.querySelector(`.messages__left_item[data-id="${orderId}"]`);
            const title = item?.getAttribute('data-title') || 'Unknown Order';
            
            notifyChange(`🟢 CUSTOMER ONLINE: ${customerNick} (#${orderId} - "${title}") - Engage now!`);
        });
    }
    
    lastKnownOnlineUsers = currentOnlineUsers;
    return newOnlineUsers.length > 0;
}

function getMessageCounts() {
    const auctionItems = target?.querySelectorAll('.messages__left_item[data-stage="Auction"]') || []
    return {
        auction: auctionItems.length,
        auctionItems: Array.from(auctionItems)
    };
}

// Check for unread message indicators on Auction items only
function getUnreadCounts() {
    const auctionItems = target?.querySelectorAll('.messages__left_item[data-stage="Auction"]') || [];
    let totalUnread = 0;
    
    auctionItems.forEach(item => {
        // Look for unread count elements within each auction item
        const unreadElement = item.querySelector('[id^="unreadMessageCnt_"]');
        if (unreadElement) {
            const text = unreadElement.textContent.trim();
            const match = text.match(/\+(\d+)/);
            if (match) {
                totalUnread += parseInt(match[1]);
            }
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

function storeCurrentState() {
    const orderNumbers = Array.from(getOrderNumbers());
    const onlineUsers = Array.from(getOnlineUsers());
    const counts = getMessageCounts();
    const content = target?.innerText || '';
    
    sessionStorage.setItem('preRefreshOrderNumbers', JSON.stringify(orderNumbers));
    sessionStorage.setItem('preRefreshOnlineUsers', JSON.stringify(onlineUsers));
    sessionStorage.setItem('preRefreshCounts', JSON.stringify(counts));
    sessionStorage.setItem('preRefreshContent', content);
}

// Monitor for page refreshes/reloads
function setupRefreshDetection() {
    //store current state before refresh
    window.addEventListener('beforeunload', storeCurrentState)

    //check after page loads
    window.addEventListener('load', checkPostRefreshChanges)
}

// Enhanced: Check for changes after refresh
function checkPostRefreshChanges() {
    const preRefreshOrderNumbers = new Set(JSON.parse(sessionStorage.getItem('preRefreshOrderNumbers') || '[]'));
    const preRefreshOnlineUsers = new Set(JSON.parse(sessionStorage.getItem('preRefreshOnlineUsers') || '[]'));
    const preRefreshCounts = JSON.parse(sessionStorage.getItem('preRefreshCounts') || '{"auction":0}');
    const preRefreshContent = sessionStorage.getItem('preRefreshContent') || '';
    
    if (preRefreshOrderNumbers.size > 0 || preRefreshOnlineUsers.size > 0 || preRefreshCounts.auction > 0 || preRefreshContent) {
        
        // Clear the stored data
        sessionStorage.removeItem('preRefreshOrderNumbers');
        sessionStorage.removeItem('preRefreshOnlineUsers');
        sessionStorage.removeItem('preRefreshCounts');
        sessionStorage.removeItem('preRefreshContent');
        
        // Wait for page to fully load, then check for changes
        setTimeout(() => {
            const currentOrderNumbers = getOrderNumbers();
            const currentOnlineUsers = getOnlineUsers();
            const currentCounts = getMessageCounts();
            const currentContent = target?.innerText || '';
            
            // Check for new orders
            const newOrders = [...currentOrderNumbers].filter(orderId => !preRefreshOrderNumbers.has(orderId));
            
            // Check for new online users
            const newOnlineUsers = [...currentOnlineUsers].filter(userOrder => !preRefreshOnlineUsers.has(userOrder));
            
            if (newOrders.length > 0) {
                let notificationText = `🔥 ${newOrders.length} NEW AUCTION${newOrders.length > 1 ? 'S' : ''} after refresh!`;
                
                // Get details for the first new order
                const firstOrderId = newOrders[0];
                const item = target?.querySelector(`.messages__left_item[data-id="${firstOrderId}"]`);
                if (item) {
                    const title = item.getAttribute('data-title') || 'Unknown';
                    const customerNick = item.getAttribute('data-cutomer_nick_name') || 'Unknown';
                    notificationText += ` #${firstOrderId} "${title}" from ${customerNick}`;
                    if (newOrders.length > 1) {
                        notificationText += ` (+${newOrders.length - 1} more)`;
                    }
                }
                
                notifyChange(notificationText);
            }
            
            if (newOnlineUsers.length > 0) {
                newOnlineUsers.forEach(userOrder => {
                    const [customerNick, orderId] = userOrder.split('|');
                    const item = target?.querySelector(`.messages__left_item[data-id="${orderId}"]`);
                    const title = item?.getAttribute('data-title') || 'Unknown Order';
                    
                    notifyChange(`🟢 CUSTOMER CAME ONLINE: ${customerNick} (#${orderId} - "${title}") - Engage now!`);
                });
            }
            
            // Update our tracking with current state
            lastKnownOrderNumbers = currentOrderNumbers;
            lastKnownOnlineUsers = currentOnlineUsers;
            lastKnownCounts = { auction: currentCounts.auction };
            lastFullContent = currentContent;
            
        }, 1000);
    }
}

if(target) {
    //initialize audio
    initializeAudio();

    // Initialize tracking - auction only
    const initialCounts = getMessageCounts();
    lastKnownCounts = {
        auction: initialCounts.auction
    };
    lastFullContent = target.innerText;
    
    // New: Initialize order number and online user tracking
    lastKnownOrderNumbers = getOrderNumbers();
    lastKnownOnlineUsers = getOnlineUsers();
    
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
        
        // Primary checks: New orders and online users
        const hasNewOrders = checkForNewOrders();
        const hasNewOnlineUsers = checkForNewOnlineUsers();

        // If we detected changes through order number tracking, skip other checks
        if (hasNewOrders || hasNewOnlineUsers) {
            return;
        }

        //Fallback checks
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
    
    // New: Periodic check for online status changes (every 30 seconds)
    setInterval(() => {
        if (isExtensionValid()) {
            checkForNewOnlineUsers();
        }
    }, 30000);
} else {
    console.warn(`Target ${targetSelector} not found`);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (observer) observer.disconnect();
    if (pageRefreshObserver) pageRefreshObserver.disconnect();
});