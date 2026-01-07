import { churchtoolsClient } from '@churchtools/churchtools-client';
import type { Group } from './utils/ct-types';
import { findConfigurationField } from './utils/group-member-fields';

interface AppState {
    targetGroup: Group | null;
    sourceGroups: Group[];
    allGroups: Group[];
    configField: { fieldName: string; value: string | undefined } | null;
    loading: boolean;
    error: string | null;
}

export class GroupMemberFieldPickerApp {
    private state: AppState = {
        targetGroup: null,
        sourceGroups: [],
        allGroups: [],
        configField: null,
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
        this.state.error = null;
        this.state.loading = true;
        this.render();

        try {
            this.state.configField = await findConfigurationField(groupId);
            this.state.loading = false;
            this.render();
        } catch (error) {
            console.error('Error checking config field:', error);
            // Don't show error - just treat as "no config field found"
            this.state.configField = null;
            this.state.loading = false;
            this.render();
        }
    }

    private onSourceGroupsChange(groupIds: number[]): void {
        this.state.sourceGroups = this.state.allGroups.filter((g) =>
            groupIds.includes(g.id)
        );
        this.render();
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
                <h2 class="text-xl font-semibold mb-3">Schritt 2: Quellgruppen</h2>
                <div class="mb-3">
                    <label for="source-groups" class="block mb-2">Quellgruppen auswählen (mehrfach)</label>
                    <select 
                        id="source-groups" 
                        class="p-multiselect w-full p-2 border rounded"
                        multiple
                        size="8"
                    >
                        ${this.state.allGroups
                            .filter((g) => g.id !== this.state.targetGroup?.id)
                            .map(
                                (g) =>
                                    `<option value="${g.id}" ${
                                        this.state.sourceGroups.some(
                                            (sg) => sg.id === g.id
                                        )
                                            ? 'selected'
                                            : ''
                                    }>${g.name}</option>`
                            )
                            .join('')}
                    </select>
                </div>
                
                ${
                    this.state.sourceGroups.length > 0
                        ? `
                    <div class="p-message p-message-info">
                        <i class="pi pi-info-circle"></i>
                        <span>Ausgewählt: ${this.state.sourceGroups
                            .map((g) => g.name)
                            .join(', ')}</span>
                    </div>
                `
                        : ''
                }
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

        const sourceGroupsSelect =
            document.querySelector<HTMLSelectElement>('#source-groups');
        if (sourceGroupsSelect) {
            sourceGroupsSelect.addEventListener('change', (e) => {
                const select = e.target as HTMLSelectElement;
                const selectedIds = Array.from(select.selectedOptions).map(
                    (opt) => parseInt(opt.value)
                );
                this.onSourceGroupsChange(selectedIds);
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
    }
}
