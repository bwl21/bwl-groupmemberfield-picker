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
import type { FieldSelectionConfiguration } from './utils/field-mapping-types';
import { 
    findConfigurationField, 
    getGroupSpecificMemberFields 
} from './utils/group-member-fields';
import { 
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
const sourceGroup = ref<Group | null>(null);
const configField = ref<{ fieldName: string; value: string | undefined } | null>(null);
const targetFields = ref<GroupMemberFieldGroup[]>([]);
const sourceFields = ref<GroupMemberFieldGroup[]>([]);
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
    sourceGroup.value = null;
    sourceFields.value = [];
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
                    if (parsed.selectedFields.length > 0) {
                        const sourceGroupId = parsed.selectedFields[0].sourceGroupId;
                        const srcGroup = allGroups.value.find(g => g.id === sourceGroupId);
                        if (srcGroup) {
                            sourceGroup.value = srcGroup;
                            sourceFields.value = await getGroupSpecificMemberFields(sourceGroupId);
                        }
                    }
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
    sourceGroup.value = null;
    sourceFields.value = [];
}

async function onSourceGroupSelected(group: Group) {
    sourceGroup.value = group;
    loading.value = true;

    try {
        sourceFields.value = await getGroupSpecificMemberFields(group.id);
        loading.value = false;
    } catch (err) {
        error.value = `Fehler beim Laden der Quellgruppenfelder: ${err instanceof Error ? err.message : String(err)}`;
        loading.value = false;
    }
}

function clearSourceGroup() {
    sourceGroup.value = null;
    sourceFields.value = [];
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
                    :sourceGroup="sourceGroup"
                    @select="onSourceGroupSelected"
                    @clear="clearSourceGroup"
                />

                <Step3FieldSelection
                    v-if="targetGroup && configField && sourceGroup"
                    :targetGroup="targetGroup"
                    :sourceGroup="sourceGroup"
                    :sourceFields="sourceFields"
                    :targetFields="targetFields"
                    :configuration="configuration"
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
