<script setup lang="ts">
import { ref, computed } from 'vue';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Message from 'primevue/message';
import type { Group } from '../utils/ct-types';

const props = defineProps<{
    allGroups: Group[];
    targetGroup: Group;
    sourceGroup: Group | null;
}>();

const emit = defineEmits<{
    select: [group: Group];
    clear: [];
}>();

const searchQuery = ref('');

const filteredGroups = computed(() => {
    const query = searchQuery.value.toLowerCase().trim();
    return props.allGroups
        .filter(g => g.id !== props.targetGroup.id)
        .filter(g => !query || g.name.toLowerCase().includes(query))
        .slice(0, 10);
});

function selectGroup(group: Group) {
    searchQuery.value = '';
    emit('select', group);
}
</script>

<template>
    <div class="step">
        <h2>Schritt 2: Quellgruppe</h2>

        <template v-if="sourceGroup">
            <Message severity="success" :closable="false">
                Ausgewählt: <strong>{{ sourceGroup.name }}</strong>
                <Button link size="small" @click="emit('clear')">Ändern</Button>
            </Message>
        </template>

        <template v-else>
            <div class="search-field">
                <label for="source-search">Quellgruppe suchen</label>
                <InputText
                    id="source-search"
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
</style>
