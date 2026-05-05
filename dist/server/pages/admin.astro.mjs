import { c as createComponent, r as renderHead, e as renderComponent, d as renderTemplate } from '../chunks/astro/server_CaXBw_u1.mjs';
import 'kleur/colors';
/* empty css                                     */
export { renderers } from '../renderers.mjs';

const prerender = false;
const $$Index = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`<html lang="pt-BR"> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Admin</title><meta name="robots" content="noindex, nofollow">${renderHead()}</head> <body> ${renderComponent($$result, "AdminPanel", null, { "client:only": "react", "client:component-hydration": "only", "client:component-path": "/home/htf/Documentos/vitor/frontend_site_tiao_astro/src/components/admin/AdminPanel", "client:component-export": "default" })} </body></html>`;
}, "/home/htf/Documentos/vitor/frontend_site_tiao_astro/src/pages/admin/index.astro", void 0);

const $$file = "/home/htf/Documentos/vitor/frontend_site_tiao_astro/src/pages/admin/index.astro";
const $$url = "/admin";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
