<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { churchtoolsClient } from '@churchtools/churchtools-client';
import Card from 'primevue/card';
import ProgressSpinner from 'primevue/progressspinner';
import Message from 'primevue/message';
import Toast from 'primevue/toast';

import Step1TargetGroup from './components/Step1TargetGroup.vue';
import Step2SourceGroup from './components/Step2SourceGroup.vue';
import Step3FieldSelection from './components/Step3FieldSelection.vue';
import type { Group, GroupMemberFieldGroup } from './utils/ct-types';
import type { SourceGroupFields } from './utils/source-group-fields';
import type { FieldSelectionConfiguration } from './utils/field-mapping-types';
import { 
    findConfigurationField, 
    getGroupSpecificMemberFields 
} from './utils/group-member-fields';
import { 
    getSourceGroupIds,
    parseConfiguration, 
    createEmptyConfiguration 
} from './utils/field-mapping-types';

declare const __APP_VERSION__: string;

const toast = useToast();
const appVersion = __APP_VERSION__;
const loading = ref(true);
const error = ref<string | null>(null);
const allGroups = ref<Group[]>([]);
const targetGroup = ref<Group | null>(null);
const sourceGroups = ref<SourceGroupFields[]>([]);
const busy = ref(false);
const configField = ref<{ fieldName: string; value: string | undefined } | null>(null);
const targetFields = ref<GroupMemberFieldGroup[]>([]);
const configuration = ref<FieldSelectionConfiguration | null>(null);

onMounted(async () => {
    await loadGroups();
    await checkUrlForGroupId();
});

async function checkUrlForGroupId() {
    let groupId: number | null = null;
    let source = '';

    // 1. Check URL parameters first (highest priority)
    const urlParams = new URLSearchParams(window.location.search);
    const groupIdParam = urlParams.get('groupId') || urlParams.get('group');
    
    if (groupIdParam) {
        const parsed = parseInt(groupIdParam, 10);
        if (!isNaN(parsed)) {
            groupId = parsed;
            source = 'URL-Parameter';
        }
    }

    // 2. Check referrer - if coming from a ChurchTools group page
    if (!groupId && document.referrer) {
        const referrerMatch = document.referrer.match(/\/groups\/(\d+)/);
        if (referrerMatch) {
            groupId = parseInt(referrerMatch[1], 10);
            source = 'Gruppenseite';
        }
    }

    // 3. Check parent window location (for iframe embedding)
    if (!groupId) {
        try {
            const parentUrl = window.parent?.location?.href;
            if (parentUrl && parentUrl !== window.location.href) {
                const parentMatch = parentUrl.match(/\/groups\/(\d+)/);
                if (parentMatch) {
                    groupId = parseInt(parentMatch[1], 10);
                    source = 'Eltern-Fenster';
                }
            }
        } catch {
            // Cross-origin access blocked - ignore
        }
    }

    if (groupId) {
        const group = allGroups.value.find(g => g.id === groupId);
        if (group) {
            toast.add({ 
                severity: 'info', 
                summary: 'Gruppe erkannt', 
                detail: `Zielgruppe "${group.name}" wurde aus ${source} geladen`, 
                life: 4000 
            });
            await onTargetGroupSelected(group);
        }
    }
}

async function loadGroups() {
    try {
        loading.value = true;
        const groups = await churchtoolsClient.getAllPages<Group>('/groups', {}, 100);
        allGroups.value = groups;
        loading.value = false;
    } catch (err) {
        error.value = `Fehler beim Laden der Gruppen: ${err instanceof Error ? err.message : String(err)}`;
        loading.value = false;
    }
}

async function onTargetGroupSelected(group: Group) {
    targetGroup.value = group;
    configField.value = null;
    targetFields.value = [];
    configuration.value = null;
    sourceGroups.value = [];
    loading.value = true;

    try {
        const [config, fields] = await Promise.all([
            findConfigurationField(group.id),
            getGroupSpecificMemberFields(group.id)
        ]);

        configField.value = config || null;
        targetFields.value = fields;

        if (config) {
            toast.add({ severity: 'success', summary: 'Gefunden', detail: `Konfigurationsfeld: ${config.fieldName}`, life: 3000 });
            if (config.value) {
                const parsed = parseConfiguration(config.value);
                if (parsed) {
                    configuration.value = parsed;
                    sourceGroups.value = await Promise.all(getSourceGroupIds(parsed).map(loadSourceGroup));
                } else {
                    configuration.value = createEmptyConfiguration(group.id);
                }
            } else {
                configuration.value = createEmptyConfiguration(group.id);
            }
        }

        loading.value = false;
    } catch (err) {
        error.value = `Fehler beim Laden der Gruppendetails: ${err instanceof Error ? err.message : String(err)}`;
        loading.value = false;
    }
}

function clearTargetGroup() {
    targetGroup.value = null;
    configField.value = null;
    targetFields.value = [];
    configuration.value = null;
    sourceGroups.value = [];
}

async function loadSourceGroup(id: number): Promise<SourceGroupFields> {
    const group = allGroups.value.find(group => group.id === id);
    if (!group || id === targetGroup.value?.id) {
        return { id, name: group?.name ?? `Quellgruppe #${id}`, fields: [], error: 'Diese Gruppe ist nicht als Quellgruppe verfügbar.' };
    }
    try {
        return { id, name: group.name, fields: await getGroupSpecificMemberFields(id) };
    } catch {
        return { id, name: group.name, fields: [], error: 'Die Felder dieser Quellgruppe konnten nicht geladen werden. Bitte erneut laden.' };
    }
}

async function onSourceGroupSelected(group: Group) {
    if (busy.value || !configuration.value || sourceGroups.value.some(source => source.id === group.id)) return;
    busy.value = true;
    try {
        sourceGroups.value.push(await loadSourceGroup(group.id));
        configuration.value = {
            ...configuration.value,
            sourceGroupIds: sourceGroups.value.map(source => source.id),
        };
    } finally {
        busy.value = false;
    }
}

function removeSourceGroup(groupId: number) {
    if (busy.value || !configuration.value) return;
    sourceGroups.value = sourceGroups.value.filter(group => group.id !== groupId);
    configuration.value = {
        ...configuration.value,
        sourceGroupIds: sourceGroups.value.map(group => group.id),
        selectedFields: configuration.value.selectedFields.filter(field => field.sourceGroupId !== groupId),
    };
}

async function retrySourceGroup(groupId: number) {
    if (busy.value) return;
    busy.value = true;
    try {
        const source = await loadSourceGroup(groupId);
        sourceGroups.value = sourceGroups.value.map(group => group.id === groupId ? source : group);
    } finally {
        busy.value = false;
    }
}

function onConfigurationUpdated(config: FieldSelectionConfiguration) {
    configuration.value = config;
}

function onTargetFieldsUpdated(fields: GroupMemberFieldGroup[]) {
    targetFields.value = fields;
}
</script>

<template>
    <Toast />
    <Card class="main-card">
        <template #content>
            <div class="header">
                <h1>Gruppenmitgliedsfelder zusammensammeln</h1>
                <span class="version">v{{ appVersion }}</span>
            </div>

            <ProgressSpinner v-if="loading" />

            <Message v-else-if="error" severity="error" :closable="false">
                {{ error }}
            </Message>

            <template v-else>
                <div :inert="busy">
                    <Step1TargetGroup
                        :allGroups="allGroups"
                        :targetGroup="targetGroup"
                        :configField="configField"
                        @select="onTargetGroupSelected"
                        @clear="clearTargetGroup"
                    />

                    <Step2SourceGroup
                        v-if="targetGroup && configField"
                        :allGroups="allGroups"
                        :targetGroup="targetGroup"
                        :sourceGroups="sourceGroups"
                        @select="onSourceGroupSelected"
                        @remove="removeSourceGroup"
                    />

                </div>

                <Step3FieldSelection
                    v-if="targetGroup && configField && configuration"
                    :targetGroup="targetGroup"
                    :sourceGroups="sourceGroups"
                    :targetFields="targetFields"
                    :configuration="configuration"
                    :busy="busy"
                    @update:busy="busy = $event"
                    @retry="retrySourceGroup"
                    @update:configuration="onConfigurationUpdated"
                    @update:targetFields="onTargetFieldsUpdated"
                />
            </template>
        </template>
    </Card>
</template>

<style scoped>
.main-card {
    max-width: 1200px;
    margin: 0 auto;
}

.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
}

.header h1 {
    font-size: 1.875rem;
    font-weight: 700;
    margin: 0;
}

.version {
    font-size: 0.875rem;
    color: #6b7280;
}
</style>
