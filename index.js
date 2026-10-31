// Horloge mondiale, plugin NeoBase autonome (storage : les villes, synchronisées · network : chercher une ville).
const DEFAULT = [{name: 'New York', tz: 'America/New_York'}, {name: 'Londres', tz: 'Europe/London'}, {name: 'Tokyo', tz: 'Asia/Tokyo'}, {name: 'Los Angeles', tz: 'America/Los_Angeles'}];
const offset = (tz, d) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'}).formatToParts(d).map(x => [x.type, x.value])); return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(d / 1000) * 1000) / 60000; };
export default function (ctx) {
  const el = ctx.el;
  let cities = DEFAULT.slice(), shift = 0, timer = null;
  const here = () => ({name: 'Ici', tz: Intl.DateTimeFormat().resolvedOptions().timeZone, here: true});
  const save = () => ctx.storage.set({cities});

  const S = el('style');
  S.textContent = `
    .wc{padding:18px;display:flex;flex-direction:column;gap:14px}
    .wc .top{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
    .wc input[type=text]{flex:1;min-width:160px;font:15px var(--text,sans-serif);padding:8px 10px;background:color-mix(in srgb,var(--bg0,#0b031c) 70%,#000);color:#fff;border:2px solid var(--line2,#3a2a6e);outline:0}
    .wc .shift{display:flex;gap:10px;align-items:center;background:color-mix(in srgb,var(--line,#2a1d52) 35%,var(--bg0,#0b031c));padding:10px 14px;box-shadow:inset 0 0 0 2px var(--line2,#3a2a6e)}
    .wc .shift input{flex:1;accent-color:var(--magenta,#e01ec8)}
    .wc button{font:11px var(--title,monospace);color:#fff;border:0;padding:8px 12px;cursor:pointer;background:color-mix(in srgb,var(--violet,#8a5cf0) 70%,#000)}
    .wc .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
    .wc .city{position:relative;background:color-mix(in srgb,var(--line,#2a1d52) 35%,var(--bg0,#0b031c));padding:14px;box-shadow:inset 0 0 0 2px var(--line2,#3a2a6e)}
    .wc .city .name{font:11px var(--title,monospace);color:var(--lilac,#d9c6ff)}
    .wc .city .time{font:28px var(--title,monospace);color:#fff;margin:6px 0}
    .wc .city .d{color:var(--muted,#8f7bb8);font-size:13px}
    .wc .city .x{position:absolute;top:8px;right:8px;border:0;background:none;color:var(--muted,#8f7bb8);cursor:pointer;padding:2px 6px}`;
  const add = el('input'); add.type = 'text'; add.placeholder = 'Ajouter une ville… (Entrée)';
  const shiftIn = el('input'); shiftIn.type = 'range'; shiftIn.min = '-24'; shiftIn.max = '24'; shiftIn.value = '0';
  const shiftVal = el('b'), nowBtn = el('button', '', 'MAINTENANT');
  const top = el('div', 'top'); top.append(add);
  const shiftBox = el('div', 'shift'); shiftBox.append(el('span', '', 'Décaler de'), shiftIn, shiftVal, nowBtn);
  const grid = el('div', 'grid');
  const wrap = el('div', 'wc'); wrap.append(top, shiftBox, grid);
  ctx.view.append(S, wrap);

  function render() {
    const list = [here(), ...cities], d = new Date(Date.now() + shift * 3600e3), h0 = offset(list[0].tz, d);
    shiftVal.textContent = shift ? (shift > 0 ? 'dans ' : 'il y a ') + Math.abs(shift) + ' h' : 'maintenant';
    grid.replaceChildren(...list.map((c, i) => {
      const card = el('div', 'city'), diff = (offset(c.tz, d) - h0) / 60;
      card.append(el('div', 'name', c.name),
        el('div', 'time', d.toLocaleTimeString('fr-FR', {timeZone: c.tz, hour: '2-digit', minute: '2-digit', second: '2-digit'})),
        el('div', 'd', d.toLocaleDateString('fr-FR', {timeZone: c.tz, weekday: 'long', day: 'numeric', month: 'long'}) + (c.here ? '' : ' · ' + (diff === 0 ? 'même heure' : (diff > 0 ? '+' : '') + String(diff).replace('.', ',') + ' h'))));
      if (!c.here) { const x = el('button', 'x', '✕'); x.onclick = () => { cities.splice(i - 1, 1); save(); render(); }; card.append(x); }
      return card;
    }));
  }
  function tick() { clearTimeout(timer); render(); timer = setTimeout(tick, 1000); }
  add.onkeydown = async e => {
    if (e.key !== 'Enter' || !add.value.trim()) return;
    try {
      const r = JSON.parse((await ctx.net('https://geocoding-api.open-meteo.com/v1/search?count=1&language=fr&name=' + encodeURIComponent(add.value.trim()))).body).results?.[0];
      if (!r?.timezone) return ctx.ui.toast('Ville introuvable', true);
      add.value = ''; cities.push({name: r.name, tz: r.timezone}); save(); render();
    } catch (err) { ctx.ui.toast('Recherche impossible : ' + err.message, true); }
  };
  shiftIn.oninput = () => { shift = +shiftIn.value; render(); };
  nowBtn.onclick = () => { shift = 0; shiftIn.value = '0'; render(); };
  ctx.onOpen(async () => { const d = await ctx.storage.get(); if (d && d.cities?.length) cities = d.cities; tick(); });
  ctx.onClose(() => clearTimeout(timer));
}
