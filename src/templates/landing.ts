export function landingTemplate(){
  return `
    <div class="centerShell">
      <div class="container" style="text-align:center">
        <div style="font-size:12px; text-transform:uppercase; opacity:.9; letter-spacing:.18em; font-weight:800">✦ PARITER ✦</div>
        <div style="margin-top: 18px; font-size: 44px; font-weight: 900;">Вместе. Наравне. Вперёд.</div>
        <div class="textMuted" style="margin-top: 6px;">Ūnā. Pariter. Porro.</div>

        <div class="card" style="margin: 22px auto 0; width: min(620px, 100%); padding: 18px; text-align:left">
          <div style="font-size:18px; font-weight: 900;">Зачем Pariter</div>
          <div class="textMuted" style="margin-top: 10px; line-height: 1.6">
            <div>• Фиксируй ежедневные победы над страхом.</div>
            <div>• Забирай уроки из ошибок, не повторяя их.</div>
            <div>• Видь записи спутников — и иди вместе.</div>
          </div>
          <div class="row" style="margin-top: 16px; flex-wrap: wrap">
            <a class="btn" style="flex:1; display:inline-block; text-align:center" href="/register">Начать путь</a>
            <a class="btn-ghost" style="flex:1; display:inline-block; text-align:center" href="/login">Уже в пути? Войти</a>
          </div>
          <div class="textMuted" style="margin-top: 10px; font-size: 12px;">Self-hosted. Open Source. Bun + SQLite.</div>
        </div>
      </div>
    </div>
  `;
}
