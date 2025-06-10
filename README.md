# Study Bay Order & Online Status Monitor

A Chrome extension content script that monitors auction orders and customer online status in real-time, providing instant notifications for new opportunities and customer engagement.

## 🚀 Features

### 📋 Order Monitoring
- **Real-time Detection**: Instantly detects new auction orders as they appear
- **Refresh-Resistant**: Maintains tracking across page refreshes and reloads
- **Detailed Notifications**: Shows order ID, title, customer name, and count
- **Fallback Detection**: Multiple detection methods ensure no orders are missed

### 👥 Customer Engagement
- **Online Status Tracking**: Monitors when customers come online
- **Instant Alerts**: Immediate notifications when customers become available
- **Engagement Timing**: Perfect timing to reach out to active customers
- **Periodic Checks**: Automatic status updates every 30 seconds

### 🔊 Notification System
- **Audio Alerts**: Optional sound notifications (user-activated)
- **Visual Notifications**: Chrome extension notifications
- **Smart Filtering**: Only notifies for auction-stage orders
- **Unread Message Tracking**: Monitors unread message counts

## 📋 Requirements

- Chrome Extension with appropriate permissions
- Target page with `.messages__left` container
- Audio file: `sound-notification.wav` (optional)

## 🛠️ Installation

1. **Add to your Chrome extension's content script**:
   ```javascript
   // Include the monitoring script in your manifest.json
   "content_scripts": [
     {
       "matches": ["https://your-target-site.com/*"],
       "js": ["content.js"]
     }
   ]
   ```

2. **Required Permissions** (in manifest.json):
   ```json
   {
     "permissions": [
       "notifications",
       "storage"
     ],
     "host_permissions": [
       "https://your-target-site.com/*"
     ]
   }
   ```

3. **Optional Audio Setup**:
   - Add `sound-notification.wav` to your extension directory
   - Include in `web_accessible_resources` in manifest.json

## 🎯 How It Works

### Order Detection
1. **DOM Monitoring**: Uses MutationObserver to watch for changes
2. **Order Number Tracking**: Compares current vs. previous order IDs
3. **Refresh Persistence**: Stores state in sessionStorage before page refresh
4. **Multi-Layer Detection**: Primary order tracking + fallback content detection

### Online Status Monitoring
1. **Attribute Watching**: Monitors `data-online` attributes on order items
2. **Customer Identification**: Tracks by customer nickname and order ID
3. **Status Changes**: Detects transitions from offline to online
4. **Engagement Alerts**: Immediate notifications for customer availability

### Notification Types
- 🔥 **New Auctions**: `"🔥 2 NEW AUCTIONS! #12345 "Project Title" from CustomerName (+1 more)"`
- 🟢 **Customer Online**: `"🟢 CUSTOMER ONLINE: CustomerName (#12345 - "Project Title") - Engage now!"`
- 💬 **Unread Messages**: `"💬 3 unread auction messages!"`
- 🎯 **Content Changes**: `"🎯 New auction-related activity detected!"`

## ⚙️ Configuration

### Target Selectors
```javascript
const targetSelector = ".messages__left"; // Main container
// Alternative: ".messages__left-wraper"
```

### Audio Settings
```javascript
audio.volume = 0.5; // Adjust notification volume (0.0 - 1.0)
```

### Monitoring Intervals
```javascript
setInterval(checkForNewOnlineUsers, 30000); // Check online status every 30s
```

### Keywords for Content Detection
```javascript
const auctionKeywords = ['auction', 'bid', 'offer', 'proposal', 'quote', 'deadline'];
```

## 📊 Data Structure

### Order Item Attributes
The script monitors elements with these attributes:
```html
<div class="messages__left_item" 
     data-id="######"
     data-title="<Title>"
     data-cutomer_nick_name="<some user>"
     data-stage="Auction"
     data-online="online">
</div>
```

### Tracked Data
- **Order Numbers**: Set of current auction order IDs
- **Online Users**: Set of "CustomerName|OrderID" combinations
- **Message Counts**: Auction item counts and unread indicators
- **Content State**: Full text content for change detection

## 🔧 Extension Integration

### Background Script Handler
```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "DOM_CHANGED") {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'New Order Alert',
      message: message.text
    });
  }
  
  if (message.type === "PAGE_REFRESHED") {
    console.log("Page refreshed:", message.text);
  }
});
```

### Manifest.json Example
```json
{
  "manifest_version": 3,
  "name": "Order Monitor",
  "version": "1.0",
  "permissions": ["notifications", "storage"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [{
    "matches": ["https://your-site.com/*"],
    "js": ["order-monitor.js"]
  }],
  "web_accessible_resources": [{
    "resources": ["sound-notification.wav"],
    "matches": ["https://your-site.com/*"]
  }]
}
```

## 🐛 Troubleshooting

### Common Issues

**No Notifications Appearing**
- Check if target selector `.messages__left` exists on the page
- Verify Chrome extension permissions are granted
- Check browser console for error messages

**Audio Not Playing**
- Audio requires user interaction to enable
- Click, scroll, or press a key on the page to activate
- Check if `sound-notification.wav` is accessible

**Missing Orders After Refresh**
- Check if sessionStorage is working properly
- Verify the page structure matches expected selectors
- Look for console warnings about extension context

### Debug Mode
Enable console logging by checking browser developer tools:
```javascript
console.log("Audio notifications enabled");
console.warn("Could not play sound: ", e);
console.warn("Target selector not found");
```

## 📈 Performance

- **Lightweight**: Minimal DOM queries and efficient Set operations
- **Debounced**: Skips updates during user typing
- **Smart Filtering**: Only processes auction-stage items
- **Memory Efficient**: Uses Sets for fast lookups and deduplication

## 🔄 Updates & Maintenance

### Version History
- **v1.0**: Initial release with basic order monitoring
- **v2.0**: Added online status tracking and refresh persistence
- **v2.1**: Enhanced notifications with detailed order information

### Future Enhancements
- [ ] Configurable notification preferences
- [ ] Order priority detection
- [ ] Customer interaction history
- [ ] Advanced filtering options
- [ ] Statistics and reporting

## 📄 License

This project is intended for educational and business productivity purposes. Ensure compliance with the target website's terms of service.

## 🤝 Contributing

Feel free to submit issues and enhancement requests. When contributing:
1. Test thoroughly on target website
2. Maintain backward compatibility
3. Update documentation for new features
4. Follow existing code style and patterns

---

**Note**: This script is designed for a specific website structure. Modify selectors and attributes according to your target site's HTML structure.