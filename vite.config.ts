import { defineConfig, loadEnv } from 'vite';

// https://vitejs.dev/config/
export default ({ mode }) => {
    process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };
    return defineConfig({
        base: `/ccm/${process.env.VITE_KEY}/`,
        server: {
            host: '0.0.0.0',
            port: 5173,
            allowedHosts: true
        },
    });
};
