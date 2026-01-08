<script setup lang="ts">
import { ref, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Message from 'primevue/message';
import type { Group } from '../utils/ct-types';

const toast = useToast();

const props = defineProps<{
    allGroups: Group[];
    targetGroup: Group | null;
    configField: { fieldName: string; value: string | undefined } | null;
}>();

const emit = defineEmits<{
    select: [group: Group];
    clear: [];
}>();

const searchQuery = ref('');

const filteredGroups = computed(() => {
    if (!searchQuery.value.trim()) {
        return props.allGroups.slice(0, 10);
    }
    const query = searchQuery.value.toLowerCase();
    return props.allGroups
        .filter(g => g.name.toLowerCase().includes(query))
        .slice(0, 10);
});

function selectGroup(group: Group) {
    searchQuery.value = '';
    emit('select', group);
}

function copyInstruction() {
    const instruction = `Konfigurationsfeld für Gruppenmitgliedsfelder-Picker:

Name: Feldübernahme-Konfiguration
Typ: Textarea
Referenzname: field_mapping_config
Ort: Stammdaten → Gruppen → Felder (Custom Group Fields)

Hinweis: Dies ist ein GRUPPENFELD (Custom Group Field), nicht ein Gruppenmitgliedsfeld!`;

    navigator.clipboard.writeText(instruction).then(() => {
        toast.add({ severity: 'success', summary: 'Kopiert', detail: 'Anleitung in Zwischenablage kopiert!', life: 3000 });
    });
}
</script>

<template>
    <div class="step">
        <h2>Schritt 1: Zielgruppe</h2>

        <template v-if="targetGroup">
            <Message severity="success" :closable="false">
                Ausgewählt: <strong>{{ targetGroup.name }}</strong>
                <Button link size="small" @click="emit('clear')">Ändern</Button>
            </Message>
        </template>

        <template v-else>
            <div class="search-field">
                <label for="target-search">Zielgruppe suchen</label>
                <InputText
                    id="target-search"
                    v-model="searchQuery"
                    placeholder="Gruppenname eingeben..."
                    class="w-full"
                />
            </div>

            <div v-if="filteredGroups.length > 0" class="group-list">
                <div
                    v-for="group in filteredGroups"
                    :key="group.id"
                    class="group-item"
                    @click="selectGroup(group)"
                >
                    <div class="group-name">{{ group.name }}</div>
                    <div class="group-id">ID: {{ group.id }}</div>
                </div>
            </div>

            <Message v-else-if="searchQuery" severity="info" :closable="false">
                Keine Gruppen gefunden
            </Message>
        </template>

        <!-- Config field status -->
        <template v-if="targetGroup">
            <Message v-if="configField" severity="success" :closable="false">
                Konfigurationsfeld gefunden: <strong>{{ configField.fieldName }}</strong>
            </Message>

            <Message v-else severity="warn" :closable="false">
                <div class="config-warning">
                    <p><strong>⚠️ Konfigurationsfeld fehlt</strong></p>
                    <p>Das benötigte <strong>GRUPPENFELD</strong> (nicht Gruppenmitgliedsfeld!) wurde nicht gefunden.</p>
                    <p>Erforderliche Eigenschaften:</p>
                    <ul>
                        <li><strong>Feldname:</strong> <code>bwl_gmfp_config</code></li>
                        <li><strong>Typ:</strong> Textarea</li>
                        <li><strong>Ort:</strong> Stammdaten → Gruppen → Felder (Custom Group Fields)</li>
                    </ul>
                    <div class="button-group">
                        <Button size="small" @click="copyInstruction">
                            <i class="pi pi-copy"></i>
                            Anleitung kopieren
                        </Button>
                    </div>
                </div>
            </Message>
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

.search-field {
    margin-bottom: 0.75rem;
}

.search-field label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
}

.w-full {
    width: 100%;
}

.group-list {
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    max-height: 16rem;
    overflow-y: auto;
    margin-bottom: 0.75rem;
}

.group-item {
    padding: 0.75rem;
    border-bottom: 1px solid #e5e7eb;
    cursor: pointer;
}

.group-item:last-child {
    border-bottom: none;
}

.group-item:hover {
    background-color: #f3f4f6;
}

.group-name {
    font-weight: 500;
}

.group-id {
    font-size: 0.875rem;
    color: #6b7280;
}

.config-warning ul {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
}

.config-warning li {
    margin-bottom: 0.25rem;
}

.button-group {
    margin-top: 0.75rem;
    display: flex;
    gap: 0.5rem;
}
</style>
