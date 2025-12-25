// ==UserScript==
// @name         Pickle Patrol Stream Monitor
// @namespace    https://kick.com/
// @version      1.0.10
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
// @connect      raw.githubusercontent.com
// @connect      https://raw.githubusercontent.com
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

    // Main application class - The Pickle Patrol!
    class PicklePatrolMonitor {
        constructor() {
            this.liveStreams = new Map(); // platform -> Set of channels
            this.monitoringInterval = null;
            this.gui = null;
            this.grid = null;
            this.streamContainers = new Map();

            // Load config asynchronously and then initialize
            this.loadConfig().then(config => {
                this.config = config;

                // Migrate legacy monitoredChannels to new platform structure (if needed)
                if (this.config.monitoredChannels && !GM_getValue('migration_v2_complete')) {
                    console.log('🥒 Migrating legacy channels to platform structure');
                    this.config.platforms.kick.channels = this.config.monitoredChannels;
                    // Mark migration as complete
                    GM_setValue('migration_v2_complete', true);
                    this.saveConfig();
                }

                this.init();
            });
        }

        /**
         * Initialize the application
         */
        init() {
            console.log('🚔 Pickle Patrol initializing... Time to pickle some streams!');

            // Create persistent elements immediately for visual continuity
            this.createPersistentElements();

            // Wait for page load
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.onPageLoad());
            } else {
                this.onPageLoad();
            }
        }

        /**
         * Create persistent elements early for visual continuity
         */
        createPersistentElements() {
            // Only create if not already exists (prevent duplicates)
            if (document.getElementById('ksm-persistent-container')) {
                return;
            }

            // Create a persistent container that survives navigation
            const persistentContainer = document.createElement('div');
            persistentContainer.id = 'ksm-persistent-container';
            persistentContainer.style.cssText = `
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                pointer-events: none !important;
                z-index: 9999 !important;
                opacity: 1 !important;
            `;

            // Add to body immediately if available, otherwise to documentElement
            if (document.body) {
                document.body.appendChild(persistentContainer);
            } else if (document.documentElement) {
                document.documentElement.appendChild(persistentContainer);
            }

            // Set up mutation observer to maintain elements
            this.setupPersistenceObserver();
        }

        /**
         * Set up mutation observer for element persistence
         */
        setupPersistenceObserver() {
            // Watch for DOM changes that might remove our elements
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        // Check if our persistent container was removed
                        const persistentContainer = document.getElementById('ksm-persistent-container');
                        if (!persistentContainer && document.body) {
                            console.log('🥒 Restoring persistent container');
                            this.createPersistentElements();
                        }

                        // Check if main GUI container was removed
                        const guiContainer = document.querySelector('.ksm-container');
                        if (!guiContainer && this.gui && this.gui.container && document.body) {
                            console.log('🥒 Restoring GUI container');
                            document.body.appendChild(this.gui.container);
                        }

                        // Check if grid container was removed
                        const gridContainer = document.getElementById('ksm-grid-container');
                        if (!gridContainer && this.grid && this.grid.container && document.body) {
                            console.log('🥒 Restoring grid container');
                            document.body.appendChild(this.grid.container);
                        }
                    }
                });
            });

            // Start observing
            if (document.body) {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            }

            // Also observe documentElement for early changes
            observer.observe(document.documentElement, {
                childList: true,
                subtree: false
            });
        }

        /**
         * Handle page load
         */
        onPageLoad() {
            console.log('🥒 Pickle Patrol onPageLoad triggered');

            // Skip if running in an iframe to prevent recursive initialization
            if (window.self !== window.top) {
                console.log('Kick Stream Monitor skipping iframe context');
                return;
            }

            console.log('🥒 Not in iframe, proceeding with initialization');

            // Check if already initialized on this page
            if (window.ksmInitialized) {
                console.log('🥒 Pickle Patrol already on duty on this page!');
                return;
            }

            console.log('🥒 First time initialization, marking as initialized');
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


            // Fallback: Create simple logo if main GUI failed
            setTimeout(() => {
                if (!document.querySelector('.ksm-container')) {
                    console.warn('🥒 Main GUI failed to create, creating fallback logo');
                    this.createFallbackLogo();
                }
            }, 1000);

            if (isKickPage) {
                // Full functionality on Kick.com pages - but wait for user interaction
                console.log('🥒 Pickle Patrol ready on Kick.com - click logo to activate monitoring');
            } else {
                // Cross-site functionality - check if we should auto-start monitoring
                const shouldAutoStart = this.shouldAutoStartMonitoring();

                if (shouldAutoStart) {
                    console.log('🥒 Auto-starting monitoring (within 30min window)');
                    this.startMonitoring();
                } else {
                    console.log('🥒 Cross-site patrol ready - click logo to start monitoring');
                }

                // Store CSP issues for status display
                this.cspIssues = cspIssues;
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
            window.ksmDebugGUI = () => {
                console.log('🥒 === GUI DEBUG ===');
                console.log('GUI object:', this.gui);
                console.log('GUI container exists:', !!this.gui?.container);
                console.log('GUI container in DOM:', !!document.querySelector('.ksm-container'));
                console.log('Body exists:', !!document.body);
                console.log('Document ready state:', document.readyState);
                console.log('Is in iframe:', window.self !== window.top);
                console.log('Current URL:', window.location.href);
                console.log('===================');
                return this.gui;
            };
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
         * Fetch default channels from GitHub
         */
        async fetchDefaultChannels() {
            return new Promise((resolve) => {
                const channelsUrl = 'https://raw.githubusercontent.com/TheWhiteSasquatch/Pickles/refs/heads/master/channels.json';

                console.log('🥒 Attempting to fetch channels from GitHub:', channelsUrl);

                // Check if GM_xmlhttpRequest is available
                if (typeof GM_xmlhttpRequest === 'undefined') {
                    console.warn('🥒 GM_xmlhttpRequest not available, falling back to fetch');
                    // Fallback to regular fetch if GM_xmlhttpRequest isn't available
                    fetch(channelsUrl)
                        .then(response => {
                            if (response.ok) {
                                return response.json();
                            } else {
                                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                            }
                        })
                        .then(data => {
                            if (data.monitoredChannels && Array.isArray(data.monitoredChannels)) {
                                console.log('🥒 Fetched channels from GitHub (fallback fetch):', data.monitoredChannels);
                                resolve(data.monitoredChannels);
                            } else {
                                console.warn('🥒 Invalid data structure from GitHub');
                                resolve(this.getFallbackChannels());
                            }
                        })
                        .catch(error => {
                            console.warn('🥒 Fetch fallback failed:', error.message);
                            resolve(this.getFallbackChannels());
                        });
                    return;
                }

                GM_xmlhttpRequest({
                    method: 'GET',
                    url: channelsUrl,
                    timeout: 10000, // Increased timeout
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (compatible; PicklePatrol/1.0)'
                    },
                    onload: (response) => {
                        console.log('🥒 GM_xmlhttpRequest onload, status:', response.status);
                        try {
                            if (response.status === 200) {
                                const data = JSON.parse(response.responseText);
                                if (data.monitoredChannels && Array.isArray(data.monitoredChannels)) {
                                    console.log('🥒 Successfully fetched channels from GitHub:', data.monitoredChannels.length, 'channels');
                                    resolve(data.monitoredChannels);
                                    return;
                                } else {
                                    console.warn('🥒 GitHub response missing monitoredChannels array');
                                }
                            } else {
                                console.warn('🥒 GitHub returned non-200 status:', response.status, response.statusText);
                            }
                        } catch (error) {
                            console.warn('🥒 Error parsing GitHub response:', error);
                        }
                        // Fallback to hardcoded list
                        console.log('🥒 Falling back to hardcoded channels');
                        resolve(this.getFallbackChannels());
                    },
                    onerror: (error) => {
                        console.error('🥒 GM_xmlhttpRequest onerror:', {
                            status: error.status,
                            statusText: error.statusText,
                            url: channelsUrl,
                            error: error
                        });
                        resolve(this.getFallbackChannels());
                    },
                    ontimeout: () => {
                        console.warn('🥒 GM_xmlhttpRequest timeout after 10s - check @connect permissions and network');
                        resolve(this.getFallbackChannels());
                    }
                });
            });
        }

        /**
         * Get fallback hardcoded channels
         */
        getFallbackChannels() {
            return [
                'ppwashington',
                'rampagejackson',
                'predatorpoachers',
                'ppillinois',
                'bikersagainstpredators',
                'opp_oklahoma',
                'pplongisland',
                'asmongold',
                'shortbus122',
                'smokenscanog',
                'thejourneyland',
                'ryangarcia',
                'bigbadwolf83',
                'coloradopedpatrol',
                'arizonapredatorprevention',
                'adinross',
                'ninadrama'
            ];
        }

        /**
         * Load configuration from storage
         */
        async loadConfig() {
            // Create default config with fallback channels first
            const fallbackChannels = this.getFallbackChannels();
            let kickChannels = fallbackChannels;

            // Try to fetch updated channels from GitHub
            console.log('🥒 Starting GitHub channel fetch...');
            try {
                const githubChannels = await this.fetchDefaultChannels();
                if (githubChannels && githubChannels.length > fallbackChannels.length) {
                    kickChannels = githubChannels;
                    console.log('🥒 ✅ Successfully loaded', githubChannels.length, 'channels from GitHub');
                } else {
                    console.log('🥒 GitHub channels not better than fallback, using fallback');
                }
            } catch (error) {
                console.error('🥒 ❌ Failed to load GitHub channels:', error);
                console.log('🥒 Using fallback channels');
            }

            const defaultConfig = {
                enabled: true,
                monitoredChannels: kickChannels,
                pollInterval: 300000, // 5 minutes
                maxRetries: 3,
                retryDelay: 5000, // 5 seconds
                gridColumns: 2,
                gridRows: 2,
                maxStreams: 2, // Suggested default (2 streams), no actual limit
                showChat: true,
                theme: 'dark',
                soundEnabled: false,
                gridWidth: null, // Auto-sized initially
                gridHeight: null, // Auto-sized initially
                streamPositions: {}, // Saved positions for individual streams
                lastMonitoringEnabled: null, // Timestamp when monitoring was last enabled
                // Platform support
                platforms: {
                    kick: {
                        enabled: true,
                        channels: kickChannels,
                        pollInterval: 300000 // 5 minutes
                    }
                }
            };

            // Load from storage with defaults
            const config = {};
            for (const [key, defaultValue] of Object.entries(defaultConfig)) {
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
         * Save GUI position and state for persistence
         */
        saveGUIState() {
            if (this.gui && this.gui.container) {
                const rect = this.gui.container.getBoundingClientRect();
                const guiState = {
                    position: {
                        top: this.gui.container.style.top || '20px',
                        right: this.gui.container.style.right || '20px',
                        left: this.gui.container.style.left || 'auto'
                    },
                    buttonsVisible: this.gui.container.querySelector('.ksm-buttons')?.classList.contains('show') || false,
                    panelVisible: this.gui.panel?.classList.contains('show') || false
                };
                GM_setValue('ksm_gui_state', guiState);
            }
        }

        /**
         * Restore GUI position and state from storage
         */
        restoreGUIState() {
            const guiState = GM_getValue('ksm_gui_state');
            if (guiState && this.gui && this.gui.container) {
                // Restore position
                if (guiState.position) {
                    this.gui.container.style.top = guiState.position.top;
                    this.gui.container.style.right = guiState.position.right;
                    this.gui.container.style.left = guiState.position.left;
                }

                // Restore visibility states
                if (guiState.buttonsVisible && this.gui.buttonsContainer) {
                    this.gui.buttonsContainer.classList.add('show');
                }
                if (guiState.panelVisible && this.gui.panel) {
                    this.gui.panel.classList.add('show');
                }
            }
        }

        /**
         * Create the GUI interface
         */
        createGUI() {
            console.log('🥒 Creating GUI...');

            // Basic GUI skeleton - will be expanded in later phases
            this.gui = {
                container: null,
                button: null,
                panel: null
            };

            // Add CSS styles
            GM_addStyle(`
                .ksm-container {
                    position: fixed !important;
                    top: 20px !important;
                    right: 20px !important;
                    z-index: 10000 !important;
                    font-family: 'Comic Sans MS', cursive, Arial, sans-serif !important;
                    font-size: 14px !important;
                    text-align: center !important;
                    pointer-events: auto !important;
                    opacity: 1 !important;
                    visibility: visible !important;
                    /* Fixed width to prevent stretching */
                    width: 60px !important;
                    /* Use flex but prevent expansion */
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
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

                .ksm-container.dragging {
                    opacity: 0.8 !important;
                    transform: scale(1.05) !important;
                    box-shadow: 0 6px 20px rgba(83, 252, 24, 0.6) !important;
                }

                .ksm-container.dragging .ksm-logo {
                    cursor: grabbing !important;
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
                    /* Prevent buttons from stretching container */
                    position: relative;
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
                    position: absolute !important;
                    top: 70px !important; /* Position below the logo/buttons */
                    right: 0 !important;
                    background: linear-gradient(135deg, rgba(0, 0, 0, 0.95), rgba(30, 30, 30, 0.95));
                    color: white;
                    padding: 15px;
                    border-radius: 15px;
                    min-width: 320px;
                    max-width: 380px;
                    max-height: 70vh;
                    overflow-y: auto;
                    box-shadow: 0 8px 25px rgba(83, 252, 24, 0.2);
                    border: 3px solid #53fc18;
                    backdrop-filter: blur(10px);
                    z-index: 10001 !important; /* Higher than container */
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
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    z-index: 9998; /* Lower than GUI but higher than page content */
                    display: none;
                    pointer-events: none;
                    /* Allow streams to be positioned anywhere on screen */
                    overflow: visible;
                    min-width: 100vw;
                    min-height: 100vh;
                }



                .ksm-grid-container.active {
                    display: block;
                    pointer-events: auto;
                }

                .ksm-stream-grid {
                    position: relative;
                    height: 100%;
                    pointer-events: auto;
                    /* Allow absolute positioning of child streams */
                }

                .ksm-stream-container {
                    background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
                    border: 3px solid #333;
                    border-radius: 15px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    position: absolute;
                    min-width: 280px;
                    min-height: 200px;
                    width: 320px;
                    height: 240px;
                    box-shadow: 0 6px 20px rgba(0,0,0,0.6);
                    transition: all 0.3s ease;
                    cursor: move;
                    z-index: 1;
                }

                .ksm-stream-container:hover {
                    box-shadow: 0 8px 25px rgba(0,0,0,0.7);
                }

                .ksm-stream-container.live {
                    border-color: #53fc18;
                    box-shadow: 0 0 30px rgba(83, 252, 24, 0.4), 0 8px 25px rgba(0,0,0,0.7);
                    background: linear-gradient(135deg, #1a2a1a, #2a3a2a);
                }


                .ksm-stream-container.dragging {
                    opacity: 0.8;
                    transform: rotate(2deg);
                    z-index: 1000;
                    cursor: grabbing;
                }

                /* Individual stream resize handles */
                .ksm-stream-container::after {
                    content: '↗';
                    position: absolute;
                    bottom: 0;
                    right: 0;
                    width: 25px;
                    height: 25px;
                    background: linear-gradient(-45deg, transparent 0%, transparent 25%, #4CAF50 25%, #4CAF50 75%, transparent 75%);
                    border: 2px solid #4CAF50;
                    border-top: none;
                    border-left: none;
                    cursor: nw-resize;
                    pointer-events: auto;
                    z-index: 1000;
                    opacity: 0.7;
                    transition: all 0.2s ease;
                    font-size: 12px;
                    color: white;
                    display: flex;
                    align-items: flex-end;
                    justify-content: flex-end;
                    padding: 1px;
                    font-weight: bold;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
                }

                .ksm-stream-container:hover::after {
                    opacity: 1;
                    background: linear-gradient(-45deg, transparent 0%, transparent 20%, #66BB6A 20%, #66BB6A 80%, transparent 80%);
                    border-color: #66BB6A;
                }

                .ksm-stream-container.resizing {
                    opacity: 0.9;
                    z-index: 1001;
                }

                .ksm-stream-container.resizing::after {
                    opacity: 1;
                    background: linear-gradient(-45deg, transparent 0%, transparent 15%, #FF9800 15%, #FF9800 85%, transparent 85%);
                    border-color: #FF9800;
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
                    min-width: 200px; /* More flexible minimum */
                    min-height: 150px; /* More flexible minimum */
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
                    max-height: 400px; /* Reasonable max height */
                    overflow-y: auto; /* Scroll when content exceeds height */
                    overflow-x: hidden;
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

                /* THICK PICKLE INVASION - Really thick pickles from all sides! */
                .ksm-thick-pickle {
                    position: fixed;
                    z-index: 10002; /* Higher than regular rain */
                    pointer-events: none;
                    font-size: 120px; /* ENORMOUS pickles! */
                    opacity: 0;
                    animation-fill-mode: forwards;
                }

                /* Top invasion - pickles poking down from top */
                .ksm-thick-pickle.top-invasion {
                    top: -150px;
                    animation: ksm-pickle-top-invasion 3s ease-out;
                }

                /* Bottom invasion - pickles poking up from bottom */
                .ksm-thick-pickle.bottom-invasion {
                    bottom: -150px;
                    animation: ksm-pickle-bottom-invasion 3s ease-out;
                }

                /* Left invasion - pickles poking right from left side */
                .ksm-thick-pickle.left-invasion {
                    left: -150px;
                    animation: ksm-pickle-left-invasion 3s ease-out;
                }

                /* Right invasion - pickles poking left from right side */
                .ksm-thick-pickle.right-invasion {
                    right: -150px;
                    animation: ksm-pickle-right-invasion 3s ease-out;
                }

                /* Top invasion animation - poke down then bounce back */
                @keyframes ksm-pickle-top-invasion {
                    0% {
                        transform: translateY(0) rotate(0deg) scale(0.3);
                        opacity: 0;
                    }
                    15% {
                        transform: translateY(200px) rotate(45deg) scale(2.5);
                        opacity: 1;
                    }
                    30% {
                        transform: translateY(150px) rotate(-30deg) scale(3);
                        opacity: 1;
                    }
                    45% {
                        transform: translateY(250px) rotate(60deg) scale(2.2);
                        opacity: 1;
                    }
                    60% {
                        transform: translateY(180px) rotate(-45deg) scale(2.8);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(-300px) rotate(720deg) scale(0.1);
                        opacity: 0;
                    }
                }

                /* Bottom invasion animation - poke up then bounce back */
                @keyframes ksm-pickle-bottom-invasion {
                    0% {
                        transform: translateY(0) rotate(0deg) scale(0.3);
                        opacity: 0;
                    }
                    15% {
                        transform: translateY(-200px) rotate(-45deg) scale(2.5);
                        opacity: 1;
                    }
                    30% {
                        transform: translateY(-150px) rotate(30deg) scale(3);
                        opacity: 1;
                    }
                    45% {
                        transform: translateY(-250px) rotate(-60deg) scale(2.2);
                        opacity: 1;
                    }
                    60% {
                        transform: translateY(-180px) rotate(45deg) scale(2.8);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(300px) rotate(-720deg) scale(0.1);
                        opacity: 0;
                    }
                }

                /* Left invasion animation - poke right then bounce back */
                @keyframes ksm-pickle-left-invasion {
                    0% {
                        transform: translateX(0) rotate(0deg) scale(0.3);
                        opacity: 0;
                    }
                    15% {
                        transform: translateX(200px) rotate(45deg) scale(2.5);
                        opacity: 1;
                    }
                    30% {
                        transform: translateX(150px) rotate(-30deg) scale(3);
                        opacity: 1;
                    }
                    45% {
                        transform: translateX(250px) rotate(60deg) scale(2.2);
                        opacity: 1;
                    }
                    60% {
                        transform: translateX(180px) rotate(-45deg) scale(2.8);
                        opacity: 1;
                    }
                    100% {
                        transform: translateX(-300px) rotate(720deg) scale(0.1);
                        opacity: 0;
                    }
                }

                /* Right invasion animation - poke left then bounce back */
                @keyframes ksm-pickle-right-invasion {
                    0% {
                        transform: translateX(0) rotate(0deg) scale(0.3);
                        opacity: 0;
                    }
                    15% {
                        transform: translateX(-200px) rotate(-45deg) scale(2.5);
                        opacity: 1;
                    }
                    30% {
                        transform: translateX(-150px) rotate(30deg) scale(3);
                        opacity: 1;
                    }
                    45% {
                        transform: translateX(-250px) rotate(-60deg) scale(2.2);
                        opacity: 1;
                    }
                    60% {
                        transform: translateX(-180px) rotate(45deg) scale(2.8);
                        opacity: 1;
                    }
                    100% {
                        transform: translateX(300px) rotate(-720deg) scale(0.1);
                        opacity: 0;
                    }
                }

            `);

            // Create container
            const container = document.createElement('div');
            container.className = 'ksm-container';

            // Add logo
            const logo = document.createElement('img');
            logo.src = 'https://i.imgur.com/LhrC00r.jpeg';
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

            // Platform settings section
            const platformSection = document.createElement('div');
            platformSection.className = 'ksm-section';
            platformSection.innerHTML = `
                <h3>📺 Streaming Platforms</h3>
                <label class="ksm-toggle">
                    <input type="checkbox" id="ksm-kick-enabled" ${this.config.platforms.kick.enabled ? 'checked' : ''}>
                    🥒 Enable Kick.com Monitoring
                </label>
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
            channelHeader.textContent = '📺 Stream Channels';
            channelSection.appendChild(channelHeader);

            // Live channels list
            const liveHeader = document.createElement('h4');
            liveHeader.textContent = '📺 Live Streams';
            liveHeader.style.color = '#53fc18';
            liveHeader.style.margin = '6px 0 3px 0';
            liveHeader.style.fontSize = '13px';
            channelSection.appendChild(liveHeader);

            const liveChannelList = document.createElement('div');
            liveChannelList.className = 'ksm-channel-list';
            liveChannelList.id = 'ksm-live-channel-list';
            this.updateLiveChannelList(liveChannelList);
            channelSection.appendChild(liveChannelList);

            // Kick channels
            if (this.config.platforms.kick.enabled) {
                const kickHeader = document.createElement('h4');
                kickHeader.textContent = '🥒 Kick Channels';
                kickHeader.style.color = '#53fc18';
                kickHeader.style.margin = '8px 0 3px 0';
                kickHeader.style.fontSize = '13px';
                channelSection.appendChild(kickHeader);

                // Add Kick channel input
                const kickAddContainer = document.createElement('div');
                kickAddContainer.className = 'ksm-input-group';
                kickAddContainer.style.marginBottom = '8px';

                const kickInput = document.createElement('input');
                kickInput.type = 'text';
                kickInput.placeholder = 'Add Kick username (e.g., ppwashington)';
                kickInput.style.width = 'calc(100% - 60px)';
                kickInput.style.marginRight = '4px';

                const kickAddBtn = document.createElement('button');
                kickAddBtn.className = 'ksm-button';
                kickAddBtn.textContent = 'Add';
                kickAddBtn.style.fontSize = '12px';
                kickAddBtn.style.padding = '6px 12px';
                kickAddBtn.onclick = () => {
                    const newChannel = kickInput.value.trim().toLowerCase();
                    if (newChannel && !this.config.platforms.kick.channels.includes(newChannel)) {
                        this.config.platforms.kick.channels.push(newChannel);
                        this.saveConfig();
                        this.updateKickChannelList();
                        this.updateLiveChannelList();
                        kickInput.value = '';
                    }
                };

                kickAddContainer.appendChild(kickInput);
                kickAddContainer.appendChild(kickAddBtn);
                channelSection.appendChild(kickAddContainer);

                const kickChannelList = document.createElement('div');
                kickChannelList.className = 'ksm-channel-list';
                kickChannelList.id = 'ksm-kick-channel-list';
                this.updateKickChannelList(kickChannelList);
                channelSection.appendChild(kickChannelList);
            }


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
            panel.appendChild(platformSection);
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
            console.log('🥒 GUI container appended to document.body');

            this.gui.container = container;
            this.gui.buttonsContainer = buttonsContainer;
            this.gui.button = button;
            this.gui.gridButton = gridButton;
            this.gui.panel = panel;

            // Restore saved GUI state for persistence
            this.restoreGUIState();

            // Initialize lists
            this.updateLiveChannelList();
            this.updateChannelList();

            // Initialize theme
            this.applyTheme();

            // Make GUI draggable for better persistence
            this.makeGUIDraggable();
        }

        /**
         * Make GUI draggable for persistent positioning
         */
        makeGUIDraggable() {
            if (!this.gui || !this.gui.container) return;

            const container = this.gui.container;
            let isDragging = false;
            let startX, startY, startLeft, startTop;

            // Make the logo the drag handle
            const dragHandle = container.querySelector('.ksm-logo');
            if (!dragHandle) return;

            dragHandle.style.cursor = 'move';
            dragHandle.style.userSelect = 'none';

            const handleMouseDown = (e) => {
                if (e.target !== dragHandle) return; // Only drag from logo

                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;

                const rect = container.getBoundingClientRect();
                startLeft = rect.left;
                startTop = rect.top;

                // Prevent text selection during drag
                e.preventDefault();

                // Add drag class for visual feedback
                container.classList.add('dragging');
            };

            const handleMouseMove = (e) => {
                if (!isDragging) return;

                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;

                const newLeft = startLeft + deltaX;
                const newTop = startTop + deltaY;

                // Keep within viewport bounds
                const maxLeft = window.innerWidth - container.offsetWidth;
                const maxTop = window.innerHeight - container.offsetHeight;

                container.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
                container.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
                container.style.right = 'auto'; // Clear right positioning when manually positioned
            };

            const handleMouseUp = () => {
                if (!isDragging) return;

                isDragging = false;
                container.classList.remove('dragging');

                // Save new position for persistence
                this.saveGUIState();
            };

            // Add event listeners
            dragHandle.addEventListener('mousedown', handleMouseDown);
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            // Touch support for mobile
            dragHandle.addEventListener('touchstart', (e) => {
                const touch = e.touches[0];
                handleMouseDown({
                    target: dragHandle,
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    preventDefault: () => e.preventDefault()
                });
            });

            document.addEventListener('touchmove', (e) => {
                if (!isDragging) return;
                const touch = e.touches[0];
                handleMouseMove({
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
            });

            document.addEventListener('touchend', handleMouseUp);
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

            // Restore saved grid size if available, otherwise use a smaller default
            if (this.config.gridWidth && this.config.gridHeight) {
                gridContainer.style.width = `${this.config.gridWidth}px`;
                gridContainer.style.height = `${this.config.gridHeight}px`;
            } else {
                // Default to a more visible size so users can see the resize handle
                gridContainer.style.width = `1000px`;
                gridContainer.style.height = `600px`; // Larger default so resize handle is visible
            }

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
            // Save state for persistence
            setTimeout(() => this.saveGUIState(), 10);
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

                // Save state for persistence
                setTimeout(() => this.saveGUIState(), 10);
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
                // Update GUI position when grid is shown
                setTimeout(() => this.updateGUIPosition(), 10);
            } else {
                this.grid.container.classList.remove('active');
                // Reset GUI to default position when grid is hidden
                if (this.gui && this.gui.container) {
                    this.gui.container.style.left = 'auto';
                    this.gui.container.style.right = '20px';
                }
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

            const soundToggle = panel.querySelector('#ksm-sound-enabled');
            soundToggle.onchange = (e) => {
                this.config.soundEnabled = e.target.checked;
                this.saveConfig();
            };

            // Platform settings
            const kickEnabledToggle = panel.querySelector('#ksm-kick-enabled');
            kickEnabledToggle.onchange = (e) => {
                this.config.platforms.kick.enabled = e.target.checked;
                this.saveConfig();
                this.updateStatus();
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
        updateLiveChannelList(container = null) { // eslint-disable-line
            const liveChannelList = container || document.getElementById('ksm-live-channel-list');
            if (!liveChannelList) return;

            liveChannelList.innerHTML = '';

            const totalLiveStreams = this.getTotalLiveStreams();
            if (totalLiveStreams === 0) {
                const emptyMsg = document.createElement('div');
                emptyMsg.style.padding = '8px';
                emptyMsg.style.color = '#666';
                emptyMsg.style.fontStyle = 'italic';
                emptyMsg.textContent = 'No live streams detected';
                liveChannelList.appendChild(emptyMsg);
                return;
            }

            // Collect all live streams with their platforms
            const allLiveStreams = [];
            for (const [platform, streams] of this.liveStreams) {
                for (const channel of streams) {
                    allLiveStreams.push({ channel, platform });
                }
            }

            // Sort by platform then channel name
            allLiveStreams.sort((a, b) => {
                if (a.platform !== b.platform) {
                    return a.platform.localeCompare(b.platform);
                }
                return a.channel.localeCompare(b.channel);
            });

            allLiveStreams.forEach(({ channel, platform }) => {
                const item = document.createElement('div');
                item.className = 'ksm-channel-item';

                const nameSpan = document.createElement('span');
                nameSpan.className = 'ksm-channel-name';
                nameSpan.textContent = channel;
                nameSpan.style.fontWeight = 'bold';

                // Platform-specific styling
                nameSpan.style.color = '#53fc18';
                nameSpan.textContent += ' 🥒';

                const viewBtn = document.createElement('button');
                viewBtn.className = 'ksm-stream-btn';
                viewBtn.textContent = '🥒';
                viewBtn.title = `View ${platform} stream in grid`;
                viewBtn.onclick = () => this.toggleGrid(true);

                item.appendChild(nameSpan);
                item.appendChild(viewBtn);
                liveChannelList.appendChild(item);
            });
        }

        /**
         * Update the Kick channel list display
         */
        updateKickChannelList(container = null) {
            const channelList = container || document.getElementById('ksm-kick-channel-list');
            if (!channelList) return;

            channelList.innerHTML = '';

            this.config.platforms.kick.channels.forEach((channel, index) => {
                const item = document.createElement('div');
                item.className = 'ksm-channel-item';

                const nameSpan = document.createElement('span');
                nameSpan.className = 'ksm-channel-name';
                nameSpan.textContent = channel;

                // Show live status indicator
                const kickStreams = this.liveStreams.get('kick') || new Set();
                const isLive = kickStreams.has(channel);
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
                removeBtn.title = 'Remove channel';
                removeBtn.onclick = () => {
                    this.config.platforms.kick.channels.splice(index, 1);
                    this.saveConfig();
                    this.updateKickChannelList();
                    this.updateLiveChannelList();
                };

                item.appendChild(nameSpan);
                item.appendChild(removeBtn);
                channelList.appendChild(item);
            });
        }


        /**
         * Update the monitored channel list display (legacy method for backward compatibility)
         */
        updateChannelList() {
            this.updateKickChannelList();
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
                if (!this.isChannelLive(channel)) {
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

            // Save timestamp when monitoring was enabled
            this.config.lastMonitoringEnabled = Date.now();
            this.saveConfig();

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
         * Check status of monitored streams across all platforms
         */
        checkStreams() {
            // Check Kick streams
            if (this.config.platforms.kick.enabled) {
                const kickChannels = this.config.platforms.kick.channels;

            // Also check current page if it's a Kick channel
            const currentChannel = this.getCurrentChannel();
                if (currentChannel && !kickChannels.includes(currentChannel)) {
                    kickChannels.push(currentChannel);
                }

                for (const channel of kickChannels) {
                    this.checkChannelStatus(channel, 'kick');
                }
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
        handleChannelStatus(channel, isLive, platform = 'kick') {
            // Initialize platform set if it doesn't exist
            if (!this.liveStreams.has(platform)) {
                this.liveStreams.set(platform, new Set());
            }

            const platformStreams = this.liveStreams.get(platform);
            const wasLive = platformStreams.has(channel);
            const totalStreamsBefore = this.getTotalLiveStreams();

            if (isLive && !wasLive) {
                // Channel went live
                console.log(`📺 ${platform.toUpperCase()}: ${channel} is now live!`);
                platformStreams.add(channel);
                this.onStreamLive(channel, platform, totalStreamsBefore === 0);
            } else if (!isLive && wasLive) {
                // Channel went offline
                console.log(`📺 ${platform.toUpperCase()}: ${channel} is now offline`);
                platformStreams.delete(channel);
                this.onStreamOffline(channel, platform);
            }
        }

        /**
         * Get total number of live streams across all platforms
         */
        getTotalLiveStreams() {
            let total = 0;
            for (const platformStreams of this.liveStreams.values()) {
                total += platformStreams.size;
            }
            return total;
        }

        /**
         * Check if a channel is currently live across all platforms
         */
        isChannelLive(channel) {
            for (const platformStreams of this.liveStreams.values()) {
                if (platformStreams.has(channel)) {
                    return true;
                }
            }
            return false;
        }




        /**
         * Handle stream going live
         */
        onStreamLive(channel, platform = 'kick', wasEmpty = false) {
            console.log(`Adding ${channel} to grid`);

            // Double-check that this channel is actually in our live streams set
            if (!this.isChannelLive(channel)) {
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
            this.createStreamContainer(channel, platform);
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
        createStreamContainer(channel, platform = 'kick') {
            const container = document.createElement('div');
            container.className = `ksm-stream-container live`;
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

                const chatHeader = document.createElement('div');
                chatHeader.className = 'ksm-chat-header';
                chatHeader.textContent = 'Chat';

                const chatContent = document.createElement('div');
                chatContent.className = 'ksm-chat-content';
                chatContent.innerHTML = '<iframe src="" style="width: 100%; height: 100%; border: none; min-height: 300px;"></iframe>';

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

                // Position the stream - restore saved position or use default layout
                if (!this.restoreStreamPosition(channel)) {
                    // Default positioning for new streams
                    this.positionNewStream(container, channel);
                }

                // Initialize drag functionality
                this.initializeStreamDragging(container, channel);

                // Initialize resize functionality
                this.initializeStreamResizing(container, channel);

                // Restore saved size if available
                this.restoreStreamSize(channel);
            } else {
                console.error(`Grid not available for ${channel}`);
            }

            // Load stream content
            this.loadStreamContent(channel, player, platform);
        }

        /**
         * Initialize drag functionality for a stream container
         */
        initializeStreamDragging(container, channel) {
            let isDragging = false;
            let startX, startY, initialLeft, initialTop;
            let dragStartTime = 0;

            // Mouse down event - start dragging
            container.addEventListener('mousedown', (e) => {
                // Only start drag if clicking on the container itself (not buttons or controls)
                if (e.target.closest('.ksm-stream-controls') || e.target.closest('.ksm-stream-btn')) {
                    return;
                }

                // Check if clicking on resize handle - if so, don't start dragging
                const containerRect = container.getBoundingClientRect();
                const clickX = e.clientX;
                const clickY = e.clientY;
                const isOnResizeHandle = clickX >= containerRect.right - 25 && clickX <= containerRect.right &&
                                        clickY >= containerRect.bottom - 25 && clickY <= containerRect.bottom;
                if (isOnResizeHandle) {
                    return; // Let the resize handler take care of this
                }

                isDragging = true;
                dragStartTime = Date.now();
                startX = e.clientX;
                startY = e.clientY;

                const dragRect = container.getBoundingClientRect();
                initialLeft = dragRect.left;
                initialTop = dragRect.top;

                container.classList.add('dragging');
                container.style.zIndex = '1000';

                // Prevent text selection during drag
                document.body.style.userSelect = 'none';

                e.preventDefault();
            });

            // Mouse move event - handle dragging
            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;

                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;

                const newLeft = initialLeft + deltaX;
                const newTop = initialTop + deltaY;

                // Allow dragging anywhere on the screen (within viewport bounds)
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const containerRect = container.getBoundingClientRect();

                // Keep streams within viewport bounds (but allow them to go off-screen if user wants)
                const constrainedLeft = Math.max(0, Math.min(newLeft, viewportWidth - containerRect.width));
                const constrainedTop = Math.max(0, Math.min(newTop, viewportHeight - containerRect.height));

                container.style.left = `${constrainedLeft}px`;
                container.style.top = `${constrainedTop}px`;
            });

            // Mouse up event - stop dragging
            document.addEventListener('mouseup', () => {
                if (!isDragging) return;

                isDragging = false;
                container.classList.remove('dragging');
                container.style.zIndex = '1';
                document.body.style.userSelect = '';

                // Save position if drag lasted more than 200ms (to avoid accidental moves)
                if (Date.now() - dragStartTime > 200) {
                    this.saveStreamPosition(channel);
                }
            });
        }

        /**
         * Initialize resize functionality for a stream container
         */
        initializeStreamResizing(container, channel) {
            let isResizing = false;
            let startX, startY, startWidth, startHeight;

            // Mouse down event - start resizing
            container.addEventListener('mousedown', (e) => {
                // Check if clicking on the resize handle (bottom-right corner)
                const rect = container.getBoundingClientRect();
                const clickX = e.clientX;
                const clickY = e.clientY;

                // Check if click is within the resize handle area (bottom-right 25x25px)
                const isOnResizeHandle = clickX >= rect.right - 25 && clickX <= rect.right &&
                                        clickY >= rect.bottom - 25 && clickY <= rect.bottom;

                if (!isOnResizeHandle) return;

                console.log('🥒 Starting stream resize for', channel);

                isResizing = true;
                startX = e.clientX;
                startY = e.clientY;
                startWidth = rect.width;
                startHeight = rect.height;

                container.classList.add('resizing');

                // Prevent text selection during resize
                document.body.style.userSelect = 'none';
                document.body.style.cursor = 'nw-resize';

                e.preventDefault();
                e.stopPropagation();
            });

            // Mouse move event - handle resizing
            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;

                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;

                const newWidth = Math.max(280, startWidth + deltaX); // Minimum width of 280px
                const newHeight = Math.max(200, startHeight + deltaY); // Minimum height of 200px

                container.style.width = `${newWidth}px`;
                container.style.height = `${newHeight}px`;

                // Update layout if needed
                this.updateGridLayout();
            });

            // Mouse up event - stop resizing
            document.addEventListener('mouseup', () => {
                if (!isResizing) return;

                console.log('🥒 Ending stream resize for', channel);

                isResizing = false;
                container.classList.remove('resizing');
                document.body.style.userSelect = '';
                document.body.style.cursor = '';

                // Save new size
                const rect = container.getBoundingClientRect();
                this.saveStreamSize(channel, rect.width, rect.height);
            });
        }

        /**
         * Save the size of a stream container
         */
        saveStreamSize(channel, width, height) {
            if (!this.config.streamSizes) {
                this.config.streamSizes = {};
            }
            this.config.streamSizes[channel] = { width, height };
            this.saveConfig();
            console.log(`🥒 Saved size for ${channel}:`, { width, height });
        }

        /**
         * Restore the size of a stream container
         */
        restoreStreamSize(channel) {
            if (!this.config.streamSizes || !this.config.streamSizes[channel]) {
                return false;
            }

            const container = this.streamContainers.get(channel);
            if (!container) return false;

            const { width, height } = this.config.streamSizes[channel];
            container.style.width = `${width}px`;
            container.style.height = `${height}px`;

            console.log(`🥒 Restored size for ${channel}:`, { width, height });
            return true;
        }

        /**
         * Save the position of a stream container
         */
        saveStreamPosition(channel) {
            const container = this.streamContainers.get(channel);
            if (!container) return;

            const containerRect = container.getBoundingClientRect();

            const position = {
                left: containerRect.left,
                top: containerRect.top,
                width: containerRect.width,
                height: containerRect.height
            };

            if (!this.config.streamPositions) {
                this.config.streamPositions = {};
            }

            this.config.streamPositions[channel] = position;
            this.saveConfig();

            console.log(`🥒 Saved position for ${channel}:`, position);
        }

        /**
         * Restore the position of a stream container
         */
        restoreStreamPosition(channel) {
            const container = this.streamContainers.get(channel);
            if (!container || !this.config.streamPositions || !this.config.streamPositions[channel]) {
                return false;
            }

            const position = this.config.streamPositions[channel];

            // Ensure positions are within viewport bounds
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            const safeLeft = Math.max(0, Math.min(position.left, viewportWidth - position.width));
            const safeTop = Math.max(0, Math.min(position.top, viewportHeight - position.height));

            container.style.left = `${safeLeft}px`;
            container.style.top = `${safeTop}px`;
            container.style.width = `${position.width}px`;
            container.style.height = `${position.height}px`;

            console.log(`🥒 Restored position for ${channel}:`, { left: safeLeft, top: safeTop, width: position.width, height: position.height });
            return true;
        }

        /**
         * Position a new stream in a default layout
         */
        positionNewStream(container, channel) {
            const streams = Array.from(this.streamContainers.keys());
            const streamIndex = streams.indexOf(channel);

            // Spread streams across the screen in a more distributed layout
            const baseLeft = 50 + (streamIndex * 100) % (window.innerWidth - 400);
            const baseTop = 100 + Math.floor(streamIndex / 4) * 100;

            container.style.left = `${baseLeft}px`;
            container.style.top = `${baseTop}px`;
            container.style.width = '320px';
            container.style.height = '240px';

            console.log(`🥒 Positioned new stream ${channel} at (${baseLeft}, ${baseTop})`);
        }

        /**
         * Ensure all streams stay within grid bounds
         */
        constrainStreamsToGrid() {
            if (!this.grid || !this.grid.container) return;

            const gridRect = this.grid.container.getBoundingClientRect();

            for (const [channel, container] of this.streamContainers) {
                const containerRect = container.getBoundingClientRect();

                let needsUpdate = false;
                let newLeft = parseFloat(container.style.left) || 0;
                let newTop = parseFloat(container.style.top) || 0;

                // Constrain to grid bounds
                if (containerRect.left < gridRect.left) {
                    newLeft = 0;
                    needsUpdate = true;
                } else if (containerRect.right > gridRect.right) {
                    newLeft = gridRect.width - containerRect.width;
                    needsUpdate = true;
                }

                if (containerRect.top < gridRect.top) {
                    newTop = 0;
                    needsUpdate = true;
                } else if (containerRect.bottom > gridRect.bottom) {
                    newTop = gridRect.height - containerRect.height;
                    needsUpdate = true;
                }

                if (needsUpdate) {
                    container.style.left = `${newLeft}px`;
                    container.style.top = `${newTop}px`;
                    this.saveStreamPosition(channel);
                    console.log(`🥒 Constrained ${channel} to grid bounds`);
                }
            }
        }

        /**
         * Update grid layout based on number of streams
         */
        updateGridLayout() {
            const streamCount = this.streamContainers.size;

            if (streamCount === 0) {
                this.grid.noStreamsMsg.style.display = 'block';
                return;
            }

            this.grid.noStreamsMsg.style.display = 'none';

            // Update chat heights to match video containers
            this.updateChatHeights();

            console.log(`Grid layout updated: ${streamCount} streams with free positioning`);
        }

        /**
         * Update GUI position based on grid location
         */
        updateGUIPosition() {
            if (!this.gui || !this.gui.container || !this.grid || !this.grid.container) return;

            const gridRect = this.grid.container.getBoundingClientRect();
            const guiRect = this.gui.container.getBoundingClientRect();
            const viewportWidth = window.innerWidth;

            // Check if grid covers the right side where GUI normally sits
            const guiRightEdge = 20 + guiRect.width; // 20px margin + GUI width
            const gridLeftEdge = gridRect.left;

            // If grid extends to cover the GUI's normal position, move GUI to left
            if (gridRect.left < guiRightEdge && gridRect.right > 20) {
                this.gui.container.style.right = 'auto';
                this.gui.container.style.left = '20px';
                console.log('🥒 GUI moved to left side to avoid grid overlap');
            } else {
                // Reset to default right position
                this.gui.container.style.left = 'auto';
                this.gui.container.style.right = '20px';
                console.log('🥒 GUI moved back to right side');
            }
        }

        /**
         * Create a simple fallback logo if main GUI fails
         */
        createFallbackLogo() {
            console.log('🥒 Creating fallback logo');

            // Remove any existing fallback logos
            const existingFallback = document.querySelector('.ksm-fallback-logo');
            if (existingFallback) {
                existingFallback.remove();
            }

            const logo = document.createElement('img');
            logo.src = 'https://i.imgur.com/LhrC00r.jpeg';
            logo.className = 'ksm-fallback-logo';
            logo.alt = 'Pickle Patrol Logo (Fallback)';
            logo.title = 'Pickle Patrol - Click to retry GUI creation';

            logo.style.cssText = `
                position: fixed !important;
                top: 20px !important;
                right: 20px !important;
                width: 50px !important;
                height: 50px !important;
                border-radius: 50% !important;
                cursor: pointer !important;
                transition: all 0.3s ease !important;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
                border: 2px solid #53fc18 !important;
                background: #f0f8e7 !important;
                opacity: 0.9 !important;
                z-index: 10000 !important;
            `;

            logo.onmouseover = () => {
                logo.style.opacity = '1';
                logo.style.transform = 'scale(1.1)';
            };

            logo.onmouseout = () => {
                logo.style.opacity = '0.9';
                logo.style.transform = 'scale(1)';
            };

            logo.onclick = () => {
                console.log('🥒 Fallback logo clicked - retrying GUI creation');
                logo.remove();
                this.createGUI();
            };

            // Add to page
            if (document.body) {
                document.body.appendChild(logo);
                console.log('🥒 Fallback logo created successfully');
            } else {
                console.error('🥒 Cannot create fallback logo - no document.body');
            }
        }

        /**
         * Check if monitoring should auto-start based on 30-minute window
         */
        shouldAutoStartMonitoring() {
            if (!this.config.lastMonitoringEnabled) {
                return false; // Never enabled before
            }

            const now = Date.now();
            const timeSinceLastEnabled = now - this.config.lastMonitoringEnabled;
            const thirtyMinutes = 30 * 60 * 1000; // 30 minutes in milliseconds

            return timeSinceLastEnabled <= thirtyMinutes;
        }

        /**
         * Update chat container heights to match video containers
         */
        updateChatHeights() {
            // Ensure chat containers match their video container heights
            this.streamContainers.forEach((container, channel) => {
                const chatContent = container.querySelector('.ksm-chat-content');
                if (chatContent) {
                    // Reset to natural flex behavior but maintain max-height constraint
                    chatContent.style.maxHeight = '400px';
                }
            });
        }


        /**
         * Load stream content (player and chat)
         */
        loadStreamContent(channel, playerElement, platform = 'kick') {
            this.loadKickStreamContent(channel, playerElement);
        }

        /**
         * Load Kick stream content
         */
        loadKickStreamContent(channel, playerElement) {
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
                console.log(`🥒 Iframe loaded for ${channel}`);
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
                console.error(`🥒 Iframe failed to load for ${channel} - likely CSP blocked`);
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
            console.log('🥒 THICK PICKLE INVASION! First stream detected - time to celebrate!');

            // Trigger only the MASSIVE thick pickle invasion!
            this.triggerThickPickleInvasion();

            // Show a celebration message (disabled - just invasion the pickles)
            // this.showPickleRainNotification();
        }

        /**
         * Trigger MASSIVE thick pickle invasion from all sides!
         */
        triggerThickPickleInvasion() {
            console.log('🥒 THICK PICKLE INVASION! REALLY THICK PICKLES ATTACKING FROM ALL SIDES!');

            const thickPickleEmojis = ['🥒', '🥒', '🥒', '🥒', '🥒', '🥒'];
            const invasionTypes = ['top-invasion', 'bottom-invasion', 'left-invasion', 'right-invasion'];

            // Create invasion from all 4 sides - 8 massive pickles total!
            const totalThickPickles = 8;
            const picklesPerSide = totalThickPickles / invasionTypes.length;

            invasionTypes.forEach((invasionType, sideIndex) => {
                for (let i = 0; i < picklesPerSide; i++) {
                    setTimeout(() => {
                        const thickPickle = document.createElement('div');
                        thickPickle.className = `ksm-thick-pickle ${invasionType}`;

                        // Random thick pickle emoji
                        const emojiIndex = Math.floor(Math.random() * thickPickleEmojis.length);
                        thickPickle.textContent = thickPickleEmojis[emojiIndex];

                        // Position based on invasion type
                        if (invasionType === 'top-invasion' || invasionType === 'bottom-invasion') {
                            // Horizontal positioning for top/bottom invasions
                            const position = (i / picklesPerSide) * 100 + Math.random() * 20 - 10; // Add randomness
                            thickPickle.style.left = `${position}%`;
                        } else {
                            // Vertical positioning for left/right invasions
                            const position = (i / picklesPerSide) * 100 + Math.random() * 20 - 10; // Add randomness
                            thickPickle.style.top = `${position}%`;
                        }

                        // Add to body immediately
                        if (document.body) {
                            document.body.appendChild(thickPickle);
                        }

                        // Remove thick pickle after animation completes (3.5 seconds)
                        setTimeout(() => {
                            if (thickPickle.parentNode) {
                                thickPickle.parentNode.removeChild(thickPickle);
                            }
                        }, 3500);

                    }, sideIndex * 200 + i * 300); // Stagger by side, then by pickle
                }
            });
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

                    // Handle autoplay blocking with user-friendly message
                    if (error.name === 'NotAllowedError') {
                        this.showAudioBlockedNotification();
                    }
                    // This is expected on many sites due to autoplay policies
                });
            } catch (error) {
                console.log('🥒 Sound notification error:', error);
            }
        }

        /**
         * Show notification when audio is blocked by browser
         */
        showAudioBlockedNotification() {
            // Remove any existing audio notification
            const existingNotification = document.querySelector('.ksm-audio-blocked-notification');
            if (existingNotification) {
                existingNotification.remove();
            }

            // Create notification bubble
            const notification = document.createElement('div');
            notification.className = 'ksm-audio-blocked-notification';
            notification.innerHTML = `
                <div style="text-align: center; font-size: 16px; margin-bottom: 8px;">
                    🔊 Audio Blocked
                </div>
                <div style="text-align: center; font-size: 12px;">
                    Click anywhere to enable sound notifications
                </div>
            `;

            // Style the notification
            notification.style.position = 'fixed';
            notification.style.top = '50%';
            notification.style.left = '50%';
            notification.style.transform = 'translate(-50%, -50%)';
            notification.style.background = 'linear-gradient(135deg, #ff6b6b, #ee5a52)';
            notification.style.border = '3px solid #cc4444';
            notification.style.borderRadius = '15px';
            notification.style.padding = '15px';
            notification.style.zIndex = '10001';
            notification.style.boxShadow = '0 6px 20px rgba(0,0,0,0.8)';
            notification.style.fontFamily = 'Comic Sans MS, cursive, Arial, sans-serif';
            notification.style.color = 'white';
            notification.style.maxWidth = '300px';
            notification.style.cursor = 'pointer';
            notification.style.transition = 'all 0.3s ease';

            // Add click handler to dismiss and try audio again
            notification.onclick = () => {
                notification.remove();
                // Try playing a silent audio to unlock autoplay
                this.unlockAudio();
            };

            // Auto-remove after 8 seconds
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.style.opacity = '0';
                    setTimeout(() => notification.remove(), 300);
                }
            }, 8000);

            document.body.appendChild(notification);

            // Animate in
            setTimeout(() => {
                notification.style.transform = 'translate(-50%, -50%) scale(1.05)';
            }, 10);
        }

        /**
         * Try to unlock audio autoplay by playing a silent sound
         */
        unlockAudio() {
            try {
                const unlockAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IAAAAAEAAQARAAAAEAAAAAEACABkYXRhAgAAAAEA');
                unlockAudio.volume = 0.01; // Very quiet
                unlockAudio.play().then(() => {
                    console.log('🥒 Audio unlocked successfully');
                    // Try playing the actual notification sound
                    setTimeout(() => this.playSoundNotification(), 100);
                }).catch(() => {
                    console.log('🥒 Audio unlock failed');
                });
            } catch (error) {
                console.log('🥒 Audio unlock error:', error);
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

                const totalStreams = this.getTotalLiveStreams();
                const kickStreams = (this.liveStreams.get('kick') || new Set()).size;

                if (isOnKick) {
                    const status = this.monitoringInterval ? 'Monitoring Active' : 'Ready (click logo)';
                    statusText = `Status: ${status} | Live streams: ${totalStreams}`;
                    if (totalStreams > 0) {
                        statusText += ` (Kick: ${kickStreams})`;
                    }
                } else {
                    statusText = `Status: Cross-site GUI | Live streams: ${totalStreams}`;
                    if (totalStreams > 0) {
                        statusText += ` (Kick: ${kickStreams})`;
                    }
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
