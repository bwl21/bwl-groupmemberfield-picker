import { readFileSync } from 'node:fs';
import { build } from 'vite';
import vue from '@vitejs/plugin-vue';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const extensionKey = 'bwl-groupmemberfield-picker';

// Release assets use the installation's origin/session, never local credentials.
await build({
    configFile: false,
    envFile: false,
    envPrefix: [],
    plugins: [vue()],
    base: `/ccm/${extensionKey}/`,
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
        'import.meta.env.VITE_KEY': JSON.stringify(extensionKey),
        'import.meta.env.VITE_CHURCHTOOLS_URL': 'undefined',
        'import.meta.env.VITE_BASE_URL': 'undefined',
        'import.meta.env.VITE_USERNAME': 'undefined',
        'import.meta.env.VITE_PASSWORD': 'undefined',
    },
});
