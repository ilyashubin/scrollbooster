import { defineConfig, type Plugin } from 'vite';
import { PAGES } from './demo/shared/pages.ts';

/**
 * Event log of a demo page sent from a device without devtools: POST /__events keeps the last one in memory of the
 * dev server, GET returns it, for example `curl localhost:5173/__events`
 */
function eventLog(): Plugin {
    let log = 'No log sent yet\n';
    return {
        name: 'demo-event-log',
        configureServer(server) {
            server.middlewares.use('/__events', (req, res) => {
                if (req.method === 'POST') {
                    let body = '';
                    req.setEncoding('utf8');
                    req.on('data', (chunk: string) => {
                        body += chunk;
                    });
                    req.on('end', () => {
                        log = `${new Date().toISOString()} ${req.headers['user-agent'] ?? ''}\n${body}\n`;
                        server.config.logger.info(`Event log received, ${body.split('\n').length} lines: /__events`);
                        res.end('ok');
                    });
                    return;
                }
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.end(log);
            });
        },
    };
}

// Demo pages import `src/` directly: no library build while developing
export default defineConfig({
    root: 'demo',
    // Relative asset paths, so the built demo works from any directory of a static host
    base: './',
    server: { host: true, open: true },
    plugins: [eventLog()],
    // Dependency scan of the dev server would resolve build input from `root`, its own globs are relative to `root`
    optimizeDeps: { entries: ['*.html'] },
    build: {
        outDir: '../dist-demo',
        emptyOutDir: true,
        rolldownOptions: {
            // Resolved from the working directory
            input: PAGES.map((page) => `demo/${page.file}`),
        },
    },
});
