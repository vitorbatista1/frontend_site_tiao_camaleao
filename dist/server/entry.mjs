import { renderers } from './renderers.mjs';
import { c as createExports, s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_DiuwY82k.mjs';
import { manifest } from './manifest_C5lLL1dU.mjs';

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/404.astro.mjs');
const _page2 = () => import('./pages/admin/login.astro.mjs');
const _page3 = () => import('./pages/admin.astro.mjs');
const _page4 = () => import('./pages/campanha1.astro.mjs');
const _page5 = () => import('./pages/campanha2.astro.mjs');
const _page6 = () => import('./pages/pagamento.astro.mjs');
const _page7 = () => import('./pages/index.astro.mjs');

const pageMap = new Map([
    ["node_modules/astro/dist/assets/endpoint/node.js", _page0],
    ["src/pages/404.astro", _page1],
    ["src/pages/admin/login.astro", _page2],
    ["src/pages/admin/index.astro", _page3],
    ["src/pages/campanha1.astro", _page4],
    ["src/pages/campanha2.astro", _page5],
    ["src/pages/pagamento.astro", _page6],
    ["src/pages/index.astro", _page7]
]);
const serverIslandMap = new Map();
const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    middleware: () => import('./_astro-internal_middleware.mjs')
});
const _args = {
    "mode": "standalone",
    "client": "file:///home/htf/Documentos/vitor/frontend_site_tiao_astro/dist/client/",
    "server": "file:///home/htf/Documentos/vitor/frontend_site_tiao_astro/dist/server/",
    "host": false,
    "port": 4321,
    "assets": "_astro"
};
const _exports = createExports(_manifest, _args);
const handler = _exports['handler'];
const startServer = _exports['startServer'];
const options = _exports['options'];
const _start = 'start';
{
	serverEntrypointModule[_start](_manifest, _args);
}

export { handler, options, pageMap, startServer };
