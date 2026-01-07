import { churchtoolsClient } from '@churchtools/churchtools-client';
import type { Group, GroupMemberFieldGroup } from './utils/ct-types';
import { 
    findConfigurationField, 
    getGroupSpecificMemberFields,
    updateGroupCustomFields,
    createGroupMemberField
} from './utils/group-member-fields';
import type { 
    FieldSelectionConfiguration,
    SelectedField
} from './utils/field-mapping-types';
import { 
    parseConfiguration, 
    createEmptyConfiguration, 
    serializeConfiguration 
} from './utils/field-mapping-types';

interface AppState {
    targetGroup: Group | null;
    sourceGroup: Group | null;
    allGroups: Group[];
    filteredGroups: Group[];
    searchQuery: string;
    configField: { fieldName: string; value: string | undefined } | null;
    targetFields: GroupMemberFieldGroup[];
    sourceFields: GroupMemberFieldGroup[];
    configuration: FieldSelectionConfiguration | null;
    loading: boolean;
    error: string | null;
}

export class GroupMemberFieldPickerApp {
    private state: AppState = {
        targetGroup: null,
        sourceGroup: null,
        allGroups: [],
        filteredGroups: [],
        searchQuery: '',
        configField: null,
        targetFields: [],
        sourceFields: [],
        configuration: null,
        loading: false,
        error: null,
    };

    private container: HTMLElement;

    constructor(containerId: string) {
        const element = document.querySelector<HTMLElement>(containerId);
        if (!element) {
            throw new Error(`Container ${containerId} not found`);
        }
        this.container = element;
    }

    async init(): Promise<void> {
        await this.loadGroups();
        this.render();
    }

    private async loadGroups(): Promise<void> {
        try {
            this.state.loading = true;
            this.render();

            const response = await churchtoolsClient.get<Group[]>('/groups');
            
            console.log('Groups response:', response);
            
            this.state.allGroups = Array.isArray(response) ? response : [];
            this.state.loading = false;
            this.render();
        } catch (error) {
            console.error('Error loading groups:', error);
            this.state.error = `Fehler beim Laden der Gruppen: ${error instanceof Error ? error.message : String(error)}`;
            this.state.loading = false;
            this.render();
        }
    }

    private async onTargetGroupChange(groupId: number): Promise<void> {
        const group = this.state.allGroups.find((g) => g.id === groupId);
        if (!group) return;

        this.state.targetGroup = group;
        this.state.configField = null;
        this.state.targetFields = [];
        this.state.configuration = null;
        this.state.error = null;
        this.state.loading = true;
        this.render();

        try {
            console.log('=== Loading target group data for group', groupId, '===');
            
            // Load config field and target fields in parallel
            const [configField, targetFields] = await Promise.all([
                findConfigurationField(groupId),
                getGroupSpecificMemberFields(groupId)
            ]);

            console.log('Loaded configField:', configField);
            console.log('Loaded targetFields:', targetFields);

            this.state.configField = configField;
            this.state.targetFields = targetFields;

            // If config field exists
            if (configField) {
                if (configField.value) {
                    // Parse existing configuration
                    const parsed = parseConfiguration(configField.value);
                    if (parsed) {
                        this.state.configuration = parsed;
                        console.log('✓ Loaded existing configuration');
                    } else {
                        // Invalid JSON - create empty config
                        console.warn('Invalid configuration JSON, creating empty config');
                        this.state.configuration = createEmptyConfiguration(groupId);
                    }
                } else {
                    // Field exists but is empty - create empty configuration
                    console.log('Config field is empty, creating new configuration');
                    this.state.configuration = createEmptyConfiguration(groupId);
                }
            }

            console.log('Final state - targetFields:', this.state.targetFields);
            console.log('Final state - configuration:', this.state.configuration);

            this.state.loading = false;
            this.render();
        } catch (error) {
            console.error('Error loading target group data:', error);
            this.state.configField = null;
            this.state.targetFields = [];
            this.state.loading = false;
            this.render();
        }
    }

    private onSearchQueryChange(query: string): void {
        this.state.searchQuery = query;
        
        if (query.trim() === '') {
            this.state.filteredGroups = [];
        } else {
            const lowerQuery = query.toLowerCase();
            this.state.filteredGroups = this.state.allGroups
                .filter((g) => 
                    g.id !== this.state.targetGroup?.id && 
                    g.name.toLowerCase().includes(lowerQuery)
                )
                .slice(0, 10); // Limit to 10 results
        }
        
        this.render();
    }

    private async onSourceGroupChange(groupId: number): Promise<void> {
        const group = this.state.allGroups.find((g) => g.id === groupId);
        if (!group) return;

        this.state.sourceGroup = group;
        this.state.sourceFields = [];
        this.state.searchQuery = '';
        this.state.filteredGroups = [];
        this.state.loading = true;
        this.render();

        try {
            const fields = await getGroupSpecificMemberFields(groupId);
            this.state.sourceFields = fields;
            
            this.state.loading = false;
            this.render();
        } catch (error) {
            console.error('Error loading source group fields:', error);
            this.state.error = `Fehler beim Laden der Quellgruppenfelder: ${error}`;
            this.state.loading = false;
            this.render();
        }
    }

    private render(): void {
        this.container.innerHTML = this.getHTML();
        this.attachEventListeners();
    }

    private getHTML(): string {
        if (this.state.loading) {
            return `
                <div class="p-card p-4">
                    <div class="flex items-center gap-3">
                        <i class="pi pi-spin pi-spinner text-2xl"></i>
                        <span>Lädt...</span>
                    </div>
                </div>
            `;
        }

        if (this.state.error) {
            return `
                <div class="p-card p-4">
                    <div class="p-message p-message-error">
                        <i class="pi pi-times-circle"></i>
                        <span>${this.state.error}</span>
                    </div>
                </div>
            `;
        }

        return `
            <div class="p-card p-4">
                <h1 class="text-3xl font-bold mb-6">Gruppenmitgliedsfelder zusammensammeln</h1>
                
                ${this.renderStep1()}
                ${this.renderStep2()}
                ${this.renderStep3()}
            </div>
        `;
    }

    private renderStep1(): string {
        return `
            <div class="mb-6">
                <h2 class="text-xl font-semibold mb-3">Schritt 1: Zielgruppe</h2>
                <div class="mb-3">
                    <label for="target-group" class="block mb-2">Zielgruppe auswählen</label>
                    <select 
                        id="target-group" 
                        class="p-dropdown w-full p-2 border rounded"
                        ${this.state.allGroups.length === 0 ? 'disabled' : ''}
                    >
                        <option value="">-- Gruppe auswählen --</option>
                        ${this.state.allGroups
                            .map(
                                (g) =>
                                    `<option value="${g.id}" ${
                                        this.state.targetGroup?.id === g.id
                                            ? 'selected'
                                            : ''
                                    }>${g.name}</option>`
                            )
                            .join('')}
                    </select>
                </div>
                
                ${this.renderConfigFieldStatus()}
            </div>
        `;
    }

    private renderConfigFieldStatus(): string {
        if (!this.state.targetGroup) {
            return '';
        }

        if (this.state.configField) {
            return `
                <div class="p-message p-message-success flex items-center gap-2">
                    <i class="pi pi-check-circle"></i>
                    <span>Konfigurationsfeld gefunden: <strong>${this.state.configField.fieldName}</strong></span>
                </div>
            `;
        }

        return `
            <div class="p-message p-message-warn">
                <div class="flex items-start gap-3">
                    <i class="pi pi-exclamation-triangle text-xl"></i>
                    <div>
                        <p class="font-semibold mb-2">⚠️ Konfigurationsfeld fehlt</p>
                        <p class="mb-2">Das benötigte <strong>GRUPPENFELD</strong> (nicht Gruppenmitgliedsfeld!) wurde nicht gefunden.</p>
                        <p class="mb-3">Erforderliche Eigenschaften:</p>
                        <ul class="list-disc ml-5 mb-3">
                            <li><strong>Feldname:</strong> <code>bwl_gmfp_config</code></li>
                            <li><strong>Typ:</strong> Textarea</li>
                            <li><strong>Ort:</strong> Stammdaten → Gruppen → Felder (Custom Group Fields)</li>
                        </ul>
                        <div class="flex gap-2">
                            <button id="create-config-field" class="p-button p-button-sm">
                                <i class="pi pi-plus"></i>
                                Feld jetzt anlegen
                            </button>
                            <button id="copy-instruction" class="p-button p-button-sm p-button-secondary">
                                <i class="pi pi-copy"></i>
                                Anleitung kopieren
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    private renderStep2(): string {
        if (!this.state.targetGroup || !this.state.configField) {
            return '';
        }

        return `
            <div class="mb-6">
                <h2 class="text-xl font-semibold mb-3">Schritt 2: Quellgruppe</h2>
                
                ${this.state.sourceGroup ? `
                    <div class="p-message p-message-success mb-3">
                        <i class="pi pi-check-circle"></i>
                        <span>Ausgewählt: <strong>${this.state.sourceGroup.name}</strong></span>
                        <button id="clear-source-group" class="ml-2 text-sm underline">
                            Ändern
                        </button>
                    </div>
                ` : `
                    <div class="mb-3">
                        <label for="source-group-search" class="block mb-2">Quellgruppe suchen</label>
                        <input 
                            type="text" 
                            id="source-group-search" 
                            class="w-full p-2 border rounded"
                            placeholder="Gruppenname eingeben..."
                            value="${this.state.searchQuery}"
                        />
                    </div>
                    
                    ${this.state.searchQuery && this.state.filteredGroups.length > 0 ? `
                        <div class="border rounded max-h-64 overflow-y-auto">
                            ${this.state.filteredGroups.map((g) => `
                                <div 
                                    class="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0 source-group-option"
                                    data-group-id="${g.id}"
                                >
                                    <div class="font-medium">${g.name}</div>
                                    <div class="text-sm text-gray-600">ID: ${g.id}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : this.state.searchQuery ? `
                        <div class="p-message p-message-info">
                            <i class="pi pi-info-circle"></i>
                            <span>Keine Gruppen gefunden</span>
                        </div>
                    ` : ''}
                `}
            </div>
        `;
    }

    private renderStep3(): string {
        if (!this.state.targetGroup || !this.state.configField || !this.state.sourceGroup) {
            return '';
        }

        if (this.state.sourceFields.length === 0) {
            return `
                <div class="mb-6">
                    <h2 class="text-xl font-semibold mb-3">Schritt 3: Felder auswählen</h2>
                    <div class="p-message p-message-info">
                        <i class="pi pi-info-circle"></i>
                        <span>Die Quellgruppe "${this.state.sourceGroup.name}" hat keine Gruppenmitgliedsfelder.</span>
                    </div>
                </div>
            `;
        }

        return `
            <div class="mb-6">
                <h2 class="text-xl font-semibold mb-3">Schritt 3: Felder auswählen</h2>
                
                <div class="mb-4">
                    <p class="text-sm text-gray-600 mb-3">
                        Wählen Sie aus, welche Felder aus der Quellgruppe "${this.state.sourceGroup.name}" 
                        in die Zielgruppe übernommen werden sollen.
                        Die Felddefinitionen (Name, Typ, Optionen) werden kopiert.
                    </p>
                </div>

                ${this.renderFieldSelection()}
                
                <div class="flex gap-2 mt-4">
                    <button id="create-fields" class="p-button">
                        <i class="pi pi-plus"></i>
                        Ausgewählte Felder anlegen
                    </button>
                    <button id="save-selection" class="p-button p-button-secondary">
                        <i class="pi pi-save"></i>
                        Auswahl speichern
                    </button>
                </div>
            </div>
        `;
    }

    private renderFieldSelection(): string {
        if (!this.state.configuration || !this.state.sourceGroup) {
            return '';
        }

        // Get all existing reference names in target group
        const existingReferenceNames = new Set(
            this.state.targetFields.map(f => f.referenceName)
        );

        return `
            <div class="border rounded p-4 mb-4">
                <div class="space-y-2">
                    ${this.state.sourceFields.map((field) => {
                        const alreadyExists = existingReferenceNames.has(field.referenceName);
                        const isSelected = this.state.configuration?.selectedFields.some(
                            sf => sf.sourceGroupId === this.state.sourceGroup!.id && sf.fieldId === field.id
                        ) || false;

                        return `
                            <div class="flex items-center gap-3 p-2 ${alreadyExists ? 'bg-gray-100' : ''}">
                                <input 
                                    type="checkbox" 
                                    class="field-checkbox"
                                    data-group-id="${this.state.sourceGroup!.id}"
                                    data-field-id="${field.id}"
                                    ${isSelected ? 'checked' : ''}
                                    ${alreadyExists ? 'disabled' : ''}
                                />
                                <div class="flex-1">
                                    <div class="font-medium">${field.name}</div>
                                    <div class="text-sm text-gray-600">
                                        Typ: ${field.fieldTypeCode} | 
                                        Referenz: ${field.referenceName}
                                        ${alreadyExists ? ' | <span class="text-orange-600">⚠️ Existiert bereits in Zielgruppe</span>' : ''}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    private async createConfigField(): Promise<void> {
        if (!this.state.targetGroup) return;

        this.state.loading = true;
        this.render();

        try {
            // Note: We need to use the masterdata API to create custom group fields
            // This is a placeholder - the actual implementation depends on ChurchTools API
            alert('Hinweis: Das automatische Anlegen von Gruppenfeldern ist noch nicht implementiert.\n\nBitte legen Sie das Feld manuell an unter:\nStammdaten → Gruppen → Felder (Custom Group Fields)');
            
            this.state.loading = false;
            this.render();
        } catch (error) {
            this.state.error = `Fehler beim Anlegen des Feldes: ${error}`;
            this.state.loading = false;
            this.render();
        }
    }

    private attachEventListeners(): void {
        const targetGroupSelect =
            document.querySelector<HTMLSelectElement>('#target-group');
        if (targetGroupSelect) {
            targetGroupSelect.addEventListener('change', (e) => {
                const groupId = parseInt(
                    (e.target as HTMLSelectElement).value
                );
                if (groupId) {
                    this.onTargetGroupChange(groupId);
                }
            });
        }

        const searchInput = document.querySelector<HTMLInputElement>('#source-group-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = (e.target as HTMLInputElement).value;
                this.onSearchQueryChange(query);
            });
        }

        document.querySelectorAll('.source-group-option').forEach((option) => {
            option.addEventListener('click', () => {
                const groupId = parseInt((option as HTMLElement).dataset.groupId || '0');
                if (groupId) {
                    this.onSourceGroupChange(groupId);
                }
            });
        });

        const clearSourceButton = document.querySelector('#clear-source-group');
        if (clearSourceButton) {
            clearSourceButton.addEventListener('click', () => {
                this.state.sourceGroup = null;
                this.state.sourceFields = [];
                this.render();
            });
        }

        const createButton = document.querySelector('#create-config-field');
        if (createButton) {
            createButton.addEventListener('click', () => {
                this.createConfigField();
            });
        }

        const copyButton = document.querySelector('#copy-instruction');
        if (copyButton) {
            copyButton.addEventListener('click', () => {
                const instruction = `Konfigurationsfeld für Gruppenmitgliedsfelder-Picker:

Name: Feldübernahme-Konfiguration
Typ: Textarea
Referenzname: field_mapping_config
Ort: Stammdaten → Gruppen → Felder (Custom Group Fields)

Hinweis: Dies ist ein GRUPPENFELD (Custom Group Field), nicht ein Gruppenmitgliedsfeld!`;

                navigator.clipboard.writeText(instruction).then(() => {
                    alert('Anleitung in Zwischenablage kopiert!');
                });
            });
        }

        // Field mapping event listeners
        this.attachFieldMappingListeners();
    }

    private attachFieldMappingListeners(): void {
        // Field checkbox changes
        document.querySelectorAll<HTMLInputElement>('.field-checkbox').forEach((checkbox) => {
            checkbox.addEventListener('change', (e) => {
                const groupId = parseInt(checkbox.dataset.groupId || '0');
                const fieldId = parseInt(checkbox.dataset.fieldId || '0');
                const checked = (e.target as HTMLInputElement).checked;
                this.onFieldSelectionChange(groupId, fieldId, checked);
            });
        });

        // Create fields button
        const createButton = document.querySelector('#create-fields');
        if (createButton) {
            createButton.addEventListener('click', () => {
                this.onCreateFields();
            });
        }

        // Save selection button
        const saveButton = document.querySelector('#save-selection');
        if (saveButton) {
            saveButton.addEventListener('click', () => {
                this.onSaveSelection();
            });
        }
    }

    private onFieldSelectionChange(groupId: number, fieldId: number, selected: boolean): void {
        if (!this.state.configuration) return;

        const group = this.state.sourceGroups.find(g => g.id === groupId);
        const field = this.state.sourceFieldsByGroup.get(groupId)?.find(f => f.id === fieldId);

        if (!group || !field) return;

        if (selected) {
            // Add to selection
            const alreadySelected = this.state.configuration.selectedFields.some(
                sf => sf.sourceGroupId === groupId && sf.fieldId === fieldId
            );

            if (!alreadySelected) {
                this.state.configuration.selectedFields.push({
                    sourceGroupId: groupId,
                    sourceGroupName: group.name,
                    fieldId: field.id,
                    fieldName: field.name,
                    fieldType: field.fieldTypeCode,
                    selected: true,
                });
            }
        } else {
            // Remove from selection
            this.state.configuration.selectedFields = this.state.configuration.selectedFields.filter(
                sf => !(sf.sourceGroupId === groupId && sf.fieldId === fieldId)
            );
        }

        console.log('Updated selection:', this.state.configuration.selectedFields);
    }

    private async onCreateFields(): Promise<void> {
        if (!this.state.configuration || !this.state.targetGroup) return;

        const selectedCount = this.state.configuration.selectedFields.length;
        if (selectedCount === 0) {
            alert('Bitte wählen Sie mindestens ein Feld aus.');
            return;
        }

        const confirmed = confirm(
            `${selectedCount} Feld(er) werden in der Zielgruppe "${this.state.targetGroup.name}" angelegt.\n\n` +
            'Möchten Sie fortfahren?'
        );

        if (!confirmed) return;

        this.state.loading = true;
        this.render();

        const results: { success: string[]; failed: Array<{ field: string; error: string }> } = {
            success: [],
            failed: [],
        };

        try {
            // Create fields one by one
            for (const selectedField of this.state.configuration.selectedFields) {
                try {
                    // Get the full field definition from source group
                    const sourceField = this.state.sourceFields.find(f => f.id === selectedField.fieldId);

                    if (!sourceField) {
                        results.failed.push({
                            field: selectedField.fieldName || `Field ${selectedField.fieldId}`,
                            error: 'Quellfeldefinition nicht gefunden',
                        });
                        continue;
                    }

                    console.log('Creating field:', sourceField.name);

                    await createGroupMemberField(this.state.targetGroup.id, {
                        name: sourceField.name,
                        fieldTypeCode: sourceField.fieldTypeCode,
                        note: sourceField.note || '',
                        defaultValue: sourceField.defaultValue || '',
                        options: sourceField.options || [],
                        securityLevel: String(sourceField.securityLevel || 1),
                        useInRegistrationForm: sourceField.useInRegistrationForm ?? false,
                        requiredInRegistrationForm: sourceField.requiredInRegistrationForm ?? false,
                        sortKey: sourceField.sortKey || 1,
                    });

                    results.success.push(sourceField.name);
                    console.log('✓ Field created:', sourceField.name);
                } catch (error) {
                    console.error('Error creating field:', selectedField.fieldName, error);
                    results.failed.push({
                        field: selectedField.fieldName,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }

            // Show results
            let message = '';
            if (results.success.length > 0) {
                message += `✅ ${results.success.length} Feld(er) erfolgreich angelegt:\n`;
                message += results.success.map(f => `  - ${f}`).join('\n');
            }
            if (results.failed.length > 0) {
                message += `\n\n❌ ${results.failed.length} Feld(er) konnten nicht angelegt werden:\n`;
                message += results.failed.map(f => `  - ${f.field}: ${f.error}`).join('\n');
            }

            alert(message);

            // Reload target fields to show newly created fields
            if (results.success.length > 0) {
                this.state.targetFields = await getGroupSpecificMemberFields(this.state.targetGroup.id);
            }

            this.state.loading = false;
            this.render();
        } catch (error) {
            console.error('Error creating fields:', error);
            this.state.error = `Fehler beim Anlegen der Felder: ${error}`;
            this.state.loading = false;
            this.render();
        }
    }

    private async onSaveSelection(): Promise<void> {
        if (!this.state.configuration || !this.state.targetGroup) return;

        this.state.loading = true;
        this.render();

        try {
            // Update timestamp
            this.state.configuration.lastUpdated = new Date().toISOString();

            // Serialize and save
            const configJson = serializeConfiguration(this.state.configuration);
            
            await updateGroupCustomFields(this.state.targetGroup.id, {
                bwl_gmfp_config: configJson,
            });

            alert('✅ Auswahl erfolgreich gespeichert!');
            
            this.state.loading = false;
            this.render();
        } catch (error) {
            console.error('Error saving selection:', error);
            this.state.error = `Fehler beim Speichern: ${error}`;
            this.state.loading = false;
            this.render();
        }
    }
}
