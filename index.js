// Horloge mondiale : ton appli d'origine (HTML et code inchangés), livrée en plugin.
// Ses données sont dans le dossier du plugin, que NeoBase sauvegarde (synchro cloud et sauvegardes) ; à la première ouverture elle reprend ce que tu avais dans NeoBase.
// Elle demande l'accès complet pour utiliser les outils d'interface de NeoBase. NeoBase ne l'ouvre que si elle est signée.
const HTML = "<div class=\"appWrap\">\n      <div class=\"agHead\"><span class=\"label\">Horloge mondiale</span><input class=\"f\" id=\"wcAdd\" placeholder=\"Ajouter une ville… (Entrée)\" spellcheck=\"false\" style=\"width:260px;margin-left:auto;font-size:15px;padding:8px 12px\"></div>\n      <div class=\"sysCard px\"><div class=\"bdPlan\">Décaler de <input type=\"range\" id=\"wcShift\" min=\"-24\" max=\"24\" value=\"0\" style=\"flex:1;accent-color:var(--magenta)\"><b id=\"wcShiftVal\"></b><button class=\"btn px\" id=\"wcNow\">MAINTENANT</button></div></div>\n      <div id=\"wcGrid\" class=\"sysGrid\"></div>\n    </div>";
/*CSS-MOVED*/ const CSS = `.wcCard{position:relative}
.wcHead{display:flex;align-items:center;justify-content:space-between}
.wcTime{font:26px var(--title);color:#fff;margin:6px 0}
.wcCard .x{position:absolute;top:8px;right:8px;font-size:9px;visibility:hidden}
.wcCard:hover .x{visibility:visible}
.wcCard .x:hover{color:var(--red)}
.bdPlan{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:16px;color:var(--lilac)}
.bdPlan .f{width:110px;font-size:15px;padding:7px 10px}
.bdPlan select.f{width:160px}
`;  // le style de ce plugin (il utilise les variables du thème de NeoBase)
export default async function (ctx) {
  const view = ctx.view;
  if (!ctx.host) { view.textContent = "Ce plugin doit être approuvé par NeoBase pour s'ouvrir."; return; }
  const { el, toast, sfx, ask, newTab, pixIcon, PIX, WX } = ctx.host;
  const folder = ctx.folder, legacy = ctx.legacy || {};
  ctx.host.addStyle(CSS);
  view.innerHTML = HTML;
  const $ = id => id === "clockApp" ? view : view.querySelector('#' + id);  // les identifiants de ta vue, sans toucher à ceux du reste de NeoBase
  const doc = async n => { try { return await folder.read(n); } catch { return null; } };
  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  let prefs = await doc('prefs');
  if (prefs == null) {  // première ouverture : tu retrouves tes réglages d'avant
    prefs = {}; const old = legacy.settings ? await legacy.settings().catch(() => ({})) : {};
    for (const k of ["worldClocks"]) if (old[k] !== undefined && old[k] !== '' && !(Array.isArray(old[k]) && !old[k].length)) prefs[k] = old[k];
    if (Object.keys(prefs).length) await folder.write('prefs', prefs);
  }
  const neo = { win: a => ctx.host.win?.(a), getSettings: async () => prefs, setSettings: async s => { Object.assign(prefs, s); await folder.write('prefs', prefs); return prefs; } };
  // ---- ton code d'origine ----
  /* ---------- Horloge mondiale app: cities in settings.worldClocks [{name, tz}], a shift to answer "what time will it be there if…" ---------- */
  let wcTimer = null, wcShift = 0;
  const WC_DEFAULT = [{name: 'New York', tz: 'America/New_York'}, {name: 'Los Angeles', tz: 'America/Los_Angeles'}, {name: 'Londres', tz: 'Europe/London'}, {name: 'Tokyo', tz: 'Asia/Tokyo'}, {name: 'Séoul', tz: 'Asia/Seoul'}];
  const wcList = () => [{name: 'Ici', tz: Intl.DateTimeFormat().resolvedOptions().timeZone, here: true}, ...(prefs.worldClocks?.length ? prefs.worldClocks : WC_DEFAULT)];
  const wcOffset = (tz, d) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'}).formatToParts(d).map(x => [x.type, x.value])); return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(d / 1000) * 1000) / 60000; };
  function wcRender() {
    clearTimeout(wcTimer);
    if (!view.classList.contains('on')) return;
    wcTimer = setTimeout(wcRender, 1000 - Date.now() % 1000);
    const d = new Date(Date.now() + wcShift * 3600e3), here = wcOffset(wcList()[0].tz, d);
    $('wcShiftVal').textContent = wcShift ? (wcShift > 0 ? 'dans ' : 'il y a ') + Math.abs(wcShift) + ' h' : 'maintenant';
    $('wcGrid').replaceChildren(...wcList().map(c => {
      const card = el('div', 'sysCard px wcCard'), off = wcOffset(c.tz, d), diff = (off - here) / 60, h = +d.toLocaleString('fr-FR', {timeZone: c.tz, hour: '2-digit', hourCycle: 'h23'});
      const ic = el('span', 'wcIc'), k = h >= 7 && h < 20 ? 'sun' : 'moon'; ic.innerHTML = pixIcon(WX[k][1], 3); ic.style.color = WX[k][0];
      const head = el('div', 'wcHead'); head.append(el('span', 'label', c.name), ic);
      card.append(head, el('div', 'wcTime', d.toLocaleTimeString('fr-FR', {timeZone: c.tz, hour: '2-digit', minute: '2-digit', second: '2-digit'})),
        el('div', 'hint', d.toLocaleDateString('fr-FR', {timeZone: c.tz, weekday: 'long', day: 'numeric', month: 'long'}) + (c.here ? '' : ' · ' + (diff === 0 ? 'même heure' : (diff > 0 ? '+' : '') + String(diff).replace('.', ',') + ' h'))));
      if (!c.here) { const x = el('button', 'x', 'X'); x.title = 'Retirer'; x.onclick = () => setClocks(wcList().slice(1).filter(o => o !== c)); card.append(x); }
      return card;
    }));
  }
  const setClocks = list => neo.setSettings({worldClocks: list.map(({name, tz}) => ({name, tz}))}).then(s => { prefs = s; wcRender(); });
  $('wcAdd').onkeydown = async e => {
    if (e.key !== 'Enter' || !e.target.value.trim()) return;
    try {
      const r = (await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=fr&name=' + encodeURIComponent(e.target.value.trim())).then(r => r.json())).results?.[0];
      if (!r?.timezone) return toast('Ville introuvable', true);
      e.target.value = ''; setClocks([...wcList().slice(1), {name: r.name, tz: r.timezone}]);
    } catch (err) { toast('Recherche impossible : ' + err.message, true); }
  };
  $('wcShift').oninput = e => { wcShift = +e.target.value; wcRender(); };
  $('wcNow').onclick = () => { wcShift = 0; $('wcShift').value = 0; wcRender(); };
  // ---- fin ----
  ctx.onOpen(() => { wcRender(); });
  ctx.onClose(() => { clearTimeout(wcTimer); });
}
