// ==UserScript==
// @name         Pickle Patrol Stream Monitor
// @namespace    https://kick.com/
// @version      1.0.9
// @description  Keep an eye on Kick.com streams with the Pickle Patrol - dynamic grid display and embedded chat!
// @author       Pickle Sheriff AI
// @match        *://*/*
// @updateURL    https://raw.githubusercontent.com/TheWhiteSasquatch/Pickles/main/Kick_Stream_Monitor.user.js
// @downloadURL  https://raw.githubusercontent.com/TheWhiteSasquatch/Pickles/main/Kick_Stream_Monitor.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_notification
// @grant        unsafeWindow
// @connect      kick.com
// @connect      web.kick.com
// @connect      player.kick.com
// @run-at       document-start
// ==/UserScript==

/**
 * Pickle Patrol Stream Monitor - The Dilly-est Stream Watcher!
 *
 * Features:
 * - Background patrolling of Kick.com streams
 * - Dynamic pickle grid display of live streams
 * - Cross-site monitoring (we go where the streams are!)
 * - Keyboard shortcuts and comprehensive settings
 *
 * Installation:
 * 1. Install Tampermonkey extension for your browser
 * 2. Create a new script and paste this code
 * 3. Save and enable the script
 * 4. Visit any website to see the PICKLE PATROL button in the top-right
 *
 * Default monitored channels: PPWashington, RampageJackson, PredatorPoachers,
 * PPIllinois, BikersAgainstPredators, OPP_Oklahoma, PPLongIsland
 *
 * Keyboard shortcuts:
 * - Ctrl+Shift+K: Toggle pickle settings panel
 * - Ctrl+Shift+G: Toggle stream pickle grid
 * - Ctrl+Shift+S: Screenshot all pickle streams
 * - Ctrl+Shift+X: Clear all pickle streams
 * - Escape: Close panel/pickle grid
 */

(function() {
    'use strict';

    // Configuration defaults
    const DEFAULT_CONFIG = {
        enabled: true,
        monitoredChannels: [
            'ppwashington',
            'rampagejackson',
            'predatorpoachers',
            'ppillinois',
            'bikersagainstpredators',
            'opp_oklahoma',
            'pplongisland'
        ],
        pollInterval: 300000, // 5 minutes
        maxRetries: 3,
        retryDelay: 5000, // 5 seconds
        gridColumns: 2,
        gridRows: 2,
        maxStreams: 2, // Suggested default (2 streams), no actual limit
        showChat: true,
        theme: 'dark',
        soundEnabled: true,
        chatWidth: 300
    };

    // Main application class - The Pickle Patrol!
    class PicklePatrolMonitor {
        constructor() {
            this.config = this.loadConfig();
            this.liveStreams = new Set();
            this.monitoringInterval = null;
            this.gui = null;
            this.grid = null;
            this.streamContainers = new Map();

            this.init();
        }

        /**
         * Initialize the application
         */
        init() {
            console.log('🚔 Pickle Patrol initializing... Time to pickle some streams!');

            // Wait for page load
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.onPageLoad());
            } else {
                this.onPageLoad();
            }
        }

        /**
         * Handle page load
         */
        onPageLoad() {
            // Skip if running in an iframe to prevent recursive initialization
            if (window.self !== window.top) {
                console.log('Kick Stream Monitor skipping iframe context');
                return;
            }

            // Check if already initialized on this page
            if (window.ksmInitialized) {
                console.log('🥒 Pickle Patrol already on duty on this page!');
                return;
            }

            // Mark as initialized
            window.ksmInitialized = true;

            // Check Content Security Policy - this can block iframes on strict sites
            const cspIssues = this.checkCSPCompatibility();
            if (cspIssues.length > 0) {
                console.warn('🥒 Pickle Patrol CSP Warning:', cspIssues);
            }

            // Check if this is a Kick.com page - only run full monitoring here
            const isKickPage = window.location.hostname.includes('kick.com');

            // Clean up any existing instances first
            this.cleanupExistingInstances();

            // Create GUI (always show on all sites for cross-site patrolling)
            this.createGUI();

            // Always create grid container for cross-site patrolling
            this.createGrid();

            if (isKickPage) {
                // Full functionality on Kick.com pages - but wait for user interaction
                console.log('🥒 Pickle Patrol ready on Kick.com - click logo to activate monitoring');
            } else {
                // Cross-site functionality - start monitoring if enabled
                console.log('🥒 Running cross-site patrol - monitoring active');

                // Store CSP issues for status display
                this.cspIssues = cspIssues;

                // Auto-start monitoring if enabled (for cross-site persistence)
                if (this.config.enabled) {
                    console.log('🥒 Auto-starting monitoring on non-Kick site');
                    this.startMonitoring();
                }
            }

            // Set up page unload cleanup
            window.addEventListener('beforeunload', () => this.cleanup());

            // Set up window resize handler for responsive grid
            window.addEventListener('resize', () => {
                if (this.streamContainers.size > 0) {
                    this.updateGridLayout();
                }
            });

            // Set up keyboard shortcuts
            this.setupKeyboardShortcuts();

            // Make debug function globally available
            window.ksmDebugConfig = () => this.debugConfig();

        /**
         * Update chat widths for all existing streams
         */
        updateChatWidths() {
            const chatElements = document.querySelectorAll('.ksm-stream-chat');
            chatElements.forEach(chat => {
                chat.style.width = this.config.chatWidth + 'px';
            });
        }
        }

        /**
         * Check Content Security Policy compatibility
         */
        checkCSPCompatibility() {
            const issues = [];

            try {
                // Check for CSP meta tag
                const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
                if (cspMeta) {
                    const cspContent = cspMeta.getAttribute('content');
                    if (cspContent) {
                        // Check for frame-src restrictions
                        if (cspContent.includes('frame-src') && !cspContent.includes('player.kick.com')) {
                            issues.push('CSP frame-src restrictions may block Kick player iframes');
                        }
                        // Check for default-src restrictions
                        if (cspContent.includes('default-src') && cspContent.includes("'self'") && !cspContent.includes('player.kick.com')) {
                            issues.push('CSP default-src restrictions may block external content');
                        }
                        // Check for script-src restrictions that might affect our functionality
                        if (cspContent.includes('script-src') && !cspContent.includes("'unsafe-inline'")) {
                            issues.push('CSP script-src restrictions detected - may limit functionality');
                        }
                    }
                }

                // Try to create a test iframe to check if iframes are allowed
                const testIframe = document.createElement('iframe');
                testIframe.src = 'about:blank';
                testIframe.style.display = 'none';
                document.body.appendChild(testIframe);

                // Remove test iframe after a brief moment
                setTimeout(() => {
                    if (testIframe.parentNode) {
                        testIframe.parentNode.removeChild(testIframe);
                    }
                }, 100);

            } catch (error) {
                issues.push('CSP or iframe restrictions detected: ' + error.message);
            }

            // Check for X-Frame-Options (though this is usually handled by browsers)
            const xFrameOptions = document.querySelector('meta[name="X-Frame-Options"]');
            if (xFrameOptions) {
                issues.push('X-Frame-Options detected - may prevent iframe embedding');
            }

            return issues;
        }

        /**
         * Clean up any existing script instances to prevent duplicates
         */
        cleanupExistingInstances() {
            // Remove any existing grid containers from previous script instances
            const existingGrids = document.querySelectorAll('.ksm-grid-container');
            existingGrids.forEach(grid => grid.remove());

            // Remove any existing GUI containers
            const existingGUIs = document.querySelectorAll('.ksm-container');
            existingGUIs.forEach(gui => gui.remove());

            // Clear any existing intervals from previous instances
            if (window.ksmMonitoringInterval) {
                clearInterval(window.ksmMonitoringInterval);
                window.ksmMonitoringInterval = null;
            }
        }

        /**
         * Load configuration from storage
         */
        loadConfig() {
            const config = {};
            for (const [key, defaultValue] of Object.entries(DEFAULT_CONFIG)) {
                const stored = GM_getValue(key);
                config[key] = stored !== undefined ? stored : defaultValue;
            }
            console.log('🥒 Loaded config:', config);
            return config;
        }

        /**
         * Save configuration to storage
         */
        saveConfig() {
            for (const [key, value] of Object.entries(this.config)) {
                GM_setValue(key, value);
            }
            console.log('🥒 Saved config:', this.config);
        }

        /**
         * Create the GUI interface
         */
        createGUI() {
            // Basic GUI skeleton - will be expanded in later phases
            this.gui = {
                container: null,
                button: null,
                panel: null
            };

            // Add CSS styles
            GM_addStyle(`
                .ksm-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                    font-family: 'Comic Sans MS', cursive, Arial, sans-serif;
                    font-size: 14px;
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .ksm-logo {
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    border: 2px solid #53fc18;
                    background: #f0f8e7;
                    opacity: 0.8;
                }

                .ksm-logo:hover {
                    opacity: 1;
                    transform: scale(1.1);
                }

                .ksm-buttons {
                    display: none;
                    margin-top: 8px;
                    gap: 4px;
                }

                .ksm-buttons.show {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .ksm-logo:hover {
                    transform: scale(1.1) rotate(5deg);
                    box-shadow: 0 6px 12px rgba(0,0,0,0.4);
                }

                .ksm-button {
                    background: linear-gradient(45deg, #53fc18, #4ade17);
                    color: black;
                    border: none;
                    padding: 12px 18px;
                    border-radius: 25px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 16px;
                    box-shadow: 0 4px 8px rgba(83, 252, 24, 0.3);
                    transition: all 0.3s ease;
                    margin: 2px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                .ksm-button:hover {
                    background: linear-gradient(45deg, #4ade17, #3bc514);
                    transform: translateY(-2px) scale(1.05);
                    box-shadow: 0 6px 12px rgba(83, 252, 24, 0.4);
                }

                .ksm-button:active {
                    transform: translateY(0) scale(0.98);
                }

                .ksm-panel {
                    display: none;
                    background: linear-gradient(135deg, rgba(0, 0, 0, 0.95), rgba(30, 30, 30, 0.95));
                    color: white;
                    padding: 15px;
                    border-radius: 15px;
                    margin-top: 10px;
                    min-width: 320px;
                    max-width: 380px;
                    max-height: 70vh;
                    overflow-y: auto;
                    box-shadow: 0 8px 25px rgba(83, 252, 24, 0.2);
                    border: 3px solid #53fc18;
                    backdrop-filter: blur(10px);
                }

                .ksm-panel.show {
                    display: block;
                }

                .ksm-section {
                    margin-bottom: 12px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid #333;
                }

                .ksm-section:last-child {
                    border-bottom: none;
                    margin-bottom: 0;
                }

                .ksm-section h3 {
                    margin: 0 0 8px 0;
                    color: #53fc18;
                    font-size: 16px;
                    font-weight: bold;
                    text-shadow: 0 2px 4px rgba(83, 252, 24, 0.3);
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    background: linear-gradient(45deg, #53fc18, #7fff5a);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                .ksm-toggle {
                    display: flex;
                    align-items: center;
                    margin: 8px 0;
                }

                .ksm-toggle input[type="checkbox"] {
                    margin-right: 8px;
                }

                .ksm-input-group {
                    margin: 8px 0;
                }

                .ksm-input-group label {
                    display: block;
                    margin-bottom: 4px;
                    font-weight: bold;
                }

                .ksm-input-group input,
                .ksm-input-group select {
                    width: 100%;
                    padding: 6px 8px;
                    border: 1px solid #555;
                    border-radius: 4px;
                    background: #222;
                    color: white;
                    font-size: 14px;
                }

                .ksm-input-group input:focus,
                .ksm-input-group select:focus {
                    outline: none;
                    border-color: #53fc18;
                }

                .ksm-channel-list {
                    max-height: 150px;
                    overflow-y: auto;
                    border: 1px solid #555;
                    border-radius: 4px;
                    padding: 8px;
                    background: #111;
                }

                .ksm-channel-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 4px 0;
                    border-bottom: 1px solid #333;
                }

                .ksm-channel-item:last-child {
                    border-bottom: none;
                }

                .ksm-channel-name {
                    flex-grow: 1;
                    font-family: monospace;
                }

                .ksm-remove-channel {
                    background: #ff4444;
                    color: white;
                    border: none;
                    border-radius: 3px;
                    padding: 2px 6px;
                    cursor: pointer;
                    font-size: 12px;
                }

                .ksm-remove-channel:hover {
                    background: #cc3333;
                }

                .ksm-add-channel {
                    display: flex;
                    margin-top: 4px;
                    gap: 6px;
                }

                .ksm-add-channel input {
                    flex-grow: 1;
                }

                .ksm-add-channel button {
                    background: linear-gradient(45deg, #53fc18, #4ade17);
                    color: black;
                    border: none;
                    padding: 6px 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 13px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    transition: all 0.3s ease;
                    box-shadow: 0 3px 6px rgba(83, 252, 24, 0.3);
                }

                .ksm-add-channel button:hover {
                    background: linear-gradient(45deg, #4ade17, #3bc514);
                    transform: translateY(-1px);
                    box-shadow: 0 5px 10px rgba(83, 252, 24, 0.4);
                }

                .ksm-status {
                    padding: 8px;
                    background: linear-gradient(135deg, rgba(83, 252, 24, 0.1), rgba(74, 222, 23, 0.15));
                    border-radius: 8px;
                    margin-bottom: 10px;
                    border-left: 4px solid #53fc18;
                    box-shadow: 0 2px 8px rgba(83, 252, 24, 0.2);
                    font-weight: bold;
                    text-align: center;
                    font-size: 13px;
                }

                .ksm-grid-preview {
                    display: grid;
                    gap: 4px;
                    margin-top: 8px;
                    padding: 8px;
                    background: #111;
                    border-radius: 4px;
                }

                .ksm-grid-cell {
                    background: #333;
                    border-radius: 2px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 10px;
                    color: #999;
                }

                /* Grid and Stream Containers */
                .ksm-grid-container {
                    position: fixed;
                    top: 80px;
                    left: 20px;
                    right: 20px;
                    bottom: 20px;
                    z-index: 9999;
                    display: none;
                    pointer-events: none;
                }

                .ksm-grid-container.active {
                    display: block;
                }

                .ksm-stream-grid {
                    display: grid;
                    gap: 10px;
                    height: 100%;
                    pointer-events: auto;
                    grid-template-columns: repeat(auto-fit, minmax(480px, 1fr));
                    grid-auto-rows: min-content; /* Let content determine height */
                    align-items: start;
                    justify-items: stretch;
                }

                .ksm-stream-container {
                    background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
                    border: 3px solid #333;
                    border-radius: 15px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    min-height: 250px;
                    box-shadow: 0 6px 20px rgba(0,0,0,0.6);
                    transition: all 0.3s ease;
                }

                .ksm-stream-container:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(0,0,0,0.7);
                }

                .ksm-stream-container.live {
                    border-color: #53fc18;
                    box-shadow: 0 0 30px rgba(83, 252, 24, 0.4), 0 8px 25px rgba(0,0,0,0.7);
                    background: linear-gradient(135deg, #1a2a1a, #2a3a2a);
                }

                .ksm-stream-header {
                    background: #222;
                    padding: 8px 12px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #333;
                }

                .ksm-stream-title {
                    font-weight: bold;
                    color: #53fc18;
                    font-size: 14px;
                    flex-grow: 1;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .ksm-stream-controls {
                    display: flex;
                    gap: 5px;
                }

                .ksm-stream-btn {
                    background: linear-gradient(45deg, #444, #555);
                    border: none;
                    color: white;
                    padding: 6px 10px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: bold;
                    transition: all 0.3s ease;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                }

                .ksm-stream-btn:hover {
                    background: linear-gradient(45deg, #555, #666);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.4);
                }

                .ksm-stream-btn.danger:hover {
                    background: linear-gradient(45deg, #cc3333, #dd4444);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(204, 51, 51, 0.4);
                }

                .ksm-stream-content {
                    flex: 1;
                    display: flex;
                    overflow: hidden;
                }

                .ksm-stream-player {
                    flex: 1;
                    background: #000;
                    position: relative;
                    width: 100%;
                    height: 0;
                    padding-bottom: 56.25%; /* 16:9 aspect ratio */
                    overflow: hidden;
                }

                .ksm-stream-player iframe {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100% !important;
                    height: 100% !important;
                    border: none !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    box-sizing: border-box !important;
                    min-width: 480px;
                    min-height: 270px; /* 480 * 0.5625 for 16:9 */
                }


                .ksm-stream-chat {
                    background: #111;
                    border-left: 1px solid #333;
                    display: flex;
                    flex-direction: column;
                }

                .ksm-stream-chat.hidden {
                    display: none;
                }

                .ksm-chat-header {
                    background: #222;
                    padding: 8px 12px;
                    border-bottom: 1px solid #333;
                    font-size: 12px;
                    color: #ccc;
                }

                .ksm-chat-content {
                    flex: 1;
                    background: #000;
                }

                .ksm-no-streams {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: #666;
                    font-size: 18px;
                    text-align: center;
                }

                .ksm-notification-bubble {
                    position: absolute;
                    background: linear-gradient(135deg, rgba(83, 252, 24, 0.95), rgba(74, 222, 23, 0.95));
                    color: black;
                    padding: 8px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: bold;
                    box-shadow: 0 4px 12px rgba(83, 252, 24, 0.3);
                    border: 2px solid #53fc18;
                    z-index: 10001;
                    opacity: 0;
                    transform: translateY(-10px);
                    transition: all 0.3s ease;
                    pointer-events: none;
                    white-space: nowrap;
                }

                .ksm-notification-bubble.show {
                    opacity: 1;
                    transform: translateY(0);
                }

                .ksm-notification-bubble.fade-out {
                    opacity: 0;
                    transform: translateY(-10px);
                }

                .ksm-loading {
                    display: inline-block;
                    width: 20px;
                    height: 20px;
                    border: 3px solid #333;
                    border-radius: 50%;
                    border-top-color: #53fc18;
                    animation: ksm-spin 1s ease-in-out infinite;
                }

                @keyframes ksm-spin {
                    to { transform: rotate(360deg); }
                }

                /* Pickle Rain Animation */
                .ksm-pickle-rain {
                    position: fixed;
                    top: -50px;
                    z-index: 10001;
                    pointer-events: none;
                    font-size: 32px;
                    animation: ksm-pickle-fall linear infinite;
                    opacity: 0.8;
                }

                .ksm-pickle-rain.dill { animation-duration: 3s; }
                .ksm-pickle-rain.sweet { animation-duration: 4s; }
                .ksm-pickle-rain.sour { animation-duration: 2.5s; }
                .ksm-pickle-rain.gherkin { animation-duration: 3.5s; }
                .ksm-pickle-rain.cucumber { animation-duration: 4.2s; }
                .ksm-pickle-rain.jar { animation-duration: 3.8s; }

                .ksm-pickle-rain.dill { left: 10%; animation-delay: 0s; }
                .ksm-pickle-rain.sweet { left: 25%; animation-delay: 0.5s; }
                .ksm-pickle-rain.sour { left: 40%; animation-delay: 1s; }
                .ksm-pickle-rain.gherkin { left: 55%; animation-delay: 1.5s; }
                .ksm-pickle-rain.cucumber { left: 70%; animation-delay: 2s; }
                .ksm-pickle-rain.jar { left: 85%; animation-delay: 2.5s; }

                @keyframes ksm-pickle-fall {
                    0% {
                        transform: translateY(-50px) rotate(0deg) scale(1);
                        opacity: 0.8;
                    }
                    10% {
                        opacity: 1;
                    }
                    85% {
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(calc(100vh + 50px)) rotate(720deg) scale(0.3);
                        opacity: 0;
                    }
                }
            `);

            // Create container
            const container = document.createElement('div');
            container.className = 'ksm-container';

            // Add logo
            const logo = document.createElement('img');
            logo.src = 'https://github.com/TheWhiteSasquatch/Pickles/raw/master/image%20(20).jpg';
            logo.className = 'ksm-logo';
            logo.alt = 'Pickle Patrol Logo';
            logo.onclick = () => this.toggleButtons();

            // Create buttons container
            const buttonsContainer = document.createElement('div');
            buttonsContainer.className = 'ksm-buttons';

            // Create toggle button
            const button = document.createElement('button');
            button.className = 'ksm-button';
            button.textContent = '🥒';
            button.onclick = () => this.togglePanel();

            // Create show grid button
            const gridButton = document.createElement('button');
            gridButton.className = 'ksm-button';
            gridButton.textContent = '🥒GRID';
            gridButton.title = window.location.hostname.includes('kick.com')
                ? 'Show/Hide Pickle Stream Grid'
                : 'Show/Hide Pickle Stream Grid (streams from other tabs)';
            gridButton.onclick = () => {
                const isOnKick = window.location.hostname.includes('kick.com');

                // Create grid if it doesn't exist (needed for non-Kick pages)
                if (!this.grid || !this.grid.container) {
                    console.log('🥒 Creating pickle grid for off-duty patrol');
                    this.createGrid();
                }

                // Check if we have live streams
                if (this.liveStreams.size > 0) {
                    this.toggleGrid();
                } else {
                    // No live streams - show subtle notification instead of overlay
                    this.showNoStreamsNotification(gridButton);
                }
            };

            // Add buttons to container
            buttonsContainer.appendChild(button);
            buttonsContainer.appendChild(gridButton);

            // Create settings panel
            const panel = document.createElement('div');
            panel.className = 'ksm-panel';

            // Status section
            const statusSection = document.createElement('div');
            statusSection.className = 'ksm-section';

            const status = document.createElement('div');
            status.className = 'ksm-status';
            const isOnKick = window.location.hostname.includes('kick.com');
            let statusText = isOnKick
                ? `Status: ${this.config.enabled ? 'On Duty' : 'Off Duty'} | Pickled streams: ${this.liveStreams.size}`
                : `Status: Cross-site Patrol | Pickled streams: ${this.liveStreams.size} | Use PICKLE GRID button`;

            // Add CSP warning if applicable
            if (!isOnKick && this.cspIssues && this.cspIssues.length > 0) {
                statusText += '\n⚠️ Content Security Policy may block stream iframes on this site';
            }

            status.textContent = statusText;
            status.id = 'ksm-status';
            statusSection.appendChild(status);

            // General settings section
            const generalSection = document.createElement('div');
            generalSection.className = 'ksm-section';
            generalSection.innerHTML = `
                <h3>🍯 General Pickle Settings</h3>
                <label class="ksm-toggle">
                    <input type="checkbox" id="ksm-enabled" ${this.config.enabled ? 'checked' : ''}>
                    Enable Pickle Patrol
                </label>
                <label class="ksm-toggle">
                    <input type="checkbox" id="ksm-sound-enabled" ${this.config.soundEnabled ? 'checked' : ''}>
                    🔊 Sound Notifications
                </label>
                <div class="ksm-input-group">
                    <label for="ksm-poll-interval">Poll Interval (seconds):</label>
                    <input type="number" id="ksm-poll-interval" min="10" max="300" value="${this.config.pollInterval / 1000}">
                </div>
            `;

            // Grid settings section
            const gridSection = document.createElement('div');
            gridSection.className = 'ksm-section';
            gridSection.innerHTML = `
                <h3>🥒 Pickle Grid Settings</h3>
                <div class="ksm-input-group">
                    <label for="ksm-max-streams">Suggested Streams:</label>
                    <input type="number" id="ksm-max-streams" min="1" value="${this.config.maxStreams}">
                </div>
                <div class="ksm-input-group">
                    <label for="ksm-columns">Grid Columns:</label>
                    <input type="number" id="ksm-columns" min="1" max="4" value="${this.config.gridColumns}">
                </div>
                <label class="ksm-toggle">
                    <input type="checkbox" id="ksm-show-chat" ${this.config.showChat ? 'checked' : ''}>
                    Show Chat
                </label>
                <div class="ksm-input-group">
                    <label for="ksm-chat-width">Chat Width (px):</label>
                    <input type="number" id="ksm-chat-width" min="200" max="500" value="${this.config.chatWidth}">
                </div>
            `;

            // Add grid preview
            const gridPreview = document.createElement('div');
            gridPreview.className = 'ksm-grid-preview';
            gridPreview.id = 'ksm-grid-preview';
            this.updateGridPreview(gridPreview);
            gridSection.appendChild(gridPreview);

            // Channel management section
            const channelSection = document.createElement('div');
            channelSection.className = 'ksm-section';

            const channelHeader = document.createElement('h3');
            channelHeader.textContent = '🥒 Pickle Channels';
            channelSection.appendChild(channelHeader);

            // Live channels list
            const liveHeader = document.createElement('h4');
            liveHeader.textContent = '🥒 Fresh Pickles';
            liveHeader.style.color = '#53fc18';
            liveHeader.style.margin = '6px 0 3px 0';
            liveHeader.style.fontSize = '13px';
            channelSection.appendChild(liveHeader);

            const liveChannelList = document.createElement('div');
            liveChannelList.className = 'ksm-channel-list';
            liveChannelList.id = 'ksm-live-channel-list';
            this.updateLiveChannelList(liveChannelList);
            channelSection.appendChild(liveChannelList);

            // Monitored channels list
            const monitoredHeader = document.createElement('h4');
            monitoredHeader.textContent = '🥒 Pickle Watch List';
            monitoredHeader.style.color = '#ccc';
            monitoredHeader.style.margin = '8px 0 3px 0';
            monitoredHeader.style.fontSize = '13px';
            channelSection.appendChild(monitoredHeader);

            const channelList = document.createElement('div');
            channelList.className = 'ksm-channel-list';
            channelList.id = 'ksm-channel-list';
            this.updateChannelList(channelList);
            channelSection.appendChild(channelList);

            // Add channel form
            const addChannelForm = document.createElement('div');
            addChannelForm.className = 'ksm-add-channel';
            addChannelForm.innerHTML = `
                <input type="text" id="ksm-new-channel" placeholder="Enter channel name" maxlength="50">
                <button id="ksm-add-channel-btn">Add</button>
            `;
            channelSection.appendChild(addChannelForm);

            // Actions section
            const actionsSection = document.createElement('div');
            actionsSection.className = 'ksm-section';
            actionsSection.innerHTML = `
                <h3>🥒 Pickle Actions</h3>
                <button id="ksm-clear-all" class="ksm-button danger" style="width: 100%;">🗑️ Clear All Pickles</button>
            `;

            // Help section
            const helpSection = document.createElement('div');
            helpSection.className = 'ksm-section';
            helpSection.innerHTML = `
                <h3>🥒 Pickle Shortcuts</h3>
                <div style="font-size: 12px; color: #ccc; line-height: 1.4;">
                    <div><b>Ctrl+Shift+K:</b> Toggle pickle settings panel</div>
                    <div><b>Ctrl+Shift+G:</b> Toggle pickle stream grid</div>
                    <div><b>Ctrl+Shift+X:</b> Clear all pickles</div>
                    <div><b>Escape:</b> Close panel/pickle grid</div>
                </div>
                <div style="margin-top: 8px; font-size: 11px; color: #888;">
                    Version 1.0.1 | 🎵 Sound notifications + 🔊 toggle | Click buttons to control the pickle patrol!
                </div>
            `;

            // Theme section
            const themeSection = document.createElement('div');
            themeSection.className = 'ksm-section';
            themeSection.innerHTML = `
                <h3>🥒 Pickle Appearance</h3>
                <div class="ksm-input-group">
                    <label for="ksm-theme">Theme:</label>
                    <select id="ksm-theme">
                        <option value="dark" ${this.config.theme === 'dark' ? 'selected' : ''}>Dark</option>
                        <option value="light" ${this.config.theme === 'light' ? 'selected' : ''}>Light</option>
                        <option value="auto" ${this.config.theme === 'auto' ? 'selected' : ''}>Auto</option>
                    </select>
                </div>
            `;

            // Add all sections to panel
            panel.appendChild(statusSection);
            panel.appendChild(generalSection);
            panel.appendChild(gridSection);
            panel.appendChild(channelSection);
            panel.appendChild(actionsSection);
            panel.appendChild(themeSection);
            panel.appendChild(helpSection);

            // Set up event listeners
            this.setupEventListeners(panel);

            container.appendChild(logo);
            container.appendChild(buttonsContainer);
            container.appendChild(panel);

            document.body.appendChild(container);

            this.gui.container = container;
            this.gui.buttonsContainer = buttonsContainer;
            this.gui.button = button;
            this.gui.gridButton = gridButton;
            this.gui.panel = panel;

            // Initialize lists
            this.updateLiveChannelList();
            this.updateChannelList();

            // Initialize theme
            this.applyTheme();
        }

        /**
         * Create the stream grid container
         */
        createGrid() {
            // Remove any existing grid containers
            const existingContainer = document.getElementById('ksm-grid-container');
            if (existingContainer) {
                existingContainer.remove();
            }

            const gridContainer = document.createElement('div');
            gridContainer.className = 'ksm-grid-container';
            gridContainer.id = 'ksm-grid-container';

            const grid = document.createElement('div');
            grid.className = 'ksm-stream-grid';
            grid.id = 'ksm-stream-grid';

            // Add no streams message
            const noStreamsMsg = document.createElement('div');
            noStreamsMsg.className = 'ksm-no-streams';
            noStreamsMsg.id = 'ksm-no-streams';
            noStreamsMsg.textContent = 'No live streams detected. Monitoring channels...';

            grid.appendChild(noStreamsMsg);
            gridContainer.appendChild(grid);
            document.body.appendChild(gridContainer);

            this.grid = {
                container: gridContainer,
                grid: grid,
                noStreamsMsg: noStreamsMsg
            };
        }

        /**
         * Toggle settings panel visibility
         */
        togglePanel() {
            this.gui.panel.classList.toggle('show');
        }

        /**
         * Toggle buttons visibility and start monitoring if needed
         */
        toggleButtons() {
            const buttonsContainer = this.gui.container.querySelector('.ksm-buttons');
            if (buttonsContainer) {
                const willShow = !buttonsContainer.classList.contains('show');
                buttonsContainer.classList.toggle('show');

                // Start monitoring when buttons are shown and user wants to use the interface
                if (willShow && this.config.enabled && !this.monitoringInterval) {
                    console.log('🥒 Pickle Patrol activated! Starting monitoring...');
                    this.startMonitoring();
                }
            }
        }

        /**
         * Show/hide the stream grid
         */
        toggleGrid(show = null) {
            // Ensure grid exists
            if (!this.grid || !this.grid.container) {
                console.log('Grid not available for toggle');
                return;
            }

            if (show === null) {
                show = !this.grid.container.classList.contains('active');
            }

            // Only show grid if there are live streams
            if (show && this.liveStreams.size > 0) {
                this.grid.container.classList.add('active');
            } else {
                this.grid.container.classList.remove('active');
            }
        }

        /**
         * Show a subtle notification when no streams are live
         */
        showNoStreamsNotification(buttonElement) {
            // Remove any existing notification
            const existingBubble = document.querySelector('.ksm-notification-bubble');
            if (existingBubble) {
                existingBubble.remove();
            }

            // Create notification bubble
            const bubble = document.createElement('div');
            bubble.className = 'ksm-notification-bubble';
            bubble.textContent = '🥒 No live streams - monitoring channels...';

            // Position it near the button
            const buttonRect = buttonElement.getBoundingClientRect();
            bubble.style.left = (buttonRect.left + buttonRect.width / 2) + 'px';
            bubble.style.top = (buttonRect.top - 40) + 'px';

            // Add to page
            document.body.appendChild(bubble);

            // Show with animation
            setTimeout(() => bubble.classList.add('show'), 10);

            // Hide after 3 seconds
            setTimeout(() => {
                bubble.classList.add('fade-out');
                setTimeout(() => {
                    if (bubble.parentNode) {
                        bubble.parentNode.removeChild(bubble);
                    }
                }, 300);
            }, 3000);
        }

        /**
         * Set up event listeners for GUI controls
         */
        setupEventListeners(panel) {
            // General settings
            const enabledToggle = panel.querySelector('#ksm-enabled');
            enabledToggle.onchange = (e) => {
                this.config.enabled = e.target.checked;
                this.saveConfig();
                if (this.config.enabled) {
                    this.startMonitoring();
                } else {
                    this.stopMonitoring();
                }
                this.updateStatus();
            };

            const pollIntervalInput = panel.querySelector('#ksm-poll-interval');
            pollIntervalInput.onchange = (e) => {
                const value = parseInt(e.target.value);
                if (value >= 10 && value <= 300) {
                    this.config.pollInterval = value * 1000;
                    this.saveConfig();
                    // Restart monitoring with new interval
                    if (this.config.enabled) {
                        this.startMonitoring();
                    }
                }
            };

            // Grid settings
            const maxStreamsInput = panel.querySelector('#ksm-max-streams');
            maxStreamsInput.onchange = (e) => {
                const value = parseInt(e.target.value);
                if (value >= 1) {
                    this.config.maxStreams = value;
                    this.saveConfig();
                    this.updateGridPreview();
                }
            };

            const columnsInput = panel.querySelector('#ksm-columns');
            columnsInput.onchange = (e) => {
                const value = parseInt(e.target.value);
                if (value >= 1 && value <= 4) {
                    this.config.gridColumns = value;
                    this.saveConfig();
                    this.updateGridPreview();
                }
            };

            const showChatToggle = panel.querySelector('#ksm-show-chat');
            showChatToggle.onchange = (e) => {
                this.config.showChat = e.target.checked;
                this.saveConfig();
            };

            const chatWidthInput = panel.querySelector('#ksm-chat-width');
            chatWidthInput.onchange = (e) => {
                const value = parseInt(e.target.value);
                if (value >= 200 && value <= 500) {
                    this.config.chatWidth = value;
                    this.saveConfig();
                    // Update existing chat widths
                    this.updateChatWidths();
                }
            };

            const soundToggle = panel.querySelector('#ksm-sound-enabled');
            soundToggle.onchange = (e) => {
                this.config.soundEnabled = e.target.checked;
                this.saveConfig();
            };

            // Channel management
            const addChannelBtn = panel.querySelector('#ksm-add-channel-btn');
            const newChannelInput = panel.querySelector('#ksm-new-channel');

            addChannelBtn.onclick = () => {
                const channelName = newChannelInput.value.trim().toLowerCase();
                if (channelName && !this.config.monitoredChannels.includes(channelName)) {
                    this.config.monitoredChannels.push(channelName);
                    this.saveConfig();
                    this.updateChannelList();
                    this.updateLiveChannelList();
                    // Check the new channel immediately
                    this.checkChannelStatus(channelName);
                    newChannelInput.value = '';
                }
            };

            newChannelInput.onkeypress = (e) => {
                if (e.key === 'Enter') {
                    addChannelBtn.click();
                }
            };

            // Actions
            const clearAllBtn = panel.querySelector('#ksm-clear-all');
            clearAllBtn.onclick = () => {
                if (confirm('Remove all active streams?')) {
                    this.clearAllStreams();
                }
            };

            // Theme
            const themeSelect = panel.querySelector('#ksm-theme');
            themeSelect.onchange = (e) => {
                this.config.theme = e.target.value;
                this.saveConfig();
                this.applyTheme();
            };
        }

        /**
         * Update the live channel list display
         */
        updateLiveChannelList() { // eslint-disable-line
            const liveChannelList = document.getElementById('ksm-live-channel-list');
            if (!liveChannelList) return;

            liveChannelList.innerHTML = '';

            if (this.liveStreams.size === 0) {
                const emptyMsg = document.createElement('div');
                emptyMsg.style.padding = '8px';
                emptyMsg.style.color = '#666';
                emptyMsg.style.fontStyle = 'italic';
                emptyMsg.textContent = 'No pickled channels yet';
                liveChannelList.appendChild(emptyMsg);
                return;
            }

            Array.from(this.liveStreams).forEach(channel => {
                const item = document.createElement('div');
                item.className = 'ksm-channel-item';

                const nameSpan = document.createElement('span');
                nameSpan.className = 'ksm-channel-name';
                nameSpan.textContent = channel;
                nameSpan.style.color = '#53fc18';
                nameSpan.style.fontWeight = 'bold';

                const viewBtn = document.createElement('button');
                viewBtn.className = 'ksm-stream-btn';
                viewBtn.textContent = '🥒';
                viewBtn.title = 'View in pickle grid';
                viewBtn.onclick = () => this.toggleGrid(true);

                item.appendChild(nameSpan);
                item.appendChild(viewBtn);
                liveChannelList.appendChild(item);
            });
        }

        /**
         * Update the monitored channel list display
         */
        updateChannelList() {
            const channelList = document.getElementById('ksm-channel-list');
            if (!channelList) return;

            channelList.innerHTML = '';

            this.config.monitoredChannels.forEach((channel, index) => {
                const item = document.createElement('div');
                item.className = 'ksm-channel-item';

                const nameSpan = document.createElement('span');
                nameSpan.className = 'ksm-channel-name';
                nameSpan.textContent = channel;

                // Show live status indicator
                const isLive = this.liveStreams.has(channel);
                if (isLive) {
                    nameSpan.style.color = '#53fc18';
                    nameSpan.style.fontWeight = 'bold';
                }

                const statusIndicator = document.createElement('span');
                statusIndicator.textContent = isLive ? ' 🔴' : ' ⚫';
                statusIndicator.title = isLive ? 'Live' : 'Offline';
                nameSpan.appendChild(statusIndicator);

                const removeBtn = document.createElement('button');
                removeBtn.className = 'ksm-remove-channel';
                removeBtn.textContent = '×';
                removeBtn.onclick = () => {
                    this.config.monitoredChannels.splice(index, 1);
                    this.saveConfig();
                    this.updateChannelList();
                    this.updateLiveChannelList();
                };

                item.appendChild(nameSpan);
                item.appendChild(removeBtn);
                channelList.appendChild(item);
            });
        }

        /**
         * Update the grid preview
         */
        updateGridPreview() {
            const preview = document.getElementById('ksm-grid-preview');
            if (!preview) return;

            const columns = this.config.gridColumns;
            const maxStreams = this.config.maxStreams;

            preview.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
            preview.innerHTML = '';

            for (let i = 0; i < Math.min(maxStreams, 8); i++) { // Show max 8 in preview
                const cell = document.createElement('div');
                cell.className = 'ksm-grid-cell';
                cell.textContent = `Stream ${i + 1}`;
                preview.appendChild(cell);
            }
        }


        /**
         * Show notification (console only)
         */
        showNotification(title, body) {
            console.log(`Kick Stream Monitor: ${title} - ${body}`);
        }



        /**
         * Remove a stream manually
         */
        removeStream(channel) {
            if (this.streamContainers.has(channel)) {
                const container = this.streamContainers.get(channel);
                container.remove();
                this.streamContainers.delete(channel);
                this.liveStreams.delete(channel);

                this.updateGridLayout();
                this.updateStatus();
                this.updateLiveChannelList();

                // Hide grid if no streams left
                if (this.streamContainers.size === 0) {
                    this.toggleGrid(false);
                }
            }
        }

        /**
         * Clear all active streams
         */
        clearAllStreams() {
            const channels = Array.from(this.streamContainers.keys());
            for (const channel of channels) {
                this.removeStream(channel);
            }
            this.showNotification('Streams Cleared', 'All active streams have been removed');
        }

        /**
         * Set up keyboard shortcuts
         */
        setupKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                // Only trigger if not typing in an input field
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') {
                    return;
                }

                // Ctrl+Shift+K: Toggle settings panel
                if (e.ctrlKey && e.shiftKey && e.key === 'K') {
                    e.preventDefault();
                    this.togglePanel();
                    return;
                }

                // Ctrl+Shift+G: Toggle grid
                if (e.ctrlKey && e.shiftKey && e.key === 'G') {
                    e.preventDefault();
                    this.toggleGrid();
                    return;
                }

                // Ctrl+Shift+X: Clear all streams
                if (e.ctrlKey && e.shiftKey && e.key === 'X') {
                    e.preventDefault();
                    if (confirm('Remove all active streams?')) {
                        this.clearAllStreams();
                    }
                    return;
                }

                // Escape: Close panel/grid if open
                if (e.key === 'Escape') {
                    if (this.gui.panel.classList.contains('show')) {
                        this.togglePanel();
                    } else if (this.grid.container.classList.contains('active')) {
                        this.toggleGrid(false);
                    }
                    return;
                }
            });
        }

        /**
         * Reorder grid containers alphabetically by channel name
         */
        reorderGrid() {
            if (this.streamContainers.size === 0) return;

            console.log('Reordering grid containers');

            const containers = Array.from(this.streamContainers.entries())
                .sort(([a], [b]) => a.localeCompare(b));

            // Remove existing containers from DOM
            for (const [channel, container] of this.streamContainers) {
                if (container.parentNode) {
                    console.log(`Removing ${channel} from DOM`);
                    container.parentNode.removeChild(container);
                }
            }

            // Re-add in sorted order
            for (const [channel, container] of containers) {
                console.log(`Re-adding ${channel} to grid`);
                this.grid.grid.appendChild(container);
            }
        }

        /**
         * Clean up grid by removing streams that are no longer live
         */
        cleanupGrid() {
            const toRemove = [];
            for (const [channel, container] of this.streamContainers) {
                if (!this.liveStreams.has(channel)) {
                    toRemove.push(channel);
                }
            }

            for (const channel of toRemove) {
                console.log(`Cleaning up offline stream: ${channel}`);
                // Check both the map and the DOM
                if (this.streamContainers.has(channel)) {
                    const container = this.streamContainers.get(channel);
                    if (container && container.parentNode) {
                        container.remove();
                    }
                    this.streamContainers.delete(channel);
                }

                // Also check for any orphaned DOM elements
                const orphanedContainer = document.getElementById(`ksm-stream-${channel}`);
                if (orphanedContainer && orphanedContainer.parentNode) {
                    console.warn(`Removing orphaned container for ${channel}`);
                    orphanedContainer.remove();
                }
            }

            if (toRemove.length > 0) {
                this.updateGridLayout();
                this.updateStatus();
                this.updateLiveChannelList();

                // Hide grid if no streams left
                if (this.streamContainers.size === 0) {
                    this.toggleGrid(false);
                }
            }
        }

        /**
         * Apply theme changes
         */
        applyTheme() {
            // Basic theme switching - could be expanded
            const theme = this.config.theme;

            if (theme === 'light') {
                // Light theme styles would go here
                console.log('Switching to light theme');
            } else if (theme === 'auto') {
                // Auto theme based on system preference
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                console.log('Auto theme - dark mode:', prefersDark);
            } else {
                // Dark theme (default)
                console.log('Using dark theme');
            }
        }

        /**
         * Start monitoring streams
         */
        startMonitoring() {
            if (this.monitoringInterval) {
                console.log('Monitoring already running, restarting...');
                clearInterval(this.monitoringInterval);
            }

            console.log('Starting stream monitoring...');

            // Initial check
            this.checkStreams();

            // Set up periodic checking
            this.monitoringInterval = setInterval(() => {
                this.checkStreams();
                this.cleanupGrid();
            }, this.config.pollInterval);

            // Store globally for cleanup
            window.ksmMonitoringInterval = this.monitoringInterval;

            this.updateStatus();
        }

        /**
         * Stop monitoring streams
         */
        stopMonitoring() {
            if (this.monitoringInterval) {
                clearInterval(this.monitoringInterval);
                this.monitoringInterval = null;
            }

            console.log('Stopping stream monitoring...');
            this.updateStatus();
        }

        /**
         * Debug function to check stored config (call from console: window.ksmDebugConfig())
         */
        debugConfig() {
            console.log('🥒 === DEBUG CONFIG ===');
            console.log('Current config:', this.config);
            console.log('Stored values:');
            for (const [key, defaultValue] of Object.entries(DEFAULT_CONFIG)) {
                const stored = GM_getValue(key);
                console.log(`  ${key}:`, stored);
            }
            console.log('===================');
        }

        /**
         * Clean up all resources
         */
        cleanup() {
            // Stop monitoring
            this.stopMonitoring();

            // Remove all stream containers
            for (const [channel, container] of this.streamContainers) {
                container.remove();
            }
            this.streamContainers.clear();
            this.liveStreams.clear();

            // Hide grid
            this.toggleGrid(false);

            // Remove GUI
            if (this.gui && this.gui.container) {
                this.gui.container.remove();
            }

            if (this.grid && this.grid.container) {
                this.grid.container.remove();
            }

            // Clear initialization flag
            window.ksmInitialized = false;

            console.log('Kick Stream Monitor cleaned up');
        }

        /**
         * Check status of monitored streams
         */
        checkStreams() {
            const channels = this.config.monitoredChannels;

            // Also check current page if it's a Kick channel
            const currentChannel = this.getCurrentChannel();
            if (currentChannel && !channels.includes(currentChannel)) {
                channels.push(currentChannel);
            }

            for (const channel of channels) {
                this.checkChannelStatus(channel);
            }
        }

        /**
         * Extract channel name from current URL if on Kick.com
         */
        getCurrentChannel() {
            if (!window.location.hostname.includes('kick.com')) {
                return null;
            }

            // Match patterns like:
            // https://kick.com/channelname
            // https://kick.com/channelname/video/123
            const match = window.location.pathname.match(/^\/([^\/]+)(?:\/|$)/);
            if (match && match[1]) {
                const channel = match[1].toLowerCase();
                // Skip if it's not a valid channel (has numbers, special chars, etc.)
                if (!channel.includes('.') && !channel.includes('@') && channel.length > 2) {
                    return channel;
                }
            }

            return null;
        }

        /**
         * Parse URLs to extract Kick channel names
         */
        parseChannelFromUrl(url) {
            try {
                const urlObj = new URL(url);
                if (urlObj.hostname.includes('kick.com')) {
                    const match = urlObj.pathname.match(/^\/([^\/]+)(?:\/|$)/);
                    if (match && match[1]) {
                        return match[1].toLowerCase();
                    }
                }
            } catch (error) {
                console.error('Error parsing URL:', error);
            }
            return null;
        }

        /**
         * Check if a specific channel is live
         */
        checkChannelStatus(channel, retryCount = 0) {
            // First try to get live status from Kick API
            this.checkChannelStatusAPI(channel, retryCount);
        }

        /**
         * Check channel status using Kick API
         */
        checkChannelStatusAPI(channel, retryCount = 0) {
            const apiUrl = `https://kick.com/api/v2/channels/${channel}`;

            GM_xmlhttpRequest({
                method: 'GET',
                url: apiUrl,
                timeout: 8000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache'
                },
                onload: (response) => {
                    try {
                        if (response.status === 200) {
                            const data = JSON.parse(response.responseText);
                            // Check if channel exists and has livestream data
                            const isLive = data && data.livestream && data.livestream.is_live === true;
                            console.log(`${channel} API check - exists: ${!!data}, has_livestream: ${!!data?.livestream}, is_live: ${data?.livestream?.is_live}`);
                            this.handleChannelStatus(channel, isLive);
                        } else if (response.status === 404) {
                            // Channel doesn't exist
                            console.log(`${channel} - channel not found (404)`);
                            this.handleChannelStatus(channel, false);
                        } else {
                            console.warn(`${channel} API returned status ${response.status}, falling back to HTML`);
                            // Fallback to HTML scraping
                            this.checkChannelStatusHTML(channel, retryCount);
                        }
                    } catch (error) {
                        console.error(`Error parsing API response for ${channel}:`, error);
                        // Fallback to HTML scraping
                        this.checkChannelStatusHTML(channel, retryCount);
                    }
                },
                onerror: (error) => {
                    console.error(`API error for ${channel} (attempt ${retryCount + 1}):`, error);
                    // Fallback to HTML scraping
                    this.checkChannelStatusHTML(channel, retryCount);
                },
                ontimeout: () => {
                    console.warn(`API timeout for ${channel} (attempt ${retryCount + 1})`);
                    // Fallback to HTML scraping
                    this.checkChannelStatusHTML(channel, retryCount);
                }
            });
        }

        /**
         * Check channel status by scraping HTML (fallback method)
         */
        checkChannelStatusHTML(channel, retryCount = 0) {
            const url = `https://kick.com/${channel}`;

            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                onload: (response) => {
                    if (response.status === 200) {
                        const isLive = this.detectLiveStatus(response.responseText, channel);
                        this.handleChannelStatus(channel, isLive);
                    } else {
                        console.warn(`HTTP ${response.status} for ${channel}`);
                        this.handleChannelStatus(channel, false);
                    }
                },
                onerror: (error) => {
                    console.error(`HTML error for ${channel} (attempt ${retryCount + 1}):`, error);

                    if (retryCount < this.config.maxRetries) {
                        setTimeout(() => {
                            this.checkChannelStatus(channel, retryCount + 1);
                        }, this.config.retryDelay);
                    } else {
                        this.handleChannelStatus(channel, false);
                    }
                },
                ontimeout: () => {
                    console.warn(`HTML timeout for ${channel} (attempt ${retryCount + 1})`);

                    if (retryCount < this.config.maxRetries) {
                        setTimeout(() => {
                            this.checkChannelStatus(channel, retryCount + 1);
                        }, this.config.retryDelay);
                    } else {
                        this.handleChannelStatus(channel, false);
                    }
                }
            });
        }

        /**
         * Detect if a channel is live from HTML content
         */
        detectLiveStatus(html, channel) {
            try {
                // Create a temporary DOM parser to analyze the HTML
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');

                // Method 1: Check for LIVE text elements
                const liveElements = doc.querySelectorAll('*');
                let hasLiveText = false;
                for (const element of liveElements) {
                    const text = element.textContent?.toUpperCase() || '';
                    if (text.includes('LIVE') && !text.includes('OFFLINE')) {
                        hasLiveText = true;
                        break;
                    }
                }

                // Method 2: Check for video player elements that indicate active streaming
                const hasVideoPlayer = doc.querySelector('video') ||
                                      doc.querySelector('[data-testid*="player"]') ||
                                      doc.querySelector('.player-container') ||
                                      doc.querySelector('#player') ||
                                      doc.querySelector('[class*="player"]') ||
                                      doc.querySelector('[class*="video"]');

                // Method 3: Check for streaming-specific elements
                const hasStreamingUI = doc.querySelector('[data-testid*="chat"]') ||
                                      doc.querySelector('.chat-container') ||
                                      doc.querySelector('[class*="chat"]:not([class*="editor"])') ||
                                      doc.querySelector('.stream-info') ||
                                      doc.querySelector('[data-testid*="stream"]') ||
                                      doc.querySelector('.channel-root--live') ||
                                      doc.querySelector('[class*="live-indicator"]');

                // Method 4: Check for WebSocket connections (indicates active streaming)
                const hasWebSocket = html.includes('websocket') ||
                                   html.includes('ws://') ||
                                   html.includes('wss://');

                // Method 5: Check for viewer count or stream stats
                const hasViewerCount = /\d+\s*(viewer|watching|watching now)/i.test(html) ||
                                     doc.querySelector('[data-testid*="viewer"]') ||
                                     doc.querySelector('.viewer-count');

                // Method 6: Check for Kick-specific live streaming elements
                const hasKickLiveUI = doc.querySelector('[data-testid="channel-player"]') ||
                                     doc.querySelector('.player-wrapper') ||
                                     doc.querySelector('[class*="channel"][class*="live"]') ||
                                     doc.querySelector('.livestream-container');

                // Determine if live based on multiple indicators
                // Prioritize the most reliable indicators
                const indicators = [hasLiveText, hasVideoPlayer, hasStreamingUI, hasWebSocket, hasViewerCount, hasKickLiveUI];
                const positiveIndicators = indicators.filter(Boolean).length;

                // Log all results for debugging
                console.log(`${channel} - Live indicators:`, {
                    hasLiveText,
                    hasVideoPlayer,
                    hasStreamingUI,
                    hasWebSocket,
                    hasViewerCount,
                    hasKickLiveUI,
                    total: positiveIndicators
                });

                // Require at least 4 positive indicators AND must have Live text + either video player or WebSocket
                const hasEssentialIndicators = hasLiveText && (hasVideoPlayer || hasWebSocket);
                return positiveIndicators >= 4 && hasEssentialIndicators;

            } catch (error) {
                console.error(`Error parsing HTML for ${channel}:`, error);
                // Fallback to simple text search
                return html.includes('LIVE') && !html.includes('OFFLINE');
            }
        }

        /**
         * Handle channel status change
         */
        handleChannelStatus(channel, isLive) {
            const wasLive = this.liveStreams.has(channel);
            const wasEmpty = this.liveStreams.size === 0;

            if (isLive && !wasLive) {
                // Channel went live
                console.log(`${channel} is now live!`);
                this.liveStreams.add(channel);
                this.onStreamLive(channel, wasEmpty);
            } else if (!isLive && wasLive) {
                // Channel went offline
                console.log(`${channel} is now offline`);
                this.liveStreams.delete(channel);
                this.onStreamOffline(channel);
            }
        }

        /**
         * Handle stream going live
         */
        onStreamLive(channel, wasEmpty = false) {
            console.log(`Adding ${channel} to grid`);

            // Double-check that this channel is actually in our live streams set
            if (!this.liveStreams.has(channel)) {
                console.warn(`${channel} not in live streams set, skipping grid addition`);
                return;
            }

            // Ensure grid exists (create it if running on non-Kick page)
            if (!this.grid || !this.grid.container) {
                console.log('Creating grid for stream addition');
                this.createGrid();
            }

            // Check if we already have this stream
            if (this.streamContainers.has(channel)) {
                console.log(`${channel} already exists in grid`);
                return;
            }

            // Additional check: remove any existing container with this channel ID from DOM
            const existingContainer = document.getElementById(`ksm-stream-${channel}`);
            if (existingContainer) {
                console.warn(`Removing duplicate container for ${channel}`);
                existingContainer.remove();
                this.streamContainers.delete(channel);
            }

            // Create stream container
            this.createStreamContainer(channel);
            this.updateGridLayout();
            this.updateStatus();
            this.updateLiveChannelList();

            // Show grid if hidden
            this.toggleGrid(true);

            // Play sound notification for every stream going live
            this.playSoundNotification();

            // Trigger pickle rain if this was the first stream after being empty
            if (wasEmpty) {
                this.triggerPickleRain();
            }
        }

        /**
         * Handle stream going offline
         */
        onStreamOffline(channel) {
            console.log(`Removing ${channel} from grid`);

            if (this.streamContainers.has(channel)) {
                const container = this.streamContainers.get(channel);
                container.remove();
                this.streamContainers.delete(channel);
            }

            this.liveStreams.delete(channel);
            this.updateGridLayout();
            this.updateStatus();
            this.updateLiveChannelList();

            // Hide grid if no streams left
            if (this.streamContainers.size === 0) {
                this.toggleGrid(false);
            }
        }

        /**
         * Create a stream container for a channel
         */
        createStreamContainer(channel) {
            const container = document.createElement('div');
            container.className = 'ksm-stream-container live';
            container.id = `ksm-stream-${channel}`;

            // Header
            const header = document.createElement('div');
            header.className = 'ksm-stream-header';

            const title = document.createElement('div');
            title.className = 'ksm-stream-title';
            title.textContent = channel;

            const controls = document.createElement('div');
            controls.className = 'ksm-stream-controls';

            // Control buttons
            const closeBtn = document.createElement('button');
            closeBtn.className = 'ksm-stream-btn danger';
            closeBtn.textContent = '✕';
            closeBtn.title = 'Close stream';
            closeBtn.onclick = () => this.removeStream(channel);

            controls.appendChild(closeBtn);

            header.appendChild(title);
            header.appendChild(controls);

            // Content
            const content = document.createElement('div');
            content.className = 'ksm-stream-content';

            // Stream player area
            const player = document.createElement('div');
            player.className = 'ksm-stream-player';
            player.innerHTML = `
                <div style="color: #666; text-align: center;">
                    <div class="ksm-loading"></div>
                    <br>Loading ${channel}...
                    <br><small style="color: #53fc18; font-weight: bold;">▶️ 🔇 Auto-playing muted</small>
                </div>
            `;

            content.appendChild(player);

            // Chat area (if enabled)
            if (this.config.showChat) {
                const chat = document.createElement('div');
                chat.className = 'ksm-stream-chat';
                chat.style.width = this.config.chatWidth + 'px';

                const chatHeader = document.createElement('div');
                chatHeader.className = 'ksm-chat-header';
                chatHeader.textContent = 'Chat';

                const chatContent = document.createElement('div');
                chatContent.className = 'ksm-chat-content';
                chatContent.innerHTML = '<iframe src="" style="width: 100%; height: 100%; border: none;"></iframe>';

                chat.appendChild(chatHeader);
                chat.appendChild(chatContent);
                content.appendChild(chat);
            }

            container.appendChild(header);
            container.appendChild(content);

            // Add to grid
            if (this.grid && this.grid.grid) {
                console.log(`Adding ${channel} container to grid`);
                this.grid.grid.appendChild(container);
                this.streamContainers.set(channel, container);
            } else {
                console.error(`Grid not available for ${channel}`);
            }

            // Load stream content
            this.loadStreamContent(channel, player);
        }

        /**
         * Update grid layout based on number of streams and settings
         */
        updateGridLayout() {
            const streamCount = this.streamContainers.size;

            if (streamCount === 0) {
                this.grid.noStreamsMsg.style.display = 'block';
                return;
            }

            this.grid.noStreamsMsg.style.display = 'none';

            // Let CSS Grid handle the layout automatically with responsive sizing
            // Remove any JavaScript overrides and let the CSS minmax() do its job
            this.grid.grid.style.gridTemplateColumns = '';

            console.log(`Grid layout updated: ${streamCount} streams, CSS Grid auto-sizing active`);
        }

        /**
         * Load stream content (player and chat)
         */
        loadStreamContent(channel, playerElement) {
            // For now, create iframe with Kick embed
            // In production, this would use official Kick embed APIs

            // Use Kick's official embed format - simple and clean!
            const embedUrl = `https://player.kick.com/${channel}`;
            const iframe = document.createElement('iframe');
            iframe.src = embedUrl;
            iframe.frameBorder = '0';
            iframe.scrolling = 'no';
            iframe.allowFullscreen = true;

            // Try additional mute attributes (may not work due to cross-origin)
            iframe.setAttribute('muted', 'true');
            iframe.muted = true;

            // Clear loading content and add iframe
            playerElement.innerHTML = '';
            playerElement.appendChild(iframe);

            // Load chat if enabled
            if (this.config.showChat) {
                const chatIframe = playerElement.parentElement.querySelector('.ksm-chat-content iframe');
                if (chatIframe) {
                    chatIframe.src = `https://kick.com/${channel}/chatroom`;
                }
            }

            // Try to mute after iframe loads
            iframe.onload = () => {
                console.log(`Iframe loaded for ${channel}`);
                try {
                    // Attempt to access iframe content and mute (will likely fail due to CORS)
                    if (iframe.contentWindow) {
                        // Try postMessage if Kick supports it
                        iframe.contentWindow.postMessage({ type: 'mute' }, '*');
                    }
                } catch (error) {
                    console.log(`Could not mute ${channel} - cross-origin restrictions:`, error);
                }

                // Force iframe to be visible after loading
                iframe.style.opacity = '1';
                iframe.style.visibility = 'visible';
            };

            iframe.onerror = () => {
                console.error(`Iframe failed to load for ${channel} - likely CSP blocked`);
                // Show error message to user
                playerElement.innerHTML = `
                    <div style="color: #ff6b6b; text-align: center; padding: 20px;">
                        <div>🚫 Stream blocked by site security</div>
                        <div style="font-size: 12px; margin-top: 10px;">
                            This website's security policy prevents embedding streams.<br>
                            Try opening <a href="https://kick.com/${channel}" target="_blank" style="color: #53fc18;">kick.com/${channel}</a> in a new tab.
                        </div>
                    </div>
                `;
            };

            // Ensure iframe is visible initially
            iframe.style.opacity = '1';
            iframe.style.visibility = 'visible';
        }

        /**
         * Trigger pickle rain animation when first stream goes live
         */
        triggerPickleRain() {
            console.log('🥒 PICKLE STORM! First stream detected - time to celebrate!');

            const pickleEmojis = ['🥒', '🥒', '🥒', '🥒', '🥒', '🥒', '🥒', '🥒', '🥒', '🥒', '🥒', '🥒'];
            const pickleClasses = ['dill', 'sweet', 'sour', 'gherkin', 'cucumber', 'jar'];

            // Create a massive pickle storm - 24 pickles total!
            const totalPickles = 24;
            const waves = 3; // 3 waves of pickles
            const picklesPerWave = totalPickles / waves;

            for (let wave = 0; wave < waves; wave++) {
                for (let i = 0; i < picklesPerWave; i++) {
                    setTimeout(() => {
                        const pickle = document.createElement('div');
                        pickle.className = `ksm-pickle-rain ${pickleClasses[i % pickleClasses.length]}`;

                        // Use more variety in pickle emojis
                        const emojiIndex = Math.floor(Math.random() * pickleEmojis.length);
                        pickle.textContent = pickleEmojis[emojiIndex];

                        // Distribute across the full width with more randomness
                        const basePosition = (i / picklesPerWave) * 100; // Even distribution
                        const randomOffset = (Math.random() - 0.5) * 200; // -100px to +100px variation
                        pickle.style.left = `calc(${basePosition}% + ${randomOffset}px)`;

                        // Add slight size variation for more chaos
                        const sizeVariation = 0.8 + Math.random() * 0.4; // 0.8x to 1.2x scale
                        pickle.style.fontSize = `${32 * sizeVariation}px`;

                        document.body.appendChild(pickle);

                        // Remove pickle after animation completes (6 seconds max for longer animation)
                        setTimeout(() => {
                            if (pickle.parentNode) {
                                pickle.parentNode.removeChild(pickle);
                            }
                        }, 6000);
                    }, wave * 800 + i * 100); // Stagger waves and individual drops
                }
            }

            // Show a celebration message
            this.showPickleRainNotification();
        }

        /**
         * Play sound notification when someone goes live
         */
        playSoundNotification() {
            if (!this.config.soundEnabled) return;

            try {
                const audio = new Audio('https://raw.githubusercontent.com/TheWhiteSasquatch/Pickles/refs/heads/master/incoming.mp3');
                audio.volume = 0.7; // Set volume to 70% to not be too loud
                audio.play().catch(error => {
                    console.log('🥒 Sound notification failed to play:', error);
                    // This is expected on many sites due to autoplay policies
                });
            } catch (error) {
                console.log('🥒 Sound notification error:', error);
            }
        }

        /**
         * Show a celebration notification for pickle rain
         */
        showPickleRainNotification() {
            // Remove any existing celebration
            const existingCelebration = document.querySelector('.ksm-celebration-bubble');
            if (existingCelebration) {
                existingCelebration.remove();
            }

            // Create celebration bubble
            const celebration = document.createElement('div');
            celebration.className = 'ksm-celebration-bubble';
            celebration.innerHTML = `
                <div style="text-align: center; font-size: 24px; margin-bottom: 10px;">
                    🎉 🥒 PICKLE RAIN! 🥒 🎉
                </div>
                <div style="text-align: center; font-size: 14px;">
                    Someone went live! Time to get pickled!
                </div>
            `;

            // Position in center of screen
            celebration.style.position = 'fixed';
            celebration.style.top = '50%';
            celebration.style.left = '50%';
            celebration.style.transform = 'translate(-50%, -50%)';
            celebration.style.zIndex = '10002';
            celebration.style.pointerEvents = 'none';
            celebration.style.opacity = '0';
            celebration.style.transition = 'all 0.5s ease';

            document.body.appendChild(celebration);

            // Animate in
            setTimeout(() => {
                celebration.style.opacity = '1';
                celebration.style.transform = 'translate(-50%, -50%) scale(1.1)';
            }, 10);

            // Animate out after 3 seconds
            setTimeout(() => {
                celebration.style.opacity = '0';
                celebration.style.transform = 'translate(-50%, -50%) scale(0.9)';
                setTimeout(() => {
                    if (celebration.parentNode) {
                        celebration.parentNode.removeChild(celebration);
                    }
                }, 500);
            }, 3000);
        }

        /**
         * Update status display
         */
        updateStatus() {
            const statusElement = document.getElementById('ksm-status');
            if (statusElement) {
                const isOnKick = window.location.hostname.includes('kick.com');
                let statusText;

                if (isOnKick) {
                    const status = this.monitoringInterval ? 'Monitoring Active' : 'Ready (click logo)';
                    statusText = `Status: ${status} | Live streams: ${this.liveStreams.size}`;
                } else {
                    statusText = `Status: Cross-site GUI | Live streams: ${this.liveStreams.size}`;
                    if (this.monitoringInterval) {
                        statusText += ' | Monitoring active';
                    } else {
                        statusText += ' | Click logo to start monitoring';
                    }

                    // Add CSP warning for cross-site usage
                    if (this.cspIssues && this.cspIssues.length > 0) {
                        statusText += ' ⚠️ CSP restrictions may limit functionality';
                    }
                }

                statusElement.textContent = statusText;
            }
        }
    }

    // Initialize the Pickle Patrol!
    new PicklePatrolMonitor();

})();
