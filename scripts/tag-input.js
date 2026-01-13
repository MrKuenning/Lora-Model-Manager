// tag-input.js - Modern tag input component

/**
 * TagInput - A modern tag input component
 * Creates pill-style tags with add/remove functionality
 */
export class TagInput {
    constructor(containerId, hiddenInputId, options = {}) {
        this.container = document.getElementById(containerId);
        this.hiddenInput = document.getElementById(hiddenInputId);
        this.pillsContainer = this.container?.querySelector('.tag-pills');
        this.inputField = this.container?.querySelector('.tag-input-field');

        this.tags = [];
        this.onChangeCallback = options.onChange || null;

        if (this.container && this.inputField) {
            this.init();
        }
    }

    init() {
        // Handle Enter and Tab to add tag
        this.inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                this.addTagFromInput();
            } else if (e.key === 'Backspace' && this.inputField.value === '') {
                // Remove last tag if input is empty
                this.removeLastTag();
            }
        });

        // Handle blur to add tag
        this.inputField.addEventListener('blur', () => {
            if (this.inputField.value.trim()) {
                this.addTagFromInput();
            }
        });

        // Click on container focuses input
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container || e.target === this.pillsContainer) {
                this.inputField.focus();
            }
        });
    }

    /**
     * Set tags from a comma-separated string
     */
    setTags(tagsString) {
        this.tags = [];
        if (tagsString && tagsString.trim()) {
            this.tags = tagsString.split(',')
                .map(t => t.trim())
                .filter(t => t.length > 0);
        }
        this.render();
        this.syncHiddenInput();
    }

    /**
     * Get tags as comma-separated string
     */
    getTags() {
        return this.tags.join(', ');
    }

    /**
     * Add tag from input field
     */
    addTagFromInput() {
        const value = this.inputField.value.trim();
        if (value && !this.tags.includes(value)) {
            this.tags.push(value);
            this.render();
            this.syncHiddenInput();
            this.triggerChange();
        }
        this.inputField.value = '';
    }

    /**
     * Add a tag programmatically
     */
    addTag(tag) {
        const trimmed = tag.trim();
        if (trimmed && !this.tags.includes(trimmed)) {
            this.tags.push(trimmed);
            this.render();
            this.syncHiddenInput();
            this.triggerChange();
        }
    }

    /**
     * Remove a tag by value
     */
    removeTag(tag) {
        const index = this.tags.indexOf(tag);
        if (index > -1) {
            this.tags.splice(index, 1);
            this.render();
            this.syncHiddenInput();
            this.triggerChange();
        }
    }

    /**
     * Remove the last tag (for backspace handling)
     */
    removeLastTag() {
        if (this.tags.length > 0) {
            this.tags.pop();
            this.render();
            this.syncHiddenInput();
            this.triggerChange();
        }
    }

    /**
     * Render the tag pills
     */
    render() {
        if (!this.pillsContainer) return;

        this.pillsContainer.innerHTML = this.tags.map(tag => `
            <span class="tag-pill" data-tag="${this.escapeHtml(tag)}">
                <span class="tag-text">${this.escapeHtml(tag)}</span>
                <button type="button" class="tag-remove" aria-label="Remove ${this.escapeHtml(tag)}">
                    <i class="fas fa-times"></i>
                </button>
            </span>
        `).join('');

        // Add click handlers for remove buttons
        this.pillsContainer.querySelectorAll('.tag-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const pill = btn.closest('.tag-pill');
                const tag = pill.dataset.tag;
                this.removeTag(tag);
            });
        });
    }

    /**
     * Sync with hidden input for form submission
     */
    syncHiddenInput() {
        if (this.hiddenInput) {
            this.hiddenInput.value = this.getTags();
        }
    }

    /**
     * Trigger change callback
     */
    triggerChange() {
        if (this.onChangeCallback) {
            this.onChangeCallback(this.getTags());
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Clear all tags
     */
    clear() {
        this.tags = [];
        this.render();
        this.syncHiddenInput();
    }
}
