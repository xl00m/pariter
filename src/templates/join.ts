import { escapeHtml } from './layout';

export function joinTemplate(code: string){
  const safe = escapeHtml(code || '');
  return `
    <div class="centerShell">
      <div class="centerMax">
        <div style="text-align:center; margin-bottom: 18px;">
          <div style="font-size:12px; text-transform:uppercase; opacity:.9; letter-spacing:.18em; font-weight:800">✦ PARITER ✦</div>
          <div style="margin-top: 16px; font-size: 28px; font-weight: 800;">Присоединиться к пути</div>
          <div style="margin-top: 8px; font-size: 14px; color: var(--textMuted);">Iunge te itineri</div>
        </div>
        <div class="card" style="padding: 18px;">
          <div class="textMuted" style="font-size: 13px; line-height: 1.6">Проверяю приглашение <span class="kbd">\${safe}</span>…</div>
          <div class="textMuted" style="margin-top: 10px; font-size: 12px;">Если код недействителен — SPA покажет причину.</div>
        </div>
      </div>
    </div>
  `;
}
