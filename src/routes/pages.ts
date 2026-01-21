import { layout } from '../templates/layout';
import { landingTemplate } from '../templates/landing';
import { loginTemplate } from '../templates/login';
import { registerTemplate } from '../templates/register';
import { joinTemplate } from '../templates/join';
import { pathTemplate } from '../templates/path';
import { settingsTemplate } from '../templates/settings';
import { inviteTemplate } from '../templates/invite';

type Page = { title: string; description: string; body: string };

function pickTemplate(pathname: string): Page {
  const description = 'Pariter — вместе, наравне, вперёд. Совместный дневник личностного роста.';

  if (pathname === '/') {
    return { title: '✦ PARITER ✦', description, body: landingTemplate() };
  }
  if (pathname === '/login') {
    return { title: 'Вход — ✦ PARITER ✦', description, body: loginTemplate() };
  }
  if (pathname === '/register') {
    return { title: 'Регистрация — ✦ PARITER ✦', description, body: registerTemplate() };
  }
  if (pathname.startsWith('/join/')) {
    const code = decodeURIComponent(pathname.split('/').pop() || '').trim();
    return { title: 'Присоединиться — ✦ PARITER ✦', description, body: joinTemplate(code) };
  }
  if (pathname === '/path' || pathname === '/') {
    return { title: 'Путь — ✦ PARITER ✦', description, body: pathTemplate() };
  }
  if (pathname === '/settings') {
    return { title: 'Настройки — ✦ PARITER ✦', description, body: settingsTemplate() };
  }
  if (pathname === '/invite') {
    return { title: 'Спутники — ✦ PARITER ✦', description, body: inviteTemplate() };
  }

  // SPA fallback
  return {
    title: '✦ PARITER ✦',
    description,
    body: pathTemplate(),
  };
}

export function renderAppShell(pathname: string, themeId?: string, bootstrap?: any){
  const p = pickTemplate(pathname);
  return layout({
    title: p.title,
    description: p.description,
    body: p.body,
    themeId,
    bootstrap,
  });
}
