import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc';
import ts from 'typescript';

// Execute the real component with in-memory API substitutes; no app startup or network.
const require = createRequire(import.meta.url);
const filename = 'src/components/Step3FieldSelection.vue';
const source = readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8');
const { descriptor } = parse(source, { filename });
const script = compileScript(descriptor, { id: 'field-selection-test' });
const compiled = ts.transpileModule(script.content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function field(id, name = `Field ${id}`) {
    return { id, name, referenceName: name, fieldTypeCode: 'textarea' };
}

function selection(sourceGroupId, fieldId) {
    return { sourceGroupId, fieldId, selected: true, fieldName: `Field ${fieldId}` };
}

function setup(selectedFields, sourceFields = [field(1)], targetFields = []) {
    const calls = { created: [], confirmed: [], toasts: [], saved: [] };
    const props = require('vue').reactive({
        sourceGroups: [{ id: 10, name: 'Source', fields: sourceFields }],
        busy: false,
        targetGroup: { id: 20, name: 'Target' },
        targetFields,
        configuration: { version: '1.0', targetGroupId: 20, selectedFields },
    });
    const exports = {};
    vm.runInNewContext(compiled, {
        exports,
        console,
        confirm: message => { calls.confirmed.push(message); return true; },
        require: name => {
            if (name === '../utils/group-member-fields') return {
                createGroupMemberField: async (id, data) => calls.created.push({ id, data }),
                getGroupSpecificMemberFields: async () => [],
                updateGroupCustomFields: async (id, data) => calls.saved.push({ id, data }),
            };
            if (name === '../utils/field-mapping-types') return { serializeConfiguration: JSON.stringify };
            if (name === 'primevue/usetoast') return { useToast: () => ({ add: value => calls.toasts.push(value) }) };
            if (name.startsWith('primevue/')) return {};
            return require(name);
        },
    });
    const component = exports.default.setup(props, { expose() {}, emit(name, value) {
        if (name === 'update:configuration') props.configuration = value;
        if (name === 'update:busy') props.busy = value;
        if (name === 'update:targetFields') props.targetFields = value;
    } });
    return { component, calls, props };
}

test('hidden selections from another group do not count or create fields, even with matching IDs', async () => {
    const { component, calls } = setup([selection(99, 1), selection(99, 2)]);
    assert.equal(component.isFieldSelected(10, 1), false);
    assert.equal(component.fieldsToCreate.value.length, 0);
    await component.createFields();
    assert.equal(calls.confirmed.length, 0);
    assert.equal(calls.created.length, 0);
    assert.equal(calls.toasts[0].severity, 'warn');
});

test('confirmation and creation include only visible, selected, new fields', async () => {
    const { component, calls } = setup(
        [selection(99, 1), selection(10, 1), selection(10, 2), selection(10, 999)],
        [field(1), field(2), field(3)],
        [field(2)],
    );
    await component.createFields();
    assert.match(calls.confirmed[0], /^1 Feld\(er\)/);
    assert.equal(calls.created.length, 1);
    assert.equal(calls.created[0].id, 20);
    assert.equal(calls.created[0].data.name, 'Field 1');
});

test('an empty selection cannot create fields', async () => {
    const { component, calls } = setup([]);
    await component.createFields();
    assert.equal(calls.confirmed.length, 0);
    assert.equal(calls.created.length, 0);
});

test('template compiles and disables creation for an empty effective selection', () => {
    const result = compileTemplate({ source: descriptor.template.content, filename, id: 'field-selection-test' });
    assert.deepEqual(result.errors, []);
    assert.match(result.code, /disabled: .*fieldsToCreate.length === 0/);
});


test('fields with equal IDs in different groups use their own definitions', async () => {
    const { component, calls, props } = setup([selection(10, 1), selection(11, 1)]);
    props.sourceGroups.push({ id: 11, name: 'Second source', fields: [field(1, 'Second field')] });
    await component.createFields();
    assert.equal(calls.created.length, 2);
    assert.deepEqual(calls.created.map(call => call.data.name), ['Field 1', 'Second field']);
    assert.match(calls.confirmed[0], /2 Feld\(er\) aus 2 Quellgruppe/);
    assert.match(calls.confirmed[0], /Second source: Second field/);
    assert.equal(props.busy, false);
});

test('toggling a field preserves the other source group selection', () => {
    const { component, props } = setup([selection(10, 1), selection(11, 1)]);
    component.toggleField(props.sourceGroups[0], field(1), false);
    assert.equal(props.configuration.selectedFields.length, 1);
    assert.equal(props.configuration.selectedFields[0].sourceGroupId, 11);
    component.toggleField(props.sourceGroups[0], field(1), true);
    assert.equal(props.configuration.selectedFields.length, 2);
});

test('conflicting references across sources must be resolved before creation', async () => {
    const { component, calls, props } = setup([selection(10, 1), selection(11, 1)]);
    props.sourceGroups.push({ id: 11, name: 'Second source', fields: [field(1)] });
    await component.createFields();
    assert.equal(component.duplicateReferences.value.length, 1);
    assert.equal(calls.created.length, 0);
    assert.equal(calls.confirmed.length, 0);
});

test('unavailable fields remain visible as missing and are never created', async () => {
    const { component, calls, props } = setup([selection(10, 999)]);
    assert.equal(component.missingFields(props.sourceGroups[0])[0].fieldId, 999);
    await component.createFields();
    assert.equal(calls.created.length, 0);
    component.removeField(10, 999);
    assert.equal(props.configuration.selectedFields.length, 0);
});

test('an empty overall selection can still be saved', async () => {
    const { component, calls, props } = setup([]);
    props.sourceGroups = [];
    props.configuration.sourceGroupIds = [];
    await component.saveSelection();
    assert.equal(calls.saved.length, 1);
    assert.deepEqual(JSON.parse(calls.saved[0].data.bwl_gmfp_config).selectedFields, []);
});
