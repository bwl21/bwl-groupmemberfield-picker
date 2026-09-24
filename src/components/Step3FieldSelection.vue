<script setup lang="ts">
import { computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import Message from 'primevue/message';
import type { SourceGroupFields } from '../utils/source-group-fields';
import type { Group, GroupMemberFieldGroup } from '../utils/ct-types';
import type { FieldSelectionConfiguration } from '../utils/field-mapping-types';
import { serializeConfiguration } from '../utils/field-mapping-types';
import {
    updateGroupCustomFields,
    createGroupMemberField,
    getGroupSpecificMemberFields
} from '../utils/group-member-fields';

const toast = useToast();

const props = defineProps<{
    targetGroup: Group;
    sourceGroups: SourceGroupFields[];
    busy: boolean;
    targetFields: GroupMemberFieldGroup[];
    configuration: FieldSelectionConfiguration | null;
}>();

const emit = defineEmits<{
    'update:busy': [busy: boolean];
    retry: [groupId: number];
    'update:configuration': [config: FieldSelectionConfiguration];
    'update:targetFields': [fields: GroupMemberFieldGroup[]];
}>();

const existingReferenceNames = computed(() =>
    new Set(props.targetFields.map(f => f.referenceName))
);

function isFieldSelected(groupId: number, fieldId: number): boolean {
    if (!props.configuration) return false;
    return props.configuration.selectedFields.some(
        sf => sf.sourceGroupId === groupId && sf.fieldId === fieldId
    );
}

const fieldsToCreate = computed(() => props.sourceGroups.flatMap(group =>
    group.error ? [] : group.fields
        .filter(field => isFieldSelected(group.id, field.id) && !existingReferenceNames.value.has(field.referenceName))
        .map(field => ({ group, field }))
));

const sourceCount = computed(() => new Set(fieldsToCreate.value.map(item => item.group.id)).size);
const duplicateReferences = computed(() => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const { field } of fieldsToCreate.value) {
        if (seen.has(field.referenceName)) duplicates.add(field.referenceName);
        seen.add(field.referenceName);
    }
    return [...duplicates];
});

function missingFields(group: SourceGroupFields) {
    return props.configuration?.selectedFields.filter(selected =>
        selected.sourceGroupId === group.id && !group.fields.some(field => field.id === selected.fieldId)
    ) ?? [];
}

function removeField(groupId: number, fieldId: number) {
    if (!props.configuration || props.busy) return;
    emit('update:configuration', {
        ...props.configuration,
        selectedFields: props.configuration.selectedFields.filter(field =>
            !(field.sourceGroupId === groupId && field.fieldId === fieldId)
        ),
    });
}

function toggleField(group: SourceGroupFields, field: GroupMemberFieldGroup, selected: boolean) {
    if (!props.configuration || props.busy) return;
    if (!selected) {
        removeField(group.id, field.id);
    } else if (!isFieldSelected(group.id, field.id)) {
        emit('update:configuration', {
            ...props.configuration,
            selectedFields: [...props.configuration.selectedFields, {
                sourceGroupId: group.id,
                sourceGroupName: group.name,
                fieldId: field.id,
                fieldName: field.name,
                fieldType: field.fieldTypeCode,
                selected: true,
            }],
        });
    }
}

async function createFields() {
    if (!props.configuration || props.busy) return;

    if (duplicateReferences.value.length > 0) return;
    const selectedFields = [...fieldsToCreate.value];
    const selectedCount = selectedFields.length;
    if (selectedCount === 0) {
        toast.add({ severity: 'warn', summary: 'Hinweis', detail: 'Bitte wählen Sie mindestens ein Feld aus.', life: 3000 });
        return;
    }

    const confirmed = confirm(
        `${selectedCount} Feld(er) aus ${sourceCount.value} Quellgruppe(n) werden in der Zielgruppe "${props.targetGroup.name}" angelegt.\n\n${selectedFields.map(({ group, field }) => `${group.name}: ${field.name}`).join("\n")}\n\nMöchten Sie fortfahren?`
    );
    if (!confirmed) return;

    emit('update:busy', true);
    try {
        const results: { success: string[]; failed: Array<{ field: string; error: string }> } = {
            success: [],
            failed: [],
        };

        for (const { group, field: sourceField } of selectedFields) {
            try {
                if (existingReferenceNames.value.has(sourceField.referenceName)) {
                    results.failed.push({
                        field: `${group.name}: ${sourceField.name}`,
                        error: 'Feld existiert bereits in der Zielgruppe',
                    });
                    continue;
                }

                await createGroupMemberField(props.targetGroup.id, {
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

                results.success.push(`${group.name}: ${sourceField.name}`);
            } catch (error) {
                results.failed.push({
                    field: `${group.name}: ${sourceField.name}`,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        if (results.success.length > 0) {
            toast.add({
                severity: 'success',
                summary: 'Felder angelegt',
                detail: `${results.success.length} Feld(er) erfolgreich angelegt: ${results.success.join(', ')}`,
                life: 5000
            });
        }
        if (results.failed.length > 0) {
            toast.add({
                severity: 'error',
                summary: 'Fehler',
                detail: `${results.failed.length} Feld(er) konnten nicht angelegt werden`,
                life: 5000
            });
        }

        if (results.success.length > 0) {
            const updatedFields = await getGroupSpecificMemberFields(props.targetGroup.id);
            emit('update:targetFields', updatedFields);

            try {
                const newConfig = {
                    ...props.configuration,
                    lastUpdated: new Date().toISOString(),
                };
                const configJson = serializeConfiguration(newConfig);
                await updateGroupCustomFields(props.targetGroup.id, {
                    bwl_gmfp_config: configJson,
                });
                emit('update:configuration', newConfig);
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Speichern fehlgeschlagen', detail: String(err), life: 5000 });
            }
        }
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Aktualisieren fehlgeschlagen', detail: `Felder wurden möglicherweise angelegt, aber die Ansicht konnte nicht aktualisiert werden. Bitte vor weiteren Versuchen neu laden. ${error}`, life: 8000 });
    } finally {
        emit('update:busy', false);
    }
}

async function saveSelection() {
    if (!props.configuration || props.busy) return;

    emit('update:busy', true);
    try {
        const newConfig = {
            ...props.configuration,
            lastUpdated: new Date().toISOString(),
        };
        const configJson = serializeConfiguration(newConfig);
        await updateGroupCustomFields(props.targetGroup.id, {
            bwl_gmfp_config: configJson,
        });
        emit('update:configuration', newConfig);
        toast.add({ severity: 'success', summary: 'Gespeichert', detail: 'Auswahl erfolgreich gespeichert!', life: 3000 });
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Fehler', detail: `Fehler beim Speichern: ${error}`, life: 5000 });
    } finally {
        emit('update:busy', false);
    }
}
</script>

<template>
    <div class="step">
        <h2>Schritt 3: Felder auswählen</h2>
        <p class="description">Wählen Sie die Felder aus allen Quellgruppen aus, die in die Zielgruppe übernommen werden sollen.</p>
        <Message v-if="sourceGroups.length === 0" severity="info" :closable="false">
            Fügen Sie oben eine oder mehrere Quellgruppen hinzu.
        </Message>

        <section v-for="group in sourceGroups" :key="group.id" class="field-list">
            <h3>{{ group.name }} <small>(#{{ group.id }})</small></h3>
            <Message v-if="group.error" severity="warn" :closable="false">
                {{ group.error }}
                <Button link :disabled="busy" @click="emit('retry', group.id)">Erneut laden</Button>
            </Message>
            <Message v-else-if="group.fields.length === 0" severity="info" :closable="false">
                Diese Quellgruppe hat keine Gruppenmitgliedsfelder.
            </Message>
            <div v-for="field in group.fields" :key="field.id" class="field-item"
                :class="{ 'field-exists': existingReferenceNames.has(field.referenceName) }">
                <Checkbox
                    :inputId="`field-${group.id}-${field.id}`"
                    :modelValue="isFieldSelected(group.id, field.id)"
                    :disabled="busy || (existingReferenceNames.has(field.referenceName) && !isFieldSelected(group.id, field.id))"
                    binary
                    @update:modelValue="(val: boolean) => toggleField(group, field, val)"
                />
                <div class="field-info">
                    <label :for="`field-${group.id}-${field.id}`" class="field-name">{{ field.name }}</label>
                    <div class="field-meta">
                        Typ: {{ field.fieldTypeCode }} | Referenz: {{ field.referenceName }}
                        <span v-if="existingReferenceNames.has(field.referenceName)" class="exists-warning">Existiert bereits – wird nicht angelegt</span>
                    </div>
                    <details class="field-details">
                        <summary :aria-label="`Details zu ${field.name} aus ${group.name}`">
                            <i class="pi pi-info-circle" aria-hidden="true"></i>
                            Felddetails
                        </summary>
                        <div class="details-panel">
                            <dl>
                                <dt>Quellgruppe</dt><dd>{{ group.name }}</dd>
                                <dt>Feld-ID</dt><dd>{{ field.id }}</dd>
                                <dt>Referenzname</dt><dd>{{ field.referenceName }}</dd>
                                <dt>Feldtyp</dt><dd>{{ field.fieldTypeCode }}</dd>
                                <dt>Beschreibung</dt><dd>{{ field.note || 'Keine Angabe' }}</dd>
                                <dt>Standardwert</dt><dd>{{ field.defaultValue === '' || field.defaultValue == null ? 'Kein Standardwert' : field.defaultValue }}</dd>
                                <dt>Auswahloptionen</dt>
                                <dd>
                                    <ul v-if="field.options?.length" class="field-options">
                                        <li v-for="(option, index) in field.options" :key="index">{{ option.name }} <span class="option-id">(ID: {{ option.id }})</span></li>
                                    </ul>
                                    <template v-else>Keine Optionen</template>
                                </dd>
                                <dt>Maximale Länge</dt><dd>{{ field.maxLength ?? 'Keine Angabe' }}</dd>
                                <dt>Sicherheitslevel</dt><dd>{{ field.securityLevel ?? 'Keine Angabe' }}</dd>
                                <dt>Sortierung</dt><dd>{{ field.sortKey ?? 'Keine Angabe' }}</dd>
                                <dt>Im Anmeldeformular</dt><dd>{{ field.useInRegistrationForm == null ? 'Keine Angabe' : field.useInRegistrationForm ? 'Ja' : 'Nein' }}</dd>
                                <dt>Pflichtfeld bei Anmeldung</dt><dd>{{ field.requiredInRegistrationForm == null ? 'Keine Angabe' : field.requiredInRegistrationForm ? 'Ja' : 'Nein' }}</dd>
                                <dt>Name im Anmeldeformular</dt><dd>{{ field.nameInSignupForm || 'Keine Angabe' }}</dd>
                                <dt>Hinweis im Anmeldeformular</dt><dd>{{ field.noteInSignupForm || 'Keine Angabe' }}</dd>
                            </dl>
                        </div>
                    </details>
                </div>
            </div>
            <div v-for="field in missingFields(group)" :key="`missing-${field.fieldId}`" class="field-item">
                <span>{{ field.fieldName || `Feld #${field.fieldId}` }} – gespeichert, aber nicht verfügbar; wird nicht angelegt.</span>
                <Button link :disabled="busy" @click="removeField(group.id, field.fieldId)">Aus Auswahl entfernen</Button>
            </div>
        </section>

        <Message v-if="duplicateReferences.length" severity="warn" :closable="false">
            Mehrere ausgewählte Felder haben dieselbe Referenz: {{ duplicateReferences.join(', ') }}.
            Bitte wählen Sie je Referenz nur ein Feld aus.
        </Message>
        <div class="button-group">
            <Button :disabled="busy || fieldsToCreate.length === 0 || duplicateReferences.length > 0" @click="createFields">
                <i class="pi pi-plus"></i>
                {{ fieldsToCreate.length }} Felder aus {{ sourceCount }} Quellgruppen anlegen
            </Button>
            <Button severity="secondary" :disabled="busy" @click="saveSelection">
                <i class="pi pi-save"></i>
                Auswahl speichern
            </Button>
        </div>
    </div>
</template>

<style scoped>
.step {
    margin-bottom: 1.5rem;
}

.step h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
}

.description {
    font-size: 0.875rem;
    color: #6b7280;
    margin-bottom: 1rem;
}

.field-list {
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 1rem;
    margin-bottom: 1rem;
}

.field-list h3 {
    margin: 0 0 0.75rem;
}

.field-list small {
    font-weight: normal;
    color: #6b7280;
}

.field-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem;
    border-radius: 4px;
}

.field-item:hover {
    background-color: #f9fafb;
}

.field-exists {
    background-color: #f3f4f6;
}

.field-info {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
}

.field-details {
    margin-top: 0.375rem;
    font-size: 0.875rem;
}

.field-details summary {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0;
    color: #475569;
    cursor: pointer;
    list-style: none;
}

.field-details summary::-webkit-details-marker {
    display: none;
}

.field-details summary:hover {
    text-decoration: underline;
}

.field-details summary:focus-visible {
    outline: 2px solid #475569;
    outline-offset: 3px;
    border-radius: 3px;
}

.details-panel {
    margin-top: 0.375rem;
    padding: 0.875rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: #f8fafc;
    color: #334155;
}

.details-panel dl {
    display: grid;
    grid-template-columns: minmax(0, 11rem) minmax(0, 1fr);
    gap: 0.5rem 1rem;
    margin: 0;
}

.details-panel dt {
    font-weight: 500;
}

.details-panel dd {
    margin: 0;
    white-space: pre-wrap;
}

.field-options {
    margin: 0;
    padding-left: 1.125rem;
}

.option-id {
    color: #64748b;
}

@media (max-width: 600px) {
    .details-panel dl {
        grid-template-columns: minmax(0, 1fr);
        gap: 0.25rem;
    }

    .details-panel dd:not(:last-child) {
        margin-bottom: 0.625rem;
    }
}

.field-name {
    font-weight: 500;
}

.field-meta {
    font-size: 0.875rem;
    color: #6b7280;
}

.exists-warning {
    color: #d97706;
    margin-left: 0.5rem;
}

.button-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}
</style>
