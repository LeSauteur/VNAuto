import { ROUTE_TITLES } from './constants.mjs';

export function currentRoute() {
  const value = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return ROUTE_TITLES[value] ? value : 'dashboard';
}

export function navigate(route) {
  location.hash = `#/${route}`;
}

export function startRouter(onRoute) {
  const run = () => onRoute(currentRoute());
  window.addEventListener('hashchange', run);
  if (!location.hash) location.replace('#/dashboard');
  else run();
  return () => window.removeEventListener('hashchange', run);
}
