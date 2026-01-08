<script setup lang="ts">
import { computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import Message from 'primevue/message';
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
    sourceGroup: Group;
    sourceFields: GroupMemberFieldGroup[];
    targetFields: GroupMemberFieldGroup[];
    configuration: FieldSelectionConfiguration | null;
}>();

const emit = defineEmits<{
    'update:configuration': [config: FieldSelectionConfiguration];
    'update:targetFields': [fields: GroupMemberFieldGroup[]];
}>();

const existingReferenceNames = computed(() => 
    new Set(props.targetFields.map(f => f.referenceName))
);

function isFieldSelected(fieldId: number): boolean {
    if (!props.configuration) return false;
    return props.configuration.selectedFields.some(
        sf => sf.sourceGroupId === props.sourceGroup.id && sf.fieldId === fieldId
    );
}

function toggleField(field: GroupMemberFieldGroup, selected: boolean) {
    if (!props.configuration) return;

    const newConfig = { ...props.configuration };

    if (selected) {
        const alreadySelected = newConfig.selectedFields.some(
            sf => sf.sourceGroupId === props.sourceGroup.id && sf.fieldId === field.id
        );
        if (!alreadySelected) {
            newConfig.selectedFields = [
                ...newConfig.selectedFields,
                {
                    sourceGroupId: props.sourceGroup.id,
                    sourceGroupName: props.sourceGroup.name,
                    fieldId: field.id,
                    fieldName: field.name,
                    fieldType: field.fieldTypeCode,
                    selected: true,
                }
            ];
        }
    } else {
        newConfig.selectedFields = newConfig.selectedFields.filter(
            sf => !(sf.sourceGroupId === props.sourceGroup.id && sf.fieldId === field.id)
        );
    }

    emit('update:configuration', newConfig);
}

async function createFields() {
    if (!props.configuration) return;

    const selectedCount = props.configuration.selectedFields.length;
    if (selectedCount === 0) {
        toast.add({ severity: 'warn', summary: 'Hinweis', detail: 'Bitte wählen Sie mindestens ein Feld aus.', life: 3000 });
        return;
    }

    const confirmed = confirm(
        `${selectedCount} Feld(er) werden in der Zielgruppe "${props.targetGroup.name}" angelegt.\n\nMöchten Sie fortfahren?`
    );
    if (!confirmed) return;

    const results: { success: string[]; failed: Array<{ field: string; error: string }> } = {
        success: [],
        failed: [],
    };

    for (const selectedField of props.configuration.selectedFields) {
        try {
            const sourceField = props.sourceFields.find(f => f.id === selectedField.fieldId);
            if (!sourceField) {
                results.failed.push({
                    field: selectedField.fieldName || `Field ${selectedField.fieldId}`,
                    error: 'Quellfeldefinition nicht gefunden',
                });
                continue;
            }

            if (existingReferenceNames.value.has(sourceField.referenceName)) {
                results.failed.push({
                    field: sourceField.name,
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

            results.success.push(sourceField.name);
        } catch (error) {
            results.failed.push({
                field: selectedField.fieldName,
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
            console.error('Error saving configuration:', err);
        }
    }
}

async function saveSelection() {
    if (!props.configuration) return;

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
    }
}
</script>

<template>
    <div class="step">
        <h2>Schritt 3: Felder auswählen</h2>

        <Message v-if="sourceFields.length === 0" severity="info" :closable="false">
            Die Quellgruppe "{{ sourceGroup.name }}" hat keine Gruppenmitgliedsfelder.
        </Message>

        <template v-else>
            <p class="description">
                Wählen Sie aus, welche Felder aus der Quellgruppe "{{ sourceGroup.name }}" 
                in die Zielgruppe übernommen werden sollen.
            </p>

            <div class="field-list">
                <div
                    v-for="field in sourceFields"
                    :key="field.id"
                    class="field-item"
                    :class="{ 'field-exists': existingReferenceNames.has(field.referenceName) }"
                >
                    <Checkbox
                        :modelValue="isFieldSelected(field.id)"
                        :disabled="existingReferenceNames.has(field.referenceName)"
                        binary
                        @update:modelValue="(val: boolean) => toggleField(field, val)"
                    />
                    <div class="field-info">
                        <div class="field-name">{{ field.name }}</div>
                        <div class="field-meta">
                            Typ: {{ field.fieldTypeCode }} | Referenz: {{ field.referenceName }}
                            <span v-if="existingReferenceNames.has(field.referenceName)" class="exists-warning">
                                ⚠️ Existiert bereits
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="button-group">
                <Button @click="createFields">
                    <i class="pi pi-plus"></i>
                    Ausgewählte Felder anlegen
                </Button>
                <Button severity="secondary" @click="saveSelection">
                    <i class="pi pi-save"></i>
                    Auswahl speichern
                </Button>
            </div>
        </template>
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
    opacity: 0.7;
}

.field-info {
    flex: 1;
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
    gap: 0.5rem;
}
</style>
