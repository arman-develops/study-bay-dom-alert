// Extension Core
const ExtensionCore = {
    isValid() {
        try {
            return chrome.runtime && chrome.runtime.id
        } catch {
            return false
        }
    },

    sendNotification(text) {
        if (!this.isValid()) {
            console.warn("Extension context invalidated");
            return false;
        }
        
        chrome.runtime.sendMessage({
            type: "DOM_CHANGED",
            text: text
        }).catch(error => {
            console.warn("Failed to send message:", error);
        });
        
        AudioManager.playNotification();
        return true;
    },

    cleanup() {
        MessageTracker.cleanup();
        OrdersTracker.cleanup();
    }
}

// Audio Manager
const AudioManager = {
    audioEnabled: false,
    
    initialize() {
        const enableAudio = () => {
            try {
                const audio = new Audio(chrome.runtime.getURL("sound-notification.mp3"));
                audio.volume = 0.1;
                audio.play().then(() => {
                    this.audioEnabled = true;
                    console.log("Audio notifications enabled");
                    this.removeListeners(enableAudio);
                }).catch(() => {
                    console.log("Audio still not allowed, visual notifications only");
                });
            } catch(e) {
                console.log("Audio setup failed, using visual notifications only");
            }
        };
        
        this.setupListeners(enableAudio);
    },

    setupListeners(enableAudio) {
        document.addEventListener('click', enableAudio, { once: true });
        document.addEventListener('keydown', enableAudio, { once: true });
        document.addEventListener('scroll', enableAudio, { once: true });
    },

    removeListeners(enableAudio) {
        document.removeEventListener('click', enableAudio);
        document.removeEventListener('keydown', enableAudio);
        document.removeEventListener('scroll', enableAudio);
    },

    playNotification() {
        if (!this.audioEnabled) {
            console.log("Audio not enabled yet - notification sent visually");
            return;
        }
        
        try {
            const audio = new Audio(chrome.runtime.getURL("sound-notification.wav"));
            audio.volume = 0.5;
            audio.play().catch(e => {
                console.warn("Could not play sound: ", e);
                this.audioEnabled = false;
            });
        } catch(e) {
            console.warn("Could not play sound: ", e);
            this.audioEnabled = false;
        }
    }
}

// Store Manager
const StorageManager = {
    // Store tracked order IDs in localStorage
    storeOrderIds(orderIds) {
        try {
            localStorage.setItem('trackedOrderIds', JSON.stringify(Array.from(orderIds)));
        } catch(e) {
            console.warn("Failed to store order IDs:", e);
        }
    },

    getStoredOrderIds() {
        try {
            const stored = localStorage.getItem('trackedOrderIds');
            return stored ? new Set(JSON.parse(stored)) : new Set();
        } catch(e) {
            console.warn("Failed to retrieve stored order IDs:", e);
            return new Set();
        }
    },

    // Session storage for refresh handling
    storeRefreshState(key, data) {
        try {
            sessionStorage.setItem(key, JSON.stringify(data));
        } catch(e) {
            console.warn(`Failed to store ${key}:`, e);
        }
    },

    getRefreshState(key) {
        try {
            const stored = sessionStorage.getItem(key);
            return stored ? JSON.parse(stored) : null;
        } catch(e) {
            console.warn(`Failed to retrieve ${key}:`, e);
            return null;
        }
    },

    clearRefreshState(key) {
        try {
            sessionStorage.removeItem(key);
        } catch(e) {
            console.warn(`Failed to clear ${key}:`, e);
        }
    }
};

// Orders Manager
const OrdersTracker = {
    targetSelector: "#orders",
    target: null,
    observer: null,
    
    // State tracking
    trackedOrderIds: new Set(),
    lastCheck: Date.now(),

    initialize() {
        this.target = document.querySelector(this.targetSelector);
        if (!this.target) {
            console.warn(`Orders target ${this.targetSelector} not found`);
            return false;
        }

        this.initializeState();
        this.setupObserver();
        this.setupPeriodicChecks();
        
        console.log("Orders Tracker initialized");
        return true;
    },

    initializeState() {
        // Load previously tracked order IDs from localStorage
        this.trackedOrderIds = StorageManager.getStoredOrderIds();
        
        // Get current order IDs and check for any new ones
        const currentOrderIds = this.getCurrentOrderIds();
        this.checkForNewOrders(currentOrderIds);
        
        // Store current state
        this.trackedOrderIds = currentOrderIds;
        StorageManager.storeOrderIds(this.trackedOrderIds);
    },

    setupObserver() {
        this.observer = new MutationObserver((mutations) => {
            if (!ExtensionCore.isValid()) {
                this.cleanup();
                return;
            }
            
            // Debounce rapid changes
            clearTimeout(this.checkTimeout);
            this.checkTimeout = setTimeout(() => {
                this.checkForChanges();
            }, 500);
        });
        
        this.observer.observe(this.target, {
            childList: true,
            subtree: true
        });
    },

    setupPeriodicChecks() {
        // Check every 30 seconds for any missed changes
        this.periodicInterval = setInterval(() => {
            if (ExtensionCore.isValid()) {
                this.checkForChanges();
            }
        }, 30000);
    },

    getCurrentOrderIds() {
        const orderItems = this.target?.querySelectorAll('.orders__item[id^="order_block_"]') || [];
        const orderIds = new Set();

        orderItems.forEach(item => {
            const idMatch = item.id.match(/order_block_(\d+)/);
            if (idMatch) {
                orderIds.add(idMatch[1]);
            }
        });

        return orderIds;
    },

    checkForChanges() {
        const currentOrderIds = this.getCurrentOrderIds();
        this.checkForNewOrders(currentOrderIds);
        
        // Update tracked state
        this.trackedOrderIds = currentOrderIds;
        StorageManager.storeOrderIds(this.trackedOrderIds);
    },

    checkForNewOrders(currentOrderIds) {
        const newOrderIds = [...currentOrderIds].filter(
            orderId => !this.trackedOrderIds.has(orderId)
        );

        if (newOrderIds.length > 0) {
            this.notifyNewOrders(newOrderIds);
        }
    },

    notifyNewOrders(newOrderIds) {
        const orderDetails = this.getOrderDetails(newOrderIds);
        
        newOrderIds.forEach((orderId, index) => {
            const details = orderDetails[index] || {};
            const title = details.title || `Order #${orderId}`;
            
            ExtensionCore.sendNotification(
                `🤖 BOT SECURED NEW PROJECT: ${title} (#${orderId}) - Write personalized message NOW!`
            );
        });

        // Log for debugging
        console.log(`Detected ${newOrderIds.length} new orders:`, newOrderIds);
    },

    getOrderDetails(orderIds) {
        const details = [];
        
        orderIds.forEach(orderId => {
            const orderBlock = this.target?.querySelector(`#order_block_${orderId}`);
            if (orderBlock) {
                // Try to extract project title - adjust selectors based on actual DOM structure
                const titleElement = orderBlock.querySelector('.order-title, .project-title, h3, h4') ||
                                   orderBlock.querySelector('[class*="title"]') ||
                                   orderBlock.querySelector('[class*="name"]');
                
                const title = titleElement?.textContent?.trim() || `Project #${orderId}`;
                
                // Try to extract other useful info
                const budgetElement = orderBlock.querySelector('[class*="budget"], [class*="price"], [class*="amount"]');
                const budget = budgetElement?.textContent?.trim() || null;
                
                const deadlineElement = orderBlock.querySelector('[class*="deadline"], [class*="due"], [class*="time"]');
                const deadline = deadlineElement?.textContent?.trim() || null;
                
                details.push({
                    orderId,
                    title,
                    budget,
                    deadline,
                    element: orderBlock
                });
            } else {
                details.push({
                    orderId,
                    title: `Order #${orderId}`,
                    budget: null,
                    deadline: null,
                    element: null
                });
            }
        });
        
        return details;
    },

    cleanup() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        if (this.periodicInterval) {
            clearInterval(this.periodicInterval);
            this.periodicInterval = null;
        }
        if (this.checkTimeout) {
            clearTimeout(this.checkTimeout);
            this.checkTimeout = null;
        }
        console.log("Orders Tracker cleaned up");
    }
};

// Message Tracker
const MessageTracker = {
    targetSelector: ".messages__left",
    target: null,
    observer: null,
    
    // State tracking
    lastKnownMessageCount: 0,
    lastFullContent: "",
    isTyping: false,
    typingTimeout: null,
    lastKnownOrderNumbers: new Set(),
    lastKnownOnlineUsers: new Set(),

    initialize() {
        this.target = document.querySelector(this.targetSelector);
        if (!this.target) {
            console.warn(`Target ${this.targetSelector} not found`);
            return false;
        }

        this.initializeState();
        this.setupObserver();
        this.setupPeriodicChecks();
        this.setupRefreshHandling();
        
        console.log("Message Tracker initialized");
        return true;
    },

    initializeState() {
        const initialCounts = this.getMessageCounts();
        this.lastKnownCounts = { auction: initialCounts.auction };
        this.lastFullContent = this.target.innerText;
        this.lastKnownOrderNumbers = this.getOrderNumbers();
        this.lastKnownOnlineUsers = this.getOnlineUsers();
    },

    setupObserver() {
        this.observer = new MutationObserver((mutations) => {
            if (!ExtensionCore.isValid()) {
                this.cleanup();
                return;
            }
            
            if (this.isTyping) return;
            
            const hasNewOrders = this.checkForNewOrders();
            const hasNewOnlineUsers = this.checkForNewOnlineUsers();

            if (hasNewOrders || hasNewOnlineUsers) return;

            this.performFallbackChecks();
        });
        
        this.observer.observe(this.target, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true
        });
    },

    setupPeriodicChecks() {
        this.periodicInterval = setInterval(() => {
            if (ExtensionCore.isValid()) {
                this.checkForNewOnlineUsers();
            }
        }, 30000);
    },

    setupRefreshHandling() {
        window.addEventListener('beforeunload', () => this.storeCurrentState());
        window.addEventListener('load', () => this.checkPostRefreshChanges());
    },

    getOrderNumbers() {
        const auctionItems = this.target?.querySelectorAll('.messages__left_item[data-stage="Auction"]') || [];
        const orderNumbers = new Set();

        auctionItems.forEach(item => {
            const orderId = item.getAttribute("data-id");
            if(orderId) orderNumbers.add(orderId);
        });

        return orderNumbers;
    },

    getOnlineUsers() {
        const allItems = this.target?.querySelectorAll('.messages__left_item') || [];
        const onlineUsers = new Set();

        allItems.forEach(item => {
            const onlineStatus = item.getAttribute('data-online');
            const customerNick = item.getAttribute('data-cutomer_nick_name');
            const orderId = item.getAttribute('data-id');
            
            if(onlineStatus === 'online' && customerNick && orderId) {
                onlineUsers.add(`${customerNick}|${orderId}`);
            }
        });

        return onlineUsers;
    },

    checkForNewOrders() {
        const currentOrderNumbers = this.getOrderNumbers();
        const newOrders = [...currentOrderNumbers].filter(
            orderId => !this.lastKnownOrderNumbers.has(orderId)
        );

        if(newOrders.length > 0) {
            this.notifyNewOrders(newOrders);
            this.lastKnownOrderNumbers = currentOrderNumbers;
            return true;
        }
        
        this.lastKnownOrderNumbers = currentOrderNumbers;
        return false;
    },

    checkForNewOnlineUsers() {
        const currentOnlineUsers = this.getOnlineUsers();
        const newOnlineUsers = [...currentOnlineUsers].filter(
            userOrder => !this.lastKnownOnlineUsers.has(userOrder)
        );
        
        if (newOnlineUsers.length > 0) {
            this.notifyNewOnlineUsers(newOnlineUsers);
            this.lastKnownOnlineUsers = currentOnlineUsers;
            return true;
        }
        
        this.lastKnownOnlineUsers = currentOnlineUsers;
        return false;
    },

    notifyNewOrders(newOrders) {
        const newOrderDetails = this.getOrderDetails(newOrders);
        let notificationText = `🔥 ${newOrders.length} NEW AUCTION${newOrders.length > 1 ? 'S' : ''}!`;
        
        if (newOrderDetails.length > 0) {
            const firstOrder = newOrderDetails[0];
            notificationText += ` #${firstOrder.orderId} "${firstOrder.title}" from ${firstOrder.customerNick}`;
            if (newOrders.length > 1) {
                notificationText += ` (+${newOrders.length - 1} more)`;
            }
        }
        
        ExtensionCore.sendNotification(notificationText);
    },

    notifyNewOnlineUsers(newOnlineUsers) {
        newOnlineUsers.forEach(userOrder => {
            const [customerNick, orderId] = userOrder.split('|');
            const item = this.target?.querySelector(`.messages__left_item[data-id="${orderId}"]`);
            const title = item?.getAttribute('data-title') || 'Unknown Order';
            
            ExtensionCore.sendNotification(`🟢 CUSTOMER ONLINE: ${customerNick} (#${orderId} - "${title}") - Engage now!`);
        });
    },

    getOrderDetails(orderIds) {
        const details = [];
        orderIds.forEach(orderId => {
            const item = this.target?.querySelector(`.messages__left_item[data-id="${orderId}"]`);
            if (item) {
                const title = item.getAttribute('data-title') || 'Unknown';
                const customerNick = item.getAttribute('data-cutomer_nick_name') || 'Unknown';
                details.push({ orderId, title, customerNick });
            }
        });
        return details;
    },

    getMessageCounts() {
        const auctionItems = this.target?.querySelectorAll('.messages__left_item[data-stage="Auction"]') || [];
        return {
            auction: auctionItems.length,
            auctionItems: Array.from(auctionItems)
        };
    },

    getUnreadCounts() {
        const auctionItems = this.target?.querySelectorAll('.messages__left_item[data-stage="Auction"]') || [];
        let totalUnread = 0;
        
        auctionItems.forEach(item => {
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
    },

    performFallbackChecks() {
        const currentCounts = this.getMessageCounts();
        const currentContent = this.target.innerText;
        const unreadCount = this.getUnreadCounts();
        
        if (currentCounts.auction > this.lastKnownCounts.auction) {
            const newAuctions = currentCounts.auction - this.lastKnownCounts.auction;
            ExtensionCore.sendNotification(`🔥 ${newAuctions} NEW AUCTION${newAuctions > 1 ? 'S' : ''} AVAILABLE!`);
            this.lastKnownCounts.auction = currentCounts.auction;
        } else if (unreadCount > 0) {
            ExtensionCore.sendNotification(`💬 ${unreadCount} unread auction message${unreadCount > 1 ? 's' : ''}!`);
        } else if (currentContent.length > this.lastFullContent.length + 20) {
            this.checkForAuctionKeywords(currentContent);
        }
        
        this.lastFullContent = currentContent;
    },

    checkForAuctionKeywords(currentContent) {
        const newContent = currentContent.substring(this.lastFullContent.length).toLowerCase();
        const auctionKeywords = ['auction', 'bid', 'offer', 'proposal', 'quote', 'deadline'];
        
        if (auctionKeywords.some(keyword => newContent.includes(keyword))) {
            ExtensionCore.sendNotification("🎯 New auction-related activity detected!");
        }
    },

    storeCurrentState() {
        const orderNumbers = Array.from(this.getOrderNumbers());
        const onlineUsers = Array.from(this.getOnlineUsers());
        const counts = this.getMessageCounts();
        const content = this.target?.innerText || '';
        
        StorageManager.storeRefreshState('preRefreshOrderNumbers', orderNumbers);
        StorageManager.storeRefreshState('preRefreshOnlineUsers', onlineUsers);
        StorageManager.storeRefreshState('preRefreshCounts', counts);
        StorageManager.storeRefreshState('preRefreshContent', content);
    },

    checkPostRefreshChanges() {
        const preRefreshOrderNumbers = new Set(StorageManager.getRefreshState('preRefreshOrderNumbers') || []);
        const preRefreshOnlineUsers = new Set(StorageManager.getRefreshState('preRefreshOnlineUsers') || []);
        
        if (preRefreshOrderNumbers.size > 0 || preRefreshOnlineUsers.size > 0) {
            StorageManager.clearRefreshState('preRefreshOrderNumbers');
            StorageManager.clearRefreshState('preRefreshOnlineUsers');
            StorageManager.clearRefreshState('preRefreshCounts');
            StorageManager.clearRefreshState('preRefreshContent');
            
            setTimeout(() => this.processPostRefreshChanges(preRefreshOrderNumbers, preRefreshOnlineUsers), 1000);
        }
    },

    processPostRefreshChanges(preRefreshOrderNumbers, preRefreshOnlineUsers) {
        const currentOrderNumbers = this.getOrderNumbers();
        const currentOnlineUsers = this.getOnlineUsers();
        
        const newOrders = [...currentOrderNumbers].filter(orderId => !preRefreshOrderNumbers.has(orderId));
        const newOnlineUsers = [...currentOnlineUsers].filter(userOrder => !preRefreshOnlineUsers.has(userOrder));
        
        if (newOrders.length > 0) {
            this.notifyNewOrdersAfterRefresh(newOrders);
        }
        
        if (newOnlineUsers.length > 0) {
            this.notifyNewOnlineUsersAfterRefresh(newOnlineUsers);
        }
        
        this.lastKnownOrderNumbers = currentOrderNumbers;
        this.lastKnownOnlineUsers = currentOnlineUsers;
    },

    notifyNewOrdersAfterRefresh(newOrders) {
        let notificationText = `🔥 ${newOrders.length} NEW AUCTION${newOrders.length > 1 ? 'S' : ''} after refresh!`;
        
        const firstOrderId = newOrders[0];
        const item = this.target?.querySelector(`.messages__left_item[data-id="${firstOrderId}"]`);
        if (item) {
            const title = item.getAttribute('data-title') || 'Unknown';
            const customerNick = item.getAttribute('data-cutomer_nick_name') || 'Unknown';
            notificationText += ` #${firstOrderId} "${title}" from ${customerNick}`;
            if (newOrders.length > 1) {
                notificationText += ` (+${newOrders.length - 1} more)`;
            }
        }
        
        ExtensionCore.sendNotification(notificationText);
    },

    notifyNewOnlineUsersAfterRefresh(newOnlineUsers) {
        newOnlineUsers.forEach(userOrder => {
            const [customerNick, orderId] = userOrder.split('|');
            const item = this.target?.querySelector(`.messages__left_item[data-id="${orderId}"]`);
            const title = item?.getAttribute('data-title') || 'Unknown Order';
            
            ExtensionCore.sendNotification(`🟢 CUSTOMER CAME ONLINE: ${customerNick} (#${orderId} - "${title}") - Engage now!`);
        });
    },

    cleanup() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        if (this.periodicInterval) {
            clearInterval(this.periodicInterval);
            this.periodicInterval = null;
        }
        console.log("Message Tracker cleaned up");
    }
};

//main
function initializeExtension() {
    console.log("Initializing Enhanced Bidding Extension...");
    
    // Initialize core systems
    AudioManager.initialize();
    
    // Initialize trackers based on available DOM elements
    const messageTrackerReady = MessageTracker.initialize();
    const ordersTrackerReady = OrdersTracker.initialize();
    
    if (!messageTrackerReady && !ordersTrackerReady) {
        console.warn("No valid targets found for tracking");
        return;
    }
    
    // Global cleanup on page unload
    window.addEventListener('beforeunload', () => {
        ExtensionCore.cleanup();
    });
    
    console.log("Extension initialized successfully:", {
        messageTracker: messageTrackerReady,
        ordersTracker: ordersTrackerReady
    });
}

// Start the extension
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
    initializeExtension();
}