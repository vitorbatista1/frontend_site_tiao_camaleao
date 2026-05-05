import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = context.url;

  if (pathname === '/') {
    return context.redirect('/campanha1', 301);
  }

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const token = context.cookies.get('auth_token')?.value;

    if (!token) {
      return context.redirect('/admin/login');
    }
  }

  return next();
});
