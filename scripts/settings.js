// settings.js - Handles persistent settings for the Lora Manager application

class Settings {
    constructor() {
        this.defaultSettings = {
            modelsDirectory: '', // Removed hardcoded path
            theme: 'dark',
            defaultView: 'grid',
            defaultSort: 'name-asc',
            hideNSFW: false,
            visibleColumns: {
                thumbnail: true,
                filename: true,
                civitaiName: true,
                baseModel: true,
                category: true,
                path: true,
                size: true,
                date: true,
                url: true,
                nsfw: true,
                positiveWords: true,
                negativeWords: true,
                authorsWords: true,
                description: true,
                notes: true,
                modelName: false,
                modelVersion: false,
                highLow: false
            },
            columnOrder: [
                'thumbnail',
                'filename',
                'civitaiName',
                'baseModel',
                'category',
                'folder',
                'subcategory',
                'creator',
                'examplePrompt',
                'tags',
                'path',
                'size',
                'date',
                'url',
                'nsfw',
                'positiveWords',
                'negativeWords',
                'authorsWords',
                'description',
                'notes',
                'modelName',
                'modelVersion',
                'highLow'
            ]
        };

        this.settings = { ...this.defaultSettings };
        // Initialize with default settings, then load from server/localStorage
        this.loadSettings().then(() => {
            console.log('Settings loaded asynchronously');
        }).catch(error => {
            console.error('Error loading settings:', error);
        });
    }

    // Load settings from server first, then localStorage
    async loadSettings() {
        try {
            // First try to load from server
            try {
                const response = await fetch('/load-settings');
                if (response.ok) {
                    const serverSettings = await response.json();
                    this.settings = serverSettings;
                    // Save to localStorage for offline use
                    localStorage.setItem('loraManagerSettings', JSON.stringify(this.settings));
                    console.log('Settings loaded from server:', this.settings);
                    return;
                }
            } catch (serverError) {
                console.error('Error loading settings from server:', serverError);
            }

            // If server load fails, try localStorage
            const savedSettings = localStorage.getItem('loraManagerSettings');
            if (savedSettings) {
                this.settings = JSON.parse(savedSettings);
            } else {
                this.settings = { ...this.defaultSettings };
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            this.settings = { ...this.defaultSettings };
        }
    }

    // Save settings to localStorage and server's config.json
    async saveSettings() {
        try {
            // Save to localStorage
            localStorage.setItem('loraManagerSettings', JSON.stringify(this.settings));

            // Save to server's config.json
            try {
                const response = await fetch('/save-settings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(this.settings)
                });

                if (!response.ok) {
                    console.error('Error saving settings to server:', response.statusText);
                }
            } catch (serverError) {
                console.error('Error communicating with server:', serverError);
            }

            return true;
        } catch (error) {
            console.error('Error saving settings:', error);
            return false;
        }
    }

    // Get a specific setting
    getSetting(key) {
        return this.settings[key] !== undefined ? this.settings[key] : this.defaultSettings[key];
    }

    // Set a specific setting
    async setSetting(key, value) {
        this.settings[key] = value;
        return await this.saveSettings();
    }

    // Get all settings
    getAllSettings() {
        return { ...this.settings };
    }

    // Reset settings to default
    resetSettings() {
        this.settings = { ...this.defaultSettings };
        return this.saveSettings();
    }

    // Export settings to a file
    exportSettings() {
        const dataStr = JSON.stringify(this.settings, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

        const exportFileDefaultName = 'lora-manager-settings.json';

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    }

    // Import settings from a file
    importSettings(jsonString) {
        try {
            const importedSettings = JSON.parse(jsonString);

            // Validate imported settings
            for (const key in this.defaultSettings) {
                if (importedSettings[key] === undefined) {
                    importedSettings[key] = this.defaultSettings[key];
                }
            }

            this.settings = importedSettings;
            this.saveSettings();
            return true;
        } catch (error) {
            console.error('Error importing settings:', error);
            return false;
        }
    }
}

// Create a singleton instance
const appSettings = new Settings();

// Export the singleton and the Settings class
export { Settings };
export default appSettings;