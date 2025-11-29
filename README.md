# 🥒 Pickle Patrol Stream Monitor

> The Dilly-est Way to Monitor Kick.com Streams!

## ⚠️ Important Disclaimer

**This is NOT an actual pickle scanner or restaurant finder!** 🥒❌

This is a themed userscript for monitoring live streams on Kick.com. The "pickle" theme is purely decorative and fun - it has absolutely nothing to do with:
- Finding pickle restaurants
- Scanning for pickles
- Food delivery services
- Any real-world pickle-related functionality

It's just a cute, cartoonish interface for stream monitoring with pickle sheriff branding!

---

A fun, cartoonish userscript that monitors Kick.com live streams with a pickle sheriff theme. Keep track of your favorite streamers with an adorable interface that only activates when you need it!

![Pickle Sheriff Logo](image%20(20).jpg)

## 🎯 Features

### Core Functionality
- 🥒 **Lazy Loading**: Monitoring only starts when you click the logo (saves resources!)
- 🎥 **Live Stream Grid**: Dynamic grid layout that adapts to any number of streams
- 🔇 **Auto-Muted Playback**: Streams start muted but playing automatically
- 💬 **Embedded Chat**: Optional chat integration alongside video streams
- 🔄 **Real-time Updates**: Checks for new live streams every 5 minutes
- 🌐 **Cross-Site Support**: Works on any website, not just Kick.com

### Pickle-Themed Interface
- 🚔 **Pickle Sheriff Logo**: Clickable logo that reveals controls when needed
- 🎨 **Cartoonish Design**: Vibrant colors, playful fonts, and smooth animations
- 👁️ **Hidden Controls**: Clean interface with controls that appear on demand
- 📱 **Responsive Layout**: Adapts to different screen sizes automatically

### Stream Management
- ➕ **Add Channels**: Easy channel management through the settings panel
- ❌ **Remove Streams**: Individual stream removal with close buttons
- 🗑️ **Clear All**: Bulk removal of all active streams
- 🔴 **Live Indicators**: Visual status indicators for each channel

### Advanced Features
- ⚙️ **Comprehensive Settings**: Poll intervals, stream limits, chat toggles
- 🎯 **Grid Customization**: Adjustable columns and responsive layouts
- 📸 **Screenshot Support**: Capture individual streams or bulk screenshots (when enabled)
- ⌨️ **Keyboard Shortcuts**: Quick access to common functions

## 🚀 Installation

### Prerequisites
- **Modern Browser**: Chrome, Firefox, Edge, or Safari
- **Userscript Manager**: [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo), Greasemonkey, or Violentmonkey

### 🥇 Installation (Recommended)
**Get automatic updates directly from GitHub!**

#### Quick Install from GitHub
1. **Install Tampermonkey** (or Greasemonkey/Violentmonkey) for your browser
2. Copy this URL: `https://raw.githubusercontent.com/TheWhiteSasquatch/Pickles/main/Kick_Stream_Monitor.user.js`
3. Open your userscript manager dashboard
4. Click "Add a new script" → "Install from URL"
5. Paste the GitHub raw URL and click "Install"
6. Enable the script
7. **Visit any website** - you'll see the pickle logo in the top-right corner!

## 🔄 Automatic Updates

**GitHub provides automatic updates!** 🎉

- **Check Frequency**: Your userscript manager checks for updates automatically
- **One-Click Updates**: New versions install automatically
- **Version History**: See all changes in the repository
- **Direct Source**: Updates come directly from the original source

**GitHub Auto-Updates**: This installation method provides automatic updates! Your userscript manager will check for new versions and install them automatically.

## 🎮 Usage Guide

### Basic Usage
1. **Look for the pickle logo** 🥒 in the top-right corner of any webpage
2. **Click the logo** to reveal the control buttons
3. **Click "🥒GRID"** to show the stream monitoring grid
4. **Click "🥒"** to access settings and channel management

### Adding Channels
1. Click the logo → Settings button
2. Scroll to "🥒 Pickle Channels" section
3. Enter a channel name in the input field
4. Click "Add" or press Enter
5. The script will start monitoring that channel

### Viewing Streams
- **Grid View**: Click "🥒GRID" to see all live streams in a responsive grid
- **Auto-Layout**: The grid automatically adjusts columns based on screen size
- **Individual Controls**: Each stream has a close button (✕) to remove it

### Monitoring Behavior
- **Lazy Activation**: Monitoring only starts when you click the logo
- **5-Minute Polls**: Checks for live streams every 5 minutes when active
- **Unlimited Streams**: No hard limit - monitors all channels you add
- **Resource Efficient**: Stops monitoring when not in use

## ⚙️ Configuration

### General Settings
- **Enable Pickle Patrol**: Master toggle for monitoring functionality
- **Poll Interval**: How often to check for live streams (10-300 seconds)
- **Suggested Streams**: Recommended number of streams (no hard limit)

### Grid Settings
- **Grid Columns**: Preferred number of columns (1-4, auto-adjusts)
- **Show Chat**: Toggle chat panels alongside video streams

### Channel Management
- **Live Channels**: Real-time view of currently streaming channels
- **Monitored Channels**: Your watchlist with live/offline indicators
- **Add/Remove**: Easy channel management with visual feedback

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+K` | Toggle settings panel |
| `Ctrl+Shift+G` | Toggle stream grid |
| `Ctrl+Shift+X` | Clear all active streams |
| `Escape` | Close panel/grid |

## 🐛 Troubleshooting

### Common Issues

**Logo not appearing?**
- Make sure Tampermonkey is enabled
- Check that the script is installed and active
- Try refreshing the page

**Streams not loading?**
- Verify channel names are spelled correctly
- Check if the channel is actually live on Kick.com
- Try clicking the logo to ensure monitoring is active

**Grid not showing?**
- Click the logo first to activate monitoring
- Ensure you're on a page that allows the grid overlay
- Check browser console for any errors

**Performance issues?**
- The script is designed to be resource-efficient
- Monitoring only runs when activated
- Try reducing the poll interval in settings

**CSP/Security blocking streams?**
- Some websites (ESPN, news sites, corporate portals) have strict security policies
- The script will show "⚠️ CSP restrictions may limit functionality" in the status
- When streams fail to load, click the provided link to open in a new tab
- This is normal behavior - the website is protecting itself from security risks

### Browser Compatibility
- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Edge 80+
- ✅ Safari 13+

### Known Limitations
- Cross-origin restrictions prevent direct audio control
- Screenshot functionality requires html2canvas library
- Some corporate networks may block Kick.com APIs
- **Content Security Policy (CSP)**: Strict websites like ESPN, news sites, or corporate portals may block stream iframes. The script will show warnings and provide alternative access methods.

## 🔒 Privacy & Security

- **No Data Collection**: Script only monitors public Kick.com streams
- **Local Storage Only**: Settings saved locally in your browser
- **No External Communications**: Except for Kick.com API calls
- **Open Source**: Review the code to verify security

## 🤝 Contributing

Found a bug or want to suggest a feature?
1. Open an issue on the GitHub repository
2. Describe the problem or enhancement
3. Include browser version and steps to reproduce

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Credits

- **Created by**: Pickle Sheriff AI Assistant 🥒🤖
- **Published on**: [GitHub](https://github.com/TheWhiteSasquatch/Pickles)
- **Inspired by**: The need for better stream monitoring tools
- **Special Thanks**: To all the streamers and the Kick community!

---

**Ready to patrol some streams? Click that pickle logo and let the monitoring begin!** 🚔🥒📺

*Version 1.0.3 - Chat functionality restored!* ✨

**📍 Official Home**: [GitHub Repository](https://github.com/TheWhiteSasquatch/Pickles)
