// Horloge mondiale : ton appli d'origine, reprise telle quelle (HTML et code inchangés), livrée en plugin.
// Elle demande l'accès complet : elle utilise les outils de NeoBase comme avant. NeoBase ne l'ouvre que si elle est signée.
const HTML = "<div class=\"appWrap\">\n      <div class=\"agHead\"><span class=\"label\">Horloge mondiale</span><input class=\"f\" id=\"wcAdd\" placeholder=\"Ajouter une ville… (Entrée)\" spellcheck=\"false\" style=\"width:260px;margin-left:auto;font-size:15px;padding:8px 12px\"></div>\n      <div class=\"sysCard px\"><div class=\"bdPlan\">Décaler de <input type=\"range\" id=\"wcShift\" min=\"-24\" max=\"24\" value=\"0\" style=\"flex:1;accent-color:var(--magenta)\"><b id=\"wcShiftVal\"></b><button class=\"btn px\" id=\"wcNow\">MAINTENANT</button></div></div>\n      <div id=\"wcGrid\" class=\"sysGrid\"></div>\n    </div>";
export default function (ctx) {
  const view = ctx.view;
  if (typeof el === 'undefined' || typeof neo === 'undefined') { view.textContent = "Ce plugin doit être approuvé par NeoBase pour s'ouvrir."; return; }
  view.innerHTML = HTML;
  const $ = id => view.querySelector('#' + id);  // les identifiants de ta vue, sans toucher à ceux du reste de NeoBase
  // ---- ton code d'origine ----
  /* ---------- Horloge mondiale app: cities in settings.worldClocks [{name, tz}], a shift to answer "what time will it be there if…" ---------- */
  let wcTimer = null, wcShift = 0;
  const WC_DEFAULT = [{name: 'New York', tz: 'America/New_York'}, {name: 'Los Angeles', tz: 'America/Los_Angeles'}, {name: 'Londres', tz: 'Europe/London'}, {name: 'Tokyo', tz: 'Asia/Tokyo'}, {name: 'Séoul', tz: 'Asia/Seoul'}];
  const wcList = () => [{name: 'Ici', tz: Intl.DateTimeFormat().resolvedOptions().timeZone, here: true}, ...(prefs.worldClocks?.length ? prefs.worldClocks : WC_DEFAULT)];
  const wcOffset = (tz, d) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'}).formatToParts(d).map(x => [x.type, x.value])); return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(d / 1000) * 1000) / 60000; };
  function wcRender() {
    clearTimeout(wcTimer);
    if (active?.app !== APPS['plugin:neobase.horloge']) return;
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
