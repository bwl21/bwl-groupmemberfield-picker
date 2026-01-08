<template>
  <Toast />
  <div style="width: 100%; max-width: 56rem;">
    <Card>
      <template #content>
        <div class="flex justify-between items-center mb-6">
          <h1 class="text-3xl font-bold">Gruppenmitgliedsfelder zusammensammeln</h1>
          <span class="text-sm text-gray-600">v{{ version }}</span>
        </div>

        <Message v-if="error" severity="error" :closable="false">
          {{ error }}
        </Message>

        <div v-if="loading" class="flex items-center gap-3">
          <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" />
          <span>Lädt...</span>
        </div>

        <div v-else>
          <!-- Step 1: Target Group -->
          <div class="mb-6">
            <h2 class="text-xl font-semibold mb-3">Schritt 1: Zielgruppe</h2>

            <Message v-if="targetGroup" severity="success" :closable="false" class="mb-3">
              <div class="flex items-center justify-between">
                <span>Ausgewählt: <strong>{{ targetGroup.name }}</strong></span>
                <Button label="Ändern" text size="small" @click="clearTargetGroup" />
              </div>
            </Message>

            <div v-else class="mb-3">
              <label class="block mb-2">Zielgruppe auswählen</label>
              <AutoComplete
                v-model="targetSearchQuery"
                :suggestions="filteredTargetGroups"
                @complete="searchTargetGroups"
                @item-select="onTargetGroupSelect"
                optionLabel="name"
                placeholder="Gruppe suchen..."
                class="w-full"
                dropdown
              >
                <template #option="{ option }">
                  <div>
                    <div class="font-medium">{{ option.name }}</div>
                    <div class="text-sm text-gray-600">ID: {{ option.id }}</div>
                  </div>
                </template>
              </AutoComplete>
            </div>

            <Message v-if="targetGroup && !configField" severity="warn" :closable="false">
              <div>
                <p class="font-semibold mb-2">⚠️ Konfigurationsfeld fehlt</p>
                <p class="mb-2">Das benötigte <strong>GRUPPENFELD</strong> (nicht Gruppenmitgliedsfeld!) wurde nicht gefunden.</p>
                <p class="mb-3">Erforderliche Eigenschaften:</p>
                <ul class="list-disc ml-5 mb-3">
                  <li><strong>Feldname:</strong> <code>bwl_gmfp_config</code></li>
                  <li><strong>Typ:</strong> Textarea</li>
                  <li><strong>Ort:</strong> Stammdaten → Gruppen → Felder (Custom Group Fields)</li>
                </ul>
              </div>
            </Message>

            <Message v-else-if="targetGroup && configField" severity="success" :closable="false">
              Konfigurationsfeld gefunden: <strong>{{ configField.fieldName }}</strong>
            </Message>
          </div>

          <!-- Step 2: Source Group -->
          <div v-if="targetGroup && configField" class="mb-6">
            <h2 class="text-xl font-semibold mb-3">Schritt 2: Quellgruppe</h2>

            <Message v-if="sourceGroup" severity="success" :closable="false" class="mb-3">
              <div class="flex items-center justify-between">
                <span>Ausgewählt: <strong>{{ sourceGroup.name }}</strong></span>
                <Button label="Ändern" text size="small" @click="clearSourceGroup" />
              </div>
            </Message>

            <div v-else class="mb-3">
              <label class="block mb-2">Quellgruppe auswählen</label>
              <AutoComplete
                v-model="sourceSearchQuery"
                :suggestions="filteredSourceGroups"
                @complete="searchSourceGroups"
                @item-select="onSourceGroupSelect"
                optionLabel="name"
                placeholder="Gruppe suchen..."
                class="w-full"
                dropdown
              >
                <template #option="{ option }">
                  <div>
                    <div class="font-medium">{{ option.name }}</div>
                    <div class="text-sm text-gray-600">ID: {{ option.id }}</div>
                  </div>
                </template>
              </AutoComplete>
            </div>
          </div>

          <!-- Step 3: Field Selection -->
          <div v-if="targetGroup && configField && sourceGroup" class="mb-6">
            <h2 class="text-xl font-semibold mb-3">Schritt 3: Felder auswählen</h2>

            <Message v-if="sourceFields.length === 0" severity="info" :closable="false">
              Die Quellgruppe "{{ sourceGroup.name }}" hat keine Gruppenmitgliedsfelder.
            </Message>

            <div v-else>
              <p class="text-sm text-gray-600 mb-3">
                Wählen Sie aus, welche Felder aus der Quellgruppe "{{ sourceGroup.name }}"
                in die Zielgruppe übernommen werden sollen.
                Die Felddefinitionen (Name, Typ, Optionen) werden kopiert.
              </p>

              <div class="border rounded p-4 mb-4">
                <div v-for="field in sourceFields" :key="field.id" class="mb-2">
                  <div class="flex items-center gap-3 p-2" :class="{ 'bg-gray-100': fieldExists(field) }">
                    <Checkbox
                      v-model="selectedFieldIds"
                      :value="field.id"
                      :disabled="fieldExists(field)"
                      :inputId="`field-${field.id}`"
                    />
                    <label :for="`field-${field.id}`" class="flex-1 cursor-pointer">
                      <div class="font-medium">{{ field.name }}</div>
                      <div class="text-sm text-gray-600">
                        Typ: {{ field.fieldTypeCode }} | Referenz: {{ field.referenceName }}
                        <span v-if="fieldExists(field)" class="text-orange-600">
                          | ⚠️ Existiert bereits in Zielgruppe
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <div class="flex gap-2">
                <Button
                  label="Ausgewählte Felder anlegen"
                  icon="pi pi-plus"
                  @click="createFields"
                  :disabled="selectedFieldIds.length === 0"
                />
                <Button
                  label="Auswahl speichern"
                  icon="pi pi-save"
                  severity="secondary"
                  @click="saveSelection"
                />
              </div>
            </div>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { churchtoolsClient } from '@churchtools/churchtools-client';
import Card from 'primevue/card';
import AutoComplete from 'primevue/autocomplete';
import Button from 'primevue/button';
import Message from 'primevue/message';
import Checkbox from 'primevue/checkbox';
import ProgressSpinner from 'primevue/progressspinner';
import Toast from 'primevue/toast';
import type { Group, GroupMemberFieldGroup } from './utils/ct-types';
import {
  findConfigurationField,
  getGroupSpecificMemberFields,
  updateGroupCustomFields,
  createGroupMemberField,
} from './utils/group-member-fields';
import {
  parseConfiguration,
  createEmptyConfiguration,
  serializeConfiguration,
  type FieldSelectionConfiguration,
} from './utils/field-mapping-types';
import packageJson from '../package.json';

// Toast
const toast = useToast();

// Version
const version = packageJson.version;

// State
const loading = ref(false);
const error = ref<string | null>(null);
const allGroups = ref<Group[]>([]);
const targetGroup = ref<Group | null>(null);
const sourceGroup = ref<Group | null>(null);
const targetSearchQuery = ref('');
const sourceSearchQuery = ref('');
const filteredTargetGroups = ref<Group[]>([]);
const filteredSourceGroups = ref<Group[]>([]);
const configField = ref<{ fieldName: string; value: string | undefined } | null>(null);
const targetFields = ref<GroupMemberFieldGroup[]>([]);
const sourceFields = ref<GroupMemberFieldGroup[]>([]);
const configuration = ref<FieldSelectionConfiguration | null>(null);
const selectedFieldIds = ref<number[]>([]);

// Computed
const existingReferenceNames = computed(() => 
  new Set(targetFields.value.map(f => f.referenceName))
);

const fieldExists = (field: GroupMemberFieldGroup) => 
  existingReferenceNames.value.has(field.referenceName);

// Methods
const loadGroups = async () => {
  try {
    loading.value = true;
    const groups = await churchtoolsClient.getAllPages<Group>('/groups', {}, 100);
    console.log('Loaded groups:', groups.length);
    allGroups.value = groups;
  } catch (err) {
    console.error('Error loading groups:', err);
    error.value = `Fehler beim Laden der Gruppen: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    loading.value = false;
  }
};

const searchTargetGroups = (event: any) => {
  const query = event.query.toLowerCase();
  if (!query) {
    filteredTargetGroups.value = allGroups.value.slice(0, 10);
  } else {
    filteredTargetGroups.value = allGroups.value
      .filter(g => g.name.toLowerCase().includes(query))
      .slice(0, 10);
  }
};

const searchSourceGroups = (event: any) => {
  const query = event.query.toLowerCase();
  const filtered = allGroups.value.filter(g => g.id !== targetGroup.value?.id);
  
  if (!query) {
    filteredSourceGroups.value = filtered.slice(0, 10);
  } else {
    filteredSourceGroups.value = filtered
      .filter(g => g.name.toLowerCase().includes(query))
      .slice(0, 10);
  }
};

const onTargetGroupSelect = async (event: any) => {
  const group = event.value;
  if (!group) return;

  targetGroup.value = group;
  targetSearchQuery.value = '';
  loading.value = true;

  try {
    const [field, fields] = await Promise.all([
      findConfigurationField(group.id),
      getGroupSpecificMemberFields(group.id),
    ]);

    configField.value = field || null;
    targetFields.value = fields;

    if (field) {
      if (field.value) {
        const parsed = parseConfiguration(field.value);
        if (parsed) {
          configuration.value = parsed;
          
          // Load source group from configuration
          if (parsed.selectedFields.length > 0) {
            const sourceGroupId = parsed.selectedFields[0].sourceGroupId;
            const srcGroup = allGroups.value.find(g => g.id === sourceGroupId);
            
            if (srcGroup) {
              sourceGroup.value = srcGroup;
              const srcFields = await getGroupSpecificMemberFields(sourceGroupId);
              sourceFields.value = srcFields;
              
              // Restore selected fields
              selectedFieldIds.value = parsed.selectedFields.map(sf => sf.fieldId);
            }
          }
        } else {
          configuration.value = createEmptyConfiguration(group.id);
        }
      } else {
        configuration.value = createEmptyConfiguration(group.id);
      }
    }
  } catch (err) {
    console.error('Error loading target group data:', err);
    error.value = `Fehler beim Laden der Zielgruppe: ${err}`;
  } finally {
    loading.value = false;
  }
};

const onSourceGroupSelect = async (event: any) => {
  const group = event.value;
  if (!group) return;

  sourceGroup.value = group;
  sourceSearchQuery.value = '';
  loading.value = true;

  try {
    const fields = await getGroupSpecificMemberFields(group.id);
    sourceFields.value = fields;
  } catch (err) {
    console.error('Error loading source group fields:', err);
    error.value = `Fehler beim Laden der Quellgruppenfelder: ${err}`;
  } finally {
    loading.value = false;
  }
};

const clearTargetGroup = () => {
  targetGroup.value = null;
  targetFields.value = [];
  configField.value = null;
  configuration.value = null;
  clearSourceGroup();
};

const clearSourceGroup = () => {
  sourceGroup.value = null;
  sourceFields.value = [];
  selectedFieldIds.value = [];
};

const createFields = async () => {
  if (!configuration.value || !targetGroup.value || selectedFieldIds.value.length === 0) return;

  const confirmed = confirm(
    `${selectedFieldIds.value.length} Feld(er) werden in der Zielgruppe "${targetGroup.value.name}" angelegt.\n\nMöchten Sie fortfahren?`
  );

  if (!confirmed) return;

  loading.value = true;
  const results: { success: string[]; failed: Array<{ field: string; error: string }> } = {
    success: [],
    failed: [],
  };

  try {
    for (const fieldId of selectedFieldIds.value) {
      const sourceField = sourceFields.value.find(f => f.id === fieldId);
      if (!sourceField) continue;

      if (existingReferenceNames.value.has(sourceField.referenceName)) {
        results.failed.push({
          field: sourceField.name,
          error: 'Feld existiert bereits in der Zielgruppe',
        });
        continue;
      }

      try {
        await createGroupMemberField(targetGroup.value.id, {
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
      } catch (err) {
        results.failed.push({
          field: sourceField.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (results.success.length > 0) {
      toast.add({
        severity: 'success',
        summary: 'Felder erfolgreich angelegt',
        detail: `${results.success.length} Feld(er) wurden angelegt: ${results.success.join(', ')}`,
        life: 5000,
      });
      
      // Reload target fields and save configuration
      targetFields.value = await getGroupSpecificMemberFields(targetGroup.value.id);
      await saveConfiguration();
    }
    
    if (results.failed.length > 0) {
      results.failed.forEach(f => {
        toast.add({
          severity: 'error',
          summary: 'Fehler beim Anlegen',
          detail: `${f.field}: ${f.error}`,
          life: 5000,
        });
      });
    }
  } catch (err) {
    error.value = `Fehler beim Anlegen der Felder: ${err}`;
  } finally {
    loading.value = false;
  }
};

const saveSelection = async () => {
  try {
    await saveConfiguration();
    toast.add({
      severity: 'success',
      summary: 'Erfolgreich gespeichert',
      detail: 'Die Auswahl wurde erfolgreich gespeichert.',
      life: 3000,
    });
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Fehler beim Speichern',
      detail: `${err}`,
      life: 5000,
    });
  }
};

const saveConfiguration = async () => {
  if (!configuration.value || !targetGroup.value || !sourceGroup.value) return;

  try {
    // Update configuration with selected fields
    configuration.value.selectedFields = selectedFieldIds.value.map(fieldId => {
      const field = sourceFields.value.find(f => f.id === fieldId);
      return {
        sourceGroupId: sourceGroup.value!.id,
        sourceGroupName: sourceGroup.value!.name,
        fieldId,
        fieldName: field?.name || '',
        fieldType: field?.fieldTypeCode || '',
        selected: true,
      };
    });

    configuration.value.lastUpdated = new Date().toISOString();
    const configJson = serializeConfiguration(configuration.value);

    await updateGroupCustomFields(targetGroup.value.id, {
      bwl_gmfp_config: configJson,
    });

    console.log('✓ Configuration saved');
  } catch (err) {
    console.error('Error saving configuration:', err);
    throw err;
  }
};

// Lifecycle
onMounted(() => {
  loadGroups();
});
</script>

<style scoped>
.container-center {
  display: flex;
  justify-content: center;
  width: 100%;
}

.max-w-4xl {
  max-width: 56rem;
  width: 100%;
}
</style>
