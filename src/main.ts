import { churchtoolsClient } from '@churchtools/churchtools-client';
import { GroupMemberFieldPickerApp } from './app';
import './styles.css';

// only import reset.css in development mode to keep the production bundle small and to simulate CT environment
if (import.meta.env.MODE === 'development') {
    import('./utils/reset.css');
}

declare const window: Window &
    typeof globalThis & {
        settings: {
            base_url?: string;
        };
    };

const baseUrl = window.settings?.base_url ?? import.meta.env.VITE_CHURCHTOOLS_URL ?? import.meta.env.VITE_BASE_URL;
if (!baseUrl) {
    throw new Error('VITE_CHURCHTOOLS_URL or VITE_BASE_URL must be set in .env file');
}
churchtoolsClient.setBaseUrl(baseUrl);

const username = import.meta.env.VITE_USERNAME;
const password = import.meta.env.VITE_PASSWORD;
if (import.meta.env.MODE === 'development' && username && password) {
    await churchtoolsClient.post('/login', { username, password });
}

const KEY = import.meta.env.VITE_KEY;
export { KEY };

// Initialize the app
const app = new GroupMemberFieldPickerApp('#app');
await app.init();
