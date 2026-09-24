import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc';
import ts from 'typescript';
import * as configuration from '../src/utils/field-mapping-types.ts';

const require = createRequire(import.meta.url);
const oldCompact = JSON.stringify({ v: '1.0', t: 20, s: [{ g: 10, f: 1 }, { g: 11, f: 1 }], u: '2026-01-01' });

test('existing compact and full configurations preserve all source groups and fields', () => {
    const compact = configuration.parseConfiguration(oldCompact);
    assert.deepEqual(configuration.getSourceGroupIds(compact), [10, 11]);
    const { sourceGroupIds, ...oldFull } = compact;
    const full = configuration.parseConfiguration(JSON.stringify(oldFull));
    assert.deepEqual(configuration.getSourceGroupIds(full), [10, 11]);
    assert.deepEqual(configuration.parseConfiguration(configuration.serializeConfiguration(full)).selectedFields, compact.selectedFields);
});

test('groups without selected fields survive saving and reloading', () => {
    const config = configuration.parseConfiguration(oldCompact);
    config.sourceGroupIds = [10, 11, 12];
    const saved = configuration.serializeConfiguration(config);
    assert.deepEqual(JSON.parse(saved).g, [12]);
    assert.deepEqual(configuration.getSourceGroupIds(configuration.parseConfiguration(saved)).sort(), [10, 11, 12]);
    assert.equal(JSON.parse(saved).s.length, 2);
});

test('legacy compact shape stays unchanged when every group has selected fields', () => {
    assert.deepEqual(JSON.parse(configuration.serializeConfiguration(configuration.parseConfiguration(oldCompact))), JSON.parse(oldCompact));
});

test('the existing storage size limit remains enforced', () => {
    const config = configuration.createEmptyConfiguration(20);
    config.sourceGroupIds = Array.from({ length: 1000 }, (_, index) => index);
    assert.throws(() => configuration.serializeConfiguration(config), /Maximum: 1000/);
});

function setupApp(failingGroups = new Set()) {
    const source = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8');
    const { descriptor } = parse(source);
    const script = compileScript(descriptor, { id: 'app-test' });
    const compiled = ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const exports = {};
    const calls = [];
    vm.runInNewContext(compiled, {
        exports,
        __APP_VERSION__: 'test',
        require: name => {
            if (name === 'vue') return { ...require('vue'), onMounted() {} };
            if (name === './utils/field-mapping-types') return configuration;
            if (name === './utils/group-member-fields') return {
                findConfigurationField: async () => ({ fieldName: 'bwl_gmfp_config', value: oldCompact }),
                getGroupSpecificMemberFields: async id => {
                    calls.push(id);
                    if (failingGroups.has(id)) throw new Error("Synthetic load failure");
                    return [{ id: 1, name: `Field of ${id}`, referenceName: `field-${id}` }];
                },
            };
            if (name === 'primevue/usetoast') return { useToast: () => ({ add() {} }) };
            return {};
        },
    });
    const app = exports.default.setup({}, { expose() {} });
    app.allGroups.value = [{ id: 10, name: 'First' }, { id: 11, name: 'Second' }, { id: 12, name: 'Empty' }];
    return { app, calls };
}

test('loading an old saved selection restores every source group; removing one clears only its fields', async () => {
    const { app, calls } = setupApp();
    await app.onTargetGroupSelected({ id: 20, name: 'Target' });
    assert.deepEqual(Array.from(app.sourceGroups.value, group => group.id), [10, 11]);
    assert.deepEqual(calls.sort(), [10, 11, 20]);
    app.removeSourceGroup(10);
    assert.deepEqual(Array.from(app.sourceGroups.value, group => group.id), [11]);
    assert.deepEqual(Array.from(app.configuration.value.selectedFields, field => field.sourceGroupId), [11]);
    await app.onSourceGroupSelected({ id: 12, name: 'Empty' });
    await app.onSourceGroupSelected({ id: 12, name: 'Empty' });
    assert.deepEqual(Array.from(app.sourceGroups.value, group => group.id), [11, 12]);
    app.removeSourceGroup(11);
    app.removeSourceGroup(12);
    assert.equal(app.configuration.value.selectedFields.length, 0);
    assert.equal(configuration.getSourceGroupIds(app.configuration.value).length, 0);
});

test('an unavailable saved group remains visible without fetching unknown groups', async () => {
    const { app, calls } = setupApp();
    app.allGroups.value = [{ id: 10, name: 'First' }];
    await app.onTargetGroupSelected({ id: 20, name: 'Target' });
    assert.equal(app.sourceGroups.value.length, 2);
    assert.ok(app.sourceGroups.value[1].error);
    assert.equal(calls.includes(11), false);
    assert.equal(app.configuration.value.selectedFields.length, 2);
});

test('all changed Vue templates compile', () => {
    for (const filename of ['App.vue', 'components/Step2SourceGroup.vue', 'components/Step3FieldSelection.vue']) {
        const { descriptor, errors } = parse(readFileSync(new URL(`../src/${filename}`, import.meta.url), 'utf8'));
        assert.deepEqual(errors, []);
        assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename, id: 'template-test' }).errors, []);
    }
});


test('a source load failure preserves selection and can be retried independently', async () => {
    const failingGroups = new Set([11]);
    const { app } = setupApp(failingGroups);
    await app.onTargetGroupSelected({ id: 20, name: 'Target' });
    assert.ok(app.sourceGroups.value[1].error);
    assert.equal(app.sourceGroups.value[0].fields.length, 1);
    assert.equal(app.configuration.value.selectedFields.length, 2);
    failingGroups.clear();
    await app.retrySourceGroup(11);
    assert.equal(app.sourceGroups.value[1].error, undefined);
    assert.equal(app.sourceGroups.value[1].fields.length, 1);
    assert.equal(app.busy.value, false);
});
