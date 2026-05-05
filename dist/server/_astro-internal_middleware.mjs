import { d as defineMiddleware, s as sequence } from './chunks/index_Egw9oU_9.mjs';
import 'es-module-lexer';
import './chunks/astro-designed-error-pages_BpfAIrfU.mjs';
import '@astrojs/internal-helpers/path';
import 'cookie';

const onRequest$1 = defineMiddleware((context, next) => {
  const { pathname } = context.url;
  if (pathname === "/") {
    return context.redirect("/campanha1", 301);
  }
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const token = context.cookies.get("auth_token")?.value;
    if (!token) {
      return context.redirect("/admin/login");
    }
  }
  return next();
});

const onRequest = sequence(
	
	onRequest$1
	
);

export { onRequest };
