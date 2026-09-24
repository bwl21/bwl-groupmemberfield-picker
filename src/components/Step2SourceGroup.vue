<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Message from 'primevue/message';
import type { SourceGroupFields } from '../utils/source-group-fields';
import type { Group } from '../utils/ct-types';

const props = defineProps<{
    allGroups: Group[];
    targetGroup: Group;
    sourceGroups: SourceGroupFields[];
}>();

const emit = defineEmits<{
    select: [group: Group];
    remove: [groupId: number];
}>();

const searchQuery = ref('');
const searchOpen = ref(false);
const searchPanel = ref<HTMLElement | null>(null);
const addButton = ref<HTMLButtonElement | null>(null);

const duplicateNames = computed(() => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const group of props.allGroups) {
        if (seen.has(group.name)) duplicates.add(group.name);
        seen.add(group.name);
    }
    return duplicates;
});

async function openSearch() {
    searchOpen.value = true;
    await nextTick();
    searchPanel.value?.querySelector('input')?.focus();
}

async function closeSearch() {
    searchOpen.value = false;
    searchQuery.value = '';
    await nextTick();
    addButton.value?.focus();
}

const filteredGroups = computed(() => {
    const query = searchQuery.value.toLowerCase().trim();
    return props.allGroups
        .filter(g => g.id !== props.targetGroup.id && !props.sourceGroups.some(source => source.id === g.id))
        .filter(g => !query || g.name.toLowerCase().includes(query))
        .slice(0, 10);
});

function selectGroup(group: Group) {
    void closeSearch();
    emit('select', group);
}
</script>

<template>
    <div class="step">
        <h2>Schritt 2: Quellgruppen</h2>

        <ul v-if="sourceGroups.length" class="selected-groups" aria-label="Ausgewählte Quellgruppen">
            <li v-for="group in sourceGroups" :key="group.id" class="group-chip">
                <span class="chip-name">
                    {{ group.name }}<span v-if="duplicateNames.has(group.name)" class="group-id"> (#{{ group.id }})</span>
                </span>
                <button type="button" class="chip-remove" :aria-label="`${group.name} entfernen`"
                    @click="emit('remove', group.id)">
                    <i class="pi pi-times" aria-hidden="true"></i>
                </button>
            </li>
        </ul>
        <p v-if="sourceGroups.length" class="selection-hint">
            Beim Entfernen einer Quellgruppe werden auch deren Felder abgewählt.
        </p>

        <button ref="addButton" type="button" class="add-group" :aria-expanded="searchOpen"
            aria-controls="source-group-search" @click="searchOpen ? closeSearch() : openSearch()">
            <i class="pi pi-plus" aria-hidden="true"></i>
            Quellgruppe hinzufügen
        </button>

        <div v-if="searchOpen" id="source-group-search" ref="searchPanel" class="search-panel"
            @keydown.esc.stop.prevent="closeSearch">
            <div class="search-field">
                <label for="source-search">Quellgruppe suchen</label>
                <div class="search-controls">
                    <InputText id="source-search" v-model="searchQuery" placeholder="Gruppenname eingeben..." class="search-input" />
                    <Button severity="secondary" text aria-label="Suche schließen" @click="closeSearch">
                        <i class="pi pi-times" aria-hidden="true"></i>
                    </Button>
                </div>
            </div>

            <div v-if="filteredGroups.length > 0" class="group-list">
                <button v-for="group in filteredGroups" :key="group.id" type="button" class="group-item"
                    @click="selectGroup(group)">
                    <span class="group-name">{{ group.name }}</span>
                    <span v-if="duplicateNames.has(group.name)" class="group-id">ID: {{ group.id }}</span>
                </button>
            </div>
            <Message v-else severity="info" :closable="false">
                Keine weiteren passenden Gruppen gefunden
            </Message>
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

.selected-groups {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
}

.group-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    max-width: 100%;
    padding: 0.25rem 0.375rem 0.25rem 0.75rem;
    border: 1px solid #cbd5e1;
    border-radius: 1rem;
    background: #f1f5f9;
    color: #334155;
    font-size: 0.875rem;
}

.chip-name {
    min-width: 0;
    overflow-wrap: anywhere;
}

.chip-remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 2rem;
    height: 2rem;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: inherit;
    cursor: pointer;
}

.chip-remove:hover {
    background: #e2e8f0;
}

.selection-hint {
    margin: 0.625rem 0 0.875rem;
    font-size: 0.8125rem;
    color: #64748b;
    line-height: 1.5;
}

.add-group {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border: 1px dashed #94a3b8;
    border-radius: 6px;
    background: transparent;
    color: #334155;
    font: inherit;
    font-size: 0.875rem;
    cursor: pointer;
}

.add-group:hover {
    background: #f1f5f9;
}

button:focus-visible {
    outline: 2px solid #475569;
    outline-offset: 2px;
}

.search-panel {
    margin-top: 0.75rem;
    padding: 1rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #f8fafc;
}

.search-controls {
    display: flex;
    gap: 0.5rem;
}

.search-input {
    flex: 1;
    min-width: 0;
}

.search-field {
    margin-bottom: 0.75rem;
}

.search-field label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
}

.group-list {
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    max-height: 12rem;
    overflow-y: auto;
    background: #fff;
}

.group-item {
    display: block;
    width: 100%;
    text-align: left;
    font: inherit;
    color: inherit;
    background: transparent;
    border: 0;
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
    display: block;
    overflow-wrap: anywhere;
    font-weight: 500;
}

.group-id {
    font-size: 0.875rem;
    color: #6b7280;
}
</style>
