// Lekla Stûdyo: uzaktan Kurmancî ses kaydı (SPEC 6.3).
// Akış: bağlantı anahtarı → tanıtım → izin → mikrofon denemesi → oturumlar → kayıt.
// Her onaylanan kayıt hemen yüklenir; yükleme kuyruğu IndexedDB'de (ağ giderse kayıp yok).
import {
  parseKey, sha256Hex, normalizeText, concatChunks, encodeWav, analyze, warnings,
  encodeProgress, decodeProgress, mergeDone, nextVersion, takeName, sessionStats,
  firstPending, fmtMinutes, visibleSessions,
} from './core.js';
import { FIREBASE, FIREBASE_SDK, SPEAKERS, DEMO_KEY, CONSENT_VERSION, CONTACT } from './config.js';

// ---------------------------------------------------------------- metinler
const T = {
  loading: ['Tê barkirin…', 'Yükleniyor…'],
  badLink: ['Ev girêdan ne derbasdar e.', 'Bu bağlantı geçersiz.'],
  badLinkMore: ['Girêdana ku ji te re hatiye şandin bi tevahî veke.', 'Sana gönderilen bağlantıyı eksiksiz aç.'],
  demo: ['Mîna ceribandinê: tiştek nayê şandin.', 'Deneme modu: hiçbir şey gönderilmez.'],
  welcomeTitle: ['Silav, bi xêr hatî!', 'Merhaba, hoş geldin!'],
  welcome1: ['Gelek spas ku tu alîkariyê dikî.', 'Yardım ettiğin için çok teşekkürler.'],
  welcome2: ['Em ji bo zarokan sepanekê çêdikin: Lekla. Leqleqa Lekla zimanê me yê dayikê, Kurmancî, digihîne hemû zarokên ku dixwazin zimanê xwe fêr bibin an jî wî ji bîr dikin, li kîderê bin jî.',
    'Çocuklar için bir uygulama yapıyoruz: Lekla. Leylek Lekla, anadilimiz Kurmancîyi nerede yaşarsa yaşasın, dilini öğrenmek isteyen ya da unutmaya başlamış her çocuğa ulaştırıyor.'],
  welcome3: ['Ji bo vê dengekî rastîn û xweş divê: dengê te.', 'Bunun için gerçek, güzel bir ses lazım: senin sesin.'],
  welcome4: ['Eger tu bixwazî, ev tomar dikarin bibin beşek ji pirtûkxaneyeke dengan a vekirî ya Kurmancî jî. Îro tune ye; em dikarin bi hev re çêkin.',
    'İstersen bu kayıtlar açık bir Kurmancî ses kütüphanesinin de parçası olabilir. Bugün yok; birlikte yapabiliriz.'],
  howTitle: ['Çawa dixebite?', 'Nasıl çalışır?'],
  how1: ['Li ser ekranê nivîsek derdikeve.', 'Ekranda bir yazı çıkar.'],
  how2: ['● bitikîne, nivîsê bêje, paşê ■ bitikîne.', '●\'ya bas, yazıyı söyle, sonra ■\'ya bas.'],
  how3: ['Guhdarî bike: baş e? ✓. Na? ↺ dîsa.', 'Dinle: iyi mi? ✓. Değil mi? ↺ tekrar.'],
  how4: ['Her tomar yekser tê şandin. Kengî bixwazî rawestî; paşê ji cihê xwe didomînî.',
    'Her kayıt hemen gönderilir. İstediğin an bırak; sonra kaldığın yerden devam edersin.'],
  tipsTitle: ['Tomareke baş', 'İyi bir kayıt için'],
  good1: ['Odeyeke bêdeng; derî û pencere girtî.', 'Sessiz bir oda; kapı ve pencere kapalı.'],
  good2: ['Telefon 20 cm dûr, li hember devê te.', 'Telefon 20 cm uzakta, ağzının karşısında.'],
  good3: ['Hêdî, zelal û bi germî, wek ku tu bi zarokekî re diaxivî.', 'Yavaş, net ve sıcak; bir çocukla konuşur gibi.'],
  bad1: ['Guhlêk tune: bi mîkrofona telefonê bixwe tomar bike.', 'Kulaklık yok: telefonun kendi mikrofonuyla kaydet.'],
  bad2: ['TV, muzîk, makîneya cilan… hemû girtî.', 'TV, müzik, çamaşır makinesi… hepsi kapalı.'],
  bad3: ['Ne bi pistepist, ne bi qîrîn.', 'Ne fısıltı, ne bağırma.'],
  bad4: ['Dema tomarê dest nede telefonê.', 'Kayıt sırasında telefona dokunma.'],
  next: ['Pêşde', 'İleri'],
  back: ['Vegere', 'Geri'],
  consentTitle: ['Destûra dengê te', 'Ses kullanım izni'],
  consentATitle: ['A. Ji bo sepanên OneHelsing (mecbûr e)', 'A. OneHelsing uygulamaları için (zorunlu)'],
  consentA: ['Ez razî me ku dengê min ê di vê stûdyoyê de tê tomarkirin, di sepanên OneHelsing de (wek Lekla) û di danasîna wan de, bê sînorê demê û li seranserê cîhanê, were bikaranîn.',
    'Bu stüdyoda kaydedilen sesimin OneHelsing uygulamalarında (Lekla gibi) ve tanıtımlarında, süre sınırı olmadan ve dünya çapında kullanılmasına izin veriyorum.'],
  consentBTitle: ['B. Pirtûkxaneya dengan a vekirî (ne mecbûr e)', 'B. Açık ses kütüphanesi (isteğe bağlı)'],
  consentB: ['Ez razî me ku tomarên min bibin beşek ji pirtûkxaneyeke dengan a vekirî ya Kurmancî, ku kesên din jî dikarin bi kar bînin, herwiha ji bo perwerdekirina dengên komputerê yên bi zekaya çêkirî (AI). Lîsans paşê tê hilbijartin: dibe ku tenê ji bo karên ne-bazirganî be; ji bo karê bazirganî destûreke cuda divê.',
    'Kayıtlarımın, başkalarının da kullanabileceği açık bir Kurmancî ses kütüphanesine girmesine ve yapay zekâ seslerinin eğitiminde kullanılmasına izin veriyorum. Lisans sonra seçilecek: büyük olasılıkla yalnızca ticari olmayan kullanım; ticari kullanım ayrı izinle.'],
  consentBWarn: ['Bizanibe: dengekî AI yê ku bi tomarên te hatibe perwerdekirin, dikare tiştên ku te qet negotine bi dengekî mîna yê te bêje. Dengên AI her gav nayên naskirin ku AI ne.',
    'Bil ki: senin kayıtlarınla eğitilmiş bir yapay zekâ sesi, hiç söylemediğin şeyleri sana benzeyen bir sesle söyleyebilir. Yapay zekâ sesleri her zaman yapay zekâ oldukları anlaşılacak biçimde ayırt edilemez.'],
  consentRevoke: ['Tu dikarî razîbûna B kengî bixwazî paşde bigirî: wê demê dengê te nakeve weşanên nû, lê weşanên berê û kopiyên ku berê hatine daxistin wek xwe dimînin.',
    'B iznini istediğin zaman geri alabilirsin: o zaman sesin yeni yayınlara girmez; ama önceki yayınlar ve daha önce indirilmiş kopyalar olduğu gibi kalır.'],
  consentPrivacy: ['Di pelên dengan de navê te tune: tu bi navekî veşartî tê nasîn. Navê te yê rastîn tenê di vê belgeya razîbûnê de dimîne û nakeve tu pirtûkxaneyê.',
    'Ses dosyalarında adın yok: bir takma adla anılırsın. Gerçek adın yalnızca bu izin kaydında kalır ve hiçbir kütüphaneye girmez.'],
  consentContact: ['Pirs: ', 'Soru: '],
  agreeA: ['A: Min xwend û ez razî me.', 'A: Okudum, izin veriyorum.'],
  agreeB: ['B: Ji bo pirtûkxaneya vekirî û dengên AI jî ez razî me.', 'B: Açık kütüphane ve yapay zekâ sesleri için de izin veriyorum.'],
  profileTitle: ['Tu kî yî?', 'Seni tanıyalım'],
  ageBand: ['Temen', 'Yaş'],
  ageAdult: ['Mezin (18 salî an mezintir)', 'Yetişkin (18 ve üstü)'],
  ageChild: ['Zarok (ji 18 salî biçûktir)', 'Çocuk (18 yaş altı)'],
  dialect: ['Devok an herêm (ne mecbûr e; nayê weşandin)', 'Ağız ya da bölge (isteğe bağlı; yayımlanmaz)'],
  guardianName: ['Navê dê, bav an serperiştê', 'Annenin, babanın ya da velinin adı soyadı'],
  guardianAgree: ['Ez dê, bav an serperiştê vî zarokî me û ji bo A razî me.', 'Bu çocuğun annesi, babası ya da velisiyim ve A için izin veriyorum.'],
  childNote: ['Zarok tenê gotinên kurt ên Lekla tomar dikin; ev tomar nakevin pirtûkxaneya vekirî.', 'Çocuklar yalnızca Lekla\'nın kısa sözlerini kaydeder; bu kayıtlar açık kütüphaneye girmez.'],
  tracksTitle: ['Tu dixwazî çi tomar bikî?', 'Neyi kaydetmek istiyorsun?'],
  trackApp: ['Dengê Lekla: dengên tîpan, peyv û gotinên ji bo zarokan (≈1 saet)', 'Lekla\'nın sesi: harf sesleri, kelimeler ve çocuğa sözler (≈1 saat)'],
  trackTts: ['Hevokên xwezayî ji bo pirtûkxaneya dengan û dengê AI (≈5 saet, beş bi beş; tenê bi B)', 'Ses kütüphanesi ve yapay zekâ sesi için doğal cümleler (≈5 saat, parça parça; yalnızca B ile)'],
  creditPseudo: ['Di lîsteya spasiyê de bi navê min ê veşartî derkevim:', 'Teşekkür listesinde takma adımla anılayım:'],
  fullName: ['Nav û paşnavê te (tenê ji bo belgeya razîbûnê)', 'Adın ve soyadın (yalnızca izin kaydı için)'],
  optional: ['(ne mecbûr e)', '(isteğe bağlı)'],
  gender: ['Zayend (ji bo dengê AI alîkar e; ne mecbûr e)', 'Cinsiyet (yapay zekâ sesi için yararlı; isteğe bağlı)'],
  gF: ['Jin', 'Kadın'], gM: ['Mêr', 'Erkek'], gX: ['Nabêjim', 'Belirtmek istemiyorum'],
  accept: ['Pêşde', 'İleri'],
  ttsNeedsB: ['Ev beş tenê bi razîbûna B û hilbijartina "hevokên xwezayî" vedibin.', 'Bu oturumlar yalnızca B izni ve "doğal cümleler" seçimiyle açılır.'],
  changeConsent: ['Profîl û razîbûnê biguherîne', 'Profili ve izni değiştir'],
  micTitle: ['Mîkrofon', 'Mikrofon'],
  micAsk: ['Gava tu bitikînî, telefon destûra mîkrofonê dixwaze: "Destûr bide" bibêje.', 'Dokununca telefon mikrofon izni ister: "İzin ver" de.'],
  micStart: ['Mîkrofonê veke', 'Mikrofonu aç'],
  micFail: ['Mîkrofon venebû. Destûrê bide an gerokek din biceribîne (Safari / Chrome).', 'Mikrofon açılamadı. İzin ver ya da başka bir tarayıcı dene (Safari / Chrome).'],
  micTest: ['Biaxive: xet divê kesk bilivin, lê negihîje dawiyê.', 'Konuş: çubuk yeşil oynamalı ama sona dayanmamalı.'],
  micOk: ['Mîkrofon amade ye', 'Mikrofon hazır'],
  sessionsTitle: ['Beş', 'Oturumlar'],
  groupApp: ['Ji bo Lekla — pêşî ev', 'Lekla için — önce bunlar'],
  groupTts: ['Ji bo dengê komputerê — paşê', 'Bilgisayar sesi için — sonra'],
  groupTtsNote: ['Hevokên dirêjtir. Dema te hebe, hêdî hêdî.', 'Daha uzun cümleler. Vaktin oldukça, yavaş yavaş.'],
  groupLater: ['Paşê', 'Sonra'],
  items: ['tomar', 'kayıt'],
  min: ['deq', 'dk'],
  doneBadge: ['Qediya', 'Bitti'],
  rec: ['Tomar bike', 'Kaydet'],
  stop: ['Rawestîne', 'Durdur'],
  play: ['Guhdarî', 'Dinle'],
  retake: ['Dîsa', 'Tekrar'],
  approve: ['Baş e, pêşde', 'İyi, ileri'],
  skip: ['Derbas bike', 'Atla'],
  list: ['Lîste', 'Liste'],
  note: ['Têbînî: li cem we cuda tê gotin?', 'Not: sizde farklı mı söyleniyor?'],
  hintTitle: ['Çawa bêjim?', 'Nasıl söyleyeyim?'],
  examples: ['Mînak', 'Örnek'],
  reviewFlag: ['Ev peyv hê nehatiye kontrolkirin; eger li cem we cuda ye, têbînî binivîse.', 'Bu kelime henüz onaylanmadı; sizde farklıysa nota yaz.'],
  recording: ['Tê tomarkirin… biaxive', 'Kaydediliyor… konuş'],
  listenFirst: ['Guhdarî bike, paşê biryar bide.', 'Dinle, sonra karar ver.'],
  allGood: ['Xweş e!', 'Güzel!'],
  sessionDone: ['Ev beş qediya!', 'Bu oturum bitti!'],
  finish: ['Biqedîne û bişîne', 'Bitir ve gönder'],
  sent: ['Hat şandin. Gelek spas!', 'Gönderildi. Çok teşekkürler!'],
  toSessions: ['Vegere beşan', 'Oturumlara dön'],
  pending: ['li bendê', 'bekliyor'],
  uploaded: ['hemû hat şandin', 'hepsi gönderildi'],
  upErr: ['Şandin nebû; ez ê dîsa biceribînim. Tomar winda nabin.', 'Gönderilemedi; tekrar denenecek. Kayıtlar kaybolmaz.'],
  offline: ['Înternet tune; tomar li vir tên parastin.', 'İnternet yok; kayıtlar burada saklanıyor.'],
  you: ['Tu', 'Sen'],
  allDone: ['Hemû beş qediyan. Tu stêrk î!', 'Bütün oturumlar bitti. Harikasın!'],
  autoplay: ['Piştî tomarê bixweber lê bide', 'Kayıttan sonra kendiliğinden çal'],
  keys: ['Klavye: Space = tomar/rawestîne · Enter = baş e · R = dîsa · P = guhdarî', 'Klavye: Boşluk = kaydet/durdur · Enter = iyi · R = tekrar · P = dinle'],
  W_clip: ['Deng pir bilind e û xirab bû; hinekî dûr bikeve.', 'Ses çok yüksek, bozuldu; biraz uzaklaş.'],
  W_quiet: ['Deng pir nizm e; nêzîk bibe an bilindtir bêje.', 'Ses çok kısık; yaklaş ya da biraz daha yüksek söyle.'],
  W_nospeech: ['Deng nehat bihîstin.', 'Konuşma duyulmadı.'],
  W_cutstart: ['Destpêk qut bûye: piştî ● hinekî bisekine, paşê bêje.', 'Baş kesilmiş: ●\'dan sonra bir an bekle, sonra söyle.'],
  W_cutend: ['Dawî qut bûye: piştî gotinê hinekî bisekine, paşê ■.', 'Son kesilmiş: söyledikten sonra bir an bekle, sonra ■.'],
  W_noisy: ['Li dora te deng heye; cihekî bêdengtir?', 'Ortam gürültülü; daha sessiz bir yer?'],
};

// ---------------------------------------------------------------- DOM yardımcıları
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}
const pair = (key, cls = 'pair', tag = 'span') => {
  const [k, t] = Array.isArray(key) ? key : T[key];
  return h(tag, { class: cls }, h('span', { class: 'k', lang: 'ku' }, k), h('span', { class: 't', lang: 'tr' }, t));
};
const app = () => document.getElementById('app');
function show(...nodes) {
  const root = app();
  root.replaceChildren(h('div', { class: 'screen' }, ...nodes));
  window.scrollTo(0, 0);
}
const LOGO = () => h('div', {
  class: 'brand',
  html: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="currentColor"/><circle cx="32" cy="28" r="11" fill="#fff"/><rect x="28" y="38" width="8" height="12" rx="4" fill="#fff"/><path d="M20 30a12 12 0 0 0 24 0" stroke="#fff" stroke-width="3" fill="none"/></svg><span>Lekla Stûdyo</span>',
});

// ---------------------------------------------------------------- durum
const S = {
  key: null, keyHash: null, speaker: null, demo: false, script: null,
  state: { name: '', consent: null, done: {}, skipped: {}, notes: {}, autoplay: true },
  storage: null, fb: null,
};
const stateKey = () => `lekla-deng:${S.keyHash}`;
function loadState() {
  try {
    const raw = localStorage.getItem(stateKey());
    if (raw) S.state = { ...S.state, ...JSON.parse(raw) };
  } catch { /* özel pencere: yalnızca bellekte */ }
}
function saveState() {
  try { localStorage.setItem(stateKey(), JSON.stringify(S.state)); } catch { /* yok say */ }
}

// ---------------------------------------------------------------- IndexedDB kuyruğu
const DB_NAME = 'lekla-deng';
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('queue', { keyPath: 'path' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function qTx(mode, fn) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction('queue', mode);
    const out = fn(tx.objectStore('queue'));
    tx.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    tx.onerror = () => rej(tx.error);
  });
}
const memQueue = new Map(); // IndexedDB yoksa (özel pencere) yedek
async function qPut(job) {
  try { await qTx('readwrite', (s) => s.put(job)); } catch { memQueue.set(job.path, job); }
}
async function qDel(path) {
  memQueue.delete(path);
  try { await qTx('readwrite', (s) => s.delete(path)); } catch { /* yok say */ }
}
async function qAll() {
  let rows = [];
  try { rows = (await qTx('readonly', (s) => s.getAll())) || []; } catch { /* yok say */ }
  const mine = rows.filter((r) => r.owner === S.keyHash);
  return [...mine, ...[...memQueue.values()].filter((r) => !mine.some((m) => m.path === r.path))];
}

// ---------------------------------------------------------------- yükleme
const up = { busy: false, pending: 0, error: false, listeners: new Set(), progressDirty: false };
const notifyUp = () => up.listeners.forEach((f) => f());
async function firebase() {
  if (S.fb) return S.fb;
  const appMod = await import(`${FIREBASE_SDK}/firebase-app.js`);
  const st = await import(`${FIREBASE_SDK}/firebase-storage.js`);
  const fbApp = appMod.initializeApp(FIREBASE);
  S.fb = { st, storage: st.getStorage(fbApp) };
  return S.fb;
}
const path = (file) => `takes/${S.key}/${file}`;

async function putObject(file, bytes, contentType, customMetadata) {
  if (S.demo) {
    await new Promise((r) => setTimeout(r, 250));
    return;
  }
  const { st, storage } = await firebase();
  await st.uploadBytes(st.ref(storage, path(file)), bytes, { contentType, customMetadata });
}

async function enqueue(file, bytes, contentType, meta) {
  await qPut({ path: file, owner: S.keyHash, bytes, contentType, meta, at: Date.now() });
  pump();
}

let backoff = 2000;
async function pump() {
  if (up.busy) return;
  up.busy = true;
  try {
    for (;;) {
      const jobs = (await qAll()).sort((a, b) => a.at - b.at);
      up.pending = jobs.length;
      notifyUp();
      if (!jobs.length) break;
      if (!navigator.onLine) { up.error = 'offline'; notifyUp(); break; }
      const job = jobs[0];
      try {
        await putObject(job.path, new Uint8Array(job.bytes), job.contentType, job.meta);
        await qDel(job.path);
        up.error = false;
        backoff = 2000;
        if (job.path.endsWith('.wav')) up.progressDirty = true;
      } catch (e) {
        console.warn('upload', job.path, e && e.code, e);
        up.error = 'err';
        notifyUp();
        setTimeout(pump, backoff);
        backoff = Math.min(backoff * 2, 60000);
        break;
      }
    }
    if (up.progressDirty && !up.error) await syncProgress();
  } finally {
    up.busy = false;
    notifyUp();
  }
}
window.addEventListener('online', () => { up.error = false; pump(); });

async function syncProgress() {
  up.progressDirty = false;
  const body = {
    script: S.script.version, speaker: S.speaker, updatedAt: new Date().toISOString(),
    done: S.state.done, skipped: S.state.skipped,
  };
  try {
    await putObject('_progress.json', new TextEncoder().encode(JSON.stringify(body)), 'application/json',
      { p: encodeProgress(S.script, S.state.done) });
  } catch (e) {
    up.progressDirty = true;
    console.warn('progress', e);
  }
}

async function fetchServerProgress() {
  if (S.demo) return {};
  try {
    const { st, storage } = await firebase();
    const md = await st.getMetadata(st.ref(storage, path('_progress.json')));
    return decodeProgress(S.script, md.customMetadata && md.customMetadata.p);
  } catch (e) {
    if (!(e && e.code === 'storage/object-not-found')) console.warn('progress get', e);
    return {};
  }
}

function upStatus() {
  const el = h('div', { class: 'upq' });
  const render = () => {
    el.classList.toggle('err', !!up.error);
    el.replaceChildren(
      up.error === 'offline' ? pair('offline', 'inline')
        : up.error ? pair('upErr', 'inline')
          : up.pending ? pair([`↑ ${up.pending} ${T.pending[0]}`, `${up.pending} ${T.pending[1]}`], 'inline')
            : pair([`✓ ${T.uploaded[0]}`, T.uploaded[1]], 'inline'),
    );
  };
  render();
  up.listeners.add(render);
  return el;
}

// ---------------------------------------------------------------- kayıt
const R = {
  ctx: null, stream: null, node: null, recording: false, chunks: [], level: 0, peakHold: 0,
  settings: null, listeners: new Set(), startedAt: 0,
};
async function initMic() {
  if (R.ctx) { await R.ctx.resume(); return; }
  R.stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false, noiseSuppression: false, autoGainControl: false,
      channelCount: 1, sampleSize: 24,
    },
  });
  const track = R.stream.getAudioTracks()[0];
  R.settings = track.getSettings ? track.getSettings() : {};
  const Ctx = window.AudioContext || window.webkitAudioContext;
  R.ctx = new Ctx({ latencyHint: 'interactive' });
  await R.ctx.resume();
  const src = R.ctx.createMediaStreamSource(R.stream);
  const sink = R.ctx.createGain();
  sink.gain.value = 0;
  sink.connect(R.ctx.destination);
  const onChunk = (buf) => {
    let pk = 0;
    for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > pk) pk = a; }
    R.level = pk;
    if (R.recording) R.chunks.push(buf);
    R.listeners.forEach((f) => f(pk));
  };
  try {
    await R.ctx.audioWorklet.addModule('rec-worklet.js');
    R.node = new AudioWorkletNode(R.ctx, 'rec-processor', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
    R.node.port.onmessage = (e) => onChunk(e.data);
  } catch (e) {
    console.warn('AudioWorklet yok, ScriptProcessor', e);
    R.node = R.ctx.createScriptProcessor(4096, 1, 1);
    R.node.onaudioprocess = (e) => onChunk(new Float32Array(e.inputBuffer.getChannelData(0)));
  }
  src.connect(R.node);
  R.node.connect(sink);
}
function startRec() {
  R.chunks = [];
  R.recording = true;
  R.startedAt = performance.now();
}
function stopRec() {
  R.recording = false;
  // Son paket gelsin diye çağıran ~120 ms bekler.
  return new Promise((res) => setTimeout(() => res(concatChunks(R.chunks)), 120));
}
let player = null;
function play(samples, rate, onEnd) {
  stopPlay();
  const buf = R.ctx.createBuffer(1, samples.length, rate);
  buf.getChannelData(0).set(samples);
  const src = R.ctx.createBufferSource();
  src.buffer = buf;
  src.connect(R.ctx.destination);
  src.onended = () => { if (player === src) player = null; if (onEnd) onEnd(); };
  src.start();
  player = src;
}
function stopPlay() {
  if (player) { try { player.stop(); } catch { /* yok say */ } player = null; }
}

function meter() {
  const bar = h('i');
  const el = h('div', { class: 'meter', role: 'meter', 'aria-label': 'level' }, bar, h('b', { style: 'left:70%' }));
  const f = (pk) => {
    const dbv = pk > 0 ? 20 * Math.log10(pk) : -90;
    const pct = Math.max(0, Math.min(100, ((dbv + 60) / 60) * 100));
    bar.style.width = `${pct}%`;
    bar.classList.toggle('hot', pk >= 0.98);
  };
  R.listeners.add(f);
  el.detach = () => R.listeners.delete(f);
  return el;
}

let wakeLock = null;
async function keepAwake() {
  try { if ('wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch { /* yok say */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { wakeLock = null; if (R.ctx) keepAwake(); pump(); }
  else if (R.recording) { R.recording = false; R.chunks = []; }
});

// ---------------------------------------------------------------- ekranlar
function screenBadLink() {
  show(h('div', { class: 'center screen' }, LOGO(), h('h1', {}, pair('badLink')), pair('badLinkMore', 'pair muted')));
}

function screenWelcome() {
  show(
    LOGO(),
    S.demo && h('div', { class: 'warn' }, pair('demo')),
    h('h1', {}, pair('welcomeTitle')),
    h('div', { class: 'card' }, pair('welcome1', 'pair', 'p'), pair('welcome2', 'pair', 'p'), pair('welcome3', 'pair', 'p'), pair('welcome4', 'pair', 'p')),
    h('div', { class: 'card' }, h('h2', {}, pair('howTitle')),
      h('ol', { class: 'steps' }, ['how1', 'how2', 'how3', 'how4'].map((k) => h('li', {}, pair(k))))),
    h('div', { class: 'card' }, h('h2', {}, pair('tipsTitle')),
      h('ul', { class: 'tips' },
        ['good1', 'good2', 'good3'].map((k) => h('li', { class: 'good' }, h('span', { class: 'mk' }, '✓'), pair(k))),
        ['bad1', 'bad2', 'bad3', 'bad4'].map((k) => h('li', { class: 'bad' }, h('span', { class: 'mk' }, '✗'), pair(k))))),
    h('button', { class: 'primary', onclick: () => (S.state.consent ? screenMic() : screenConsent()) }, pair('next')),
  );
}

function screenConsent() {
  const prev = S.state.consent || {};
  const radio = (name, value, label) => {
    const r = h('input', { type: 'radio', name, value });
    r.checked = prev.ageBand === value;
    return h('label', { class: 'check' }, r, pair(label));
  };
  const name = h('input', { type: 'text', autocomplete: 'name', value: S.state.name || '' });
  const ageAdult = radio('age', 'adult', 'ageAdult');
  const ageChild = radio('age', 'child', 'ageChild');
  const isChild = () => ageChild.querySelector('input').checked;
  const isAdult = () => ageAdult.querySelector('input').checked;
  const gender = h('select', {}, h('option', { value: '' }, '—'),
    h('option', { value: 'f' }, `${T.gF[0]} / ${T.gF[1]}`), h('option', { value: 'm' }, `${T.gM[0]} / ${T.gM[1]}`),
    h('option', { value: 'x' }, `${T.gX[0]} / ${T.gX[1]}`));
  gender.value = prev.gender || '';
  const dialect = h('input', { type: 'text', value: prev.dialect || '' });
  const gName = h('input', { type: 'text', value: (prev.guardian && prev.guardian.name) || '' });
  const gAgree = h('input', { type: 'checkbox' });
  gAgree.checked = !!(prev.guardian && prev.guardian.agreed);
  const agreeA = h('input', { type: 'checkbox' });
  const agreeB = h('input', { type: 'checkbox' });
  const credit = h('input', { type: 'checkbox' });
  const trackApp = h('input', { type: 'checkbox' });
  const trackTts = h('input', { type: 'checkbox' });
  agreeA.checked = !!prev.apps;
  agreeB.checked = !!prev.openDataset;
  credit.checked = !!prev.creditPseudonym;
  trackApp.checked = prev.tracks ? prev.tracks.includes('app') : true;
  trackTts.checked = !!(prev.tracks && prev.tracks.includes('tts'));

  const guardianBox = h('div', { class: 'stack' }, pair('childNote', 'pair warn'),
    h('label', { class: 'field' }, pair('guardianName'), gName), h('label', { class: 'check' }, gAgree, pair('guardianAgree')));
  const bBox = h('div', { class: 'stack' },
    h('label', { class: 'check' }, agreeB, h('span', {}, pair('agreeB'), pair('optional', 'pair muted'))),
    h('label', { class: 'check' }, credit, h('span', {}, pair([`${T.creditPseudo[0]} ${S.speaker}`, `${T.creditPseudo[1]} ${S.speaker}`]), pair('optional', 'pair muted'))));
  const ttsRow = h('label', { class: 'check' }, trackTts, pair('trackTts'));
  const go = h('button', { class: 'primary', disabled: true, onclick: submit }, pair('accept'));
  const check = () => {
    const child = isChild();
    guardianBox.style.display = child ? '' : 'none';
    bBox.style.display = isAdult() ? '' : 'none';
    if (!isAdult()) { agreeB.checked = false; }
    credit.disabled = !agreeB.checked;
    if (!agreeB.checked) { credit.checked = false; trackTts.checked = false; }
    trackTts.disabled = !agreeB.checked;
    ttsRow.style.display = isAdult() ? '' : 'none';
    const ok = name.value.trim().length >= 2 && agreeA.checked && (isAdult() || (child && gAgree.checked && gName.value.trim().length >= 3))
      && (trackApp.checked || trackTts.checked);
    go.disabled = !ok;
  };
  [ageAdult, ageChild].forEach((l) => l.addEventListener('change', check));
  [name, gName, gAgree, agreeA, agreeB, trackApp, trackTts].forEach((el) => { el.addEventListener('input', check); el.addEventListener('change', check); });
  check();

  async function submit() {
    go.disabled = true;
    const child = isChild();
    const consent = buildConsent({
      name: name.value.trim(), ageBand: child ? 'child' : 'adult',
      guardian: child ? { name: gName.value.trim(), agreed: gAgree.checked } : null,
      gender: gender.value || null, dialect: dialect.value.trim() || null,
      apps: agreeA.checked, openDataset: !child && agreeB.checked, creditPseudonym: !child && agreeB.checked && credit.checked,
      tracks: [trackApp.checked && 'app', !child && agreeB.checked && trackTts.checked && 'tts'].filter(Boolean),
    });
    S.state.name = consent.name;
    S.state.consent = consent;
    saveState();
    // Her değişiklik ayrı dosya: önceki izin kaydı sunucuda kalır (geri alma izi).
    await enqueue(`_consent_${Date.now()}.json`, new TextEncoder().encode(JSON.stringify(consent, null, 1)), 'application/json', {});
    screenMic();
  }

  const block = (lang, i, cls) => h('div', { lang, class: cls },
    h('h2', {}, T.consentATitle[i]), h('p', {}, T.consentA[i]),
    h('h2', {}, T.consentBTitle[i]), h('p', {}, T.consentB[i]),
    h('p', { class: 'warn' }, T.consentBWarn[i]), h('p', {}, T.consentRevoke[i]), h('p', {}, T.consentPrivacy[i]));
  show(
    LOGO(),
    h('h1', {}, pair('consentTitle')),
    h('div', { class: 'card' }, h('h2', {}, pair('profileTitle')),
      h('label', { class: 'field' }, pair('fullName'), name),
      h('div', { class: 'field' }, pair('ageBand'), ageAdult, ageChild),
      h('label', { class: 'field' }, pair('gender'), gender),
      h('label', { class: 'field' }, pair('dialect'), dialect),
      guardianBox),
    h('div', { class: 'card consent-text' }, block('ku', 0, 'stack'), h('hr'), block('tr', 1, 'stack muted'),
      h('p', { class: 'muted' }, `${T.consentContact[0]}/${T.consentContact[1]}`, h('a', { href: `mailto:${CONTACT}` }, CONTACT))),
    h('div', { class: 'card' },
      h('label', { class: 'check' }, agreeA, pair('agreeA')),
      bBox),
    h('div', { class: 'card' }, h('h2', {}, pair('tracksTitle')),
      h('label', { class: 'check' }, trackApp, pair('trackApp')),
      ttsRow),
    h('div', { class: 'row' }, h('button', { class: 'ghost', onclick: screenWelcome }, pair('back')), go),
  );
}

/**
 * İzin + profil kaydı. Gerçek ad (ve velinin adı) yalnızca burada; ses dosyalarında
 * ve veri kümesinde yalnızca takma ad (speaker). Ağız/bölge varsayılan olarak dışa aktarılmaz.
 * Çocuk (18 altı): veli onayı zorunlu, B (açık veri kümesi) her zaman false.
 */
function buildConsent(o) {
  const txt = (i) => [T.consentATitle, T.consentA, T.consentBTitle, T.consentB, T.consentBWarn, T.consentRevoke, T.consentPrivacy]
    .map((x) => x[i]).join('\n');
  const child = o.ageBand === 'child';
  return {
    version: CONSENT_VERSION,
    speaker: S.speaker,
    name: o.name,
    ageBand: child ? 'child' : 'adult',
    minor: child,
    guardian: child ? o.guardian : null,
    gender: o.gender,
    dialect: o.dialect,
    agreedAt: new Date().toISOString(),
    apps: !!o.apps, // A: OneHelsing uygulamaları + tanıtım, süresiz, dünya çapında (zorunlu)
    openDataset: !child && !!o.openDataset, // B: açık veri kümesi + yapay zekâ sesi (isteğe bağlı; gelecek yayınlar için geri alınabilir)
    creditPseudonym: !child && !!o.creditPseudonym,
    tracks: o.tracks,
    text: { ku: txt(0), tr: txt(1) },
    userAgent: navigator.userAgent,
  };
}

function screenMic() {
  const status = h('div', { class: 'status' });
  const m = meter();
  const go = h('button', { class: 'primary', disabled: !R.ctx, onclick: () => { m.detach(); screenSessions(); } }, pair('next'));
  const start = h('button', {
    class: R.ctx ? 'ghost' : 'primary',
    onclick: async () => {
      try {
        await initMic();
        status.replaceChildren(pair([`✓ ${T.micOk[0]} · ${R.ctx.sampleRate} Hz`, T.micOk[1]], 'inline'));
        go.disabled = false;
        go.focus();
      } catch (e) {
        console.warn(e);
        status.replaceChildren(h('div', { class: 'warn bad' }, pair('micFail')));
      }
    },
  }, pair('micStart'));
  show(
    LOGO(),
    whoAmI(),
    h('h1', {}, pair('micTitle')),
    h('div', { class: 'card' }, pair('micAsk', 'pair', 'p'), start, m, pair('micTest', 'pair muted', 'p'), status),
    h('div', { class: 'row' }, h('button', { class: 'ghost', onclick: () => { m.detach(); screenWelcome(); } }, pair('back')), go),
  );
}

function whoAmI() {
  if (!S.state.name) return null;
  return h('div', { class: 'muted' }, `${T.you[0]} / ${T.you[1]}: `, h('b', {}, S.state.name), ' · ',
    h('a', { href: '#', onclick: (e) => { e.preventDefault(); screenConsent(); } }, `${T.changeConsent[0]} / ${T.changeConsent[1]}`));
}

function sessionButton(s) {
  const st = sessionStats(s, S.state.done, S.state.skipped);
  const pct = Math.round(((st.ok + st.skip) / st.total) * 100);
  return h('button', { class: 'session', onclick: () => screenRecord(s) },
    pair([s.kmr, s.tr]),
    st.complete ? h('span', { class: 'badge done' }, `✓ ${T.doneBadge[0]}`) : h('span', { class: 'badge' }, `${pct}%`),
    h('div', { class: 'bar' }, h('i', { style: `width:${pct}%` })),
    h('div', { class: 'meta' }, h('span', {}, `${st.ok}/${st.total} ${T.items[0]} · ${T.items[1]}`), h('span', {}, `≈ ${fmtMinutes(s.estMin)}`)));
}

function screenSessions() {
  keepAwake();
  const { app, tts, ttsLocked } = visibleSessions(S.script, S.state.consent);
  const all = [...app, ...tts].every((s) => sessionStats(s, S.state.done, S.state.skipped).complete);
  const minor = !!(S.state.consent && S.state.consent.minor);
  show(
    LOGO(),
    whoAmI(),
    S.demo && h('div', { class: 'warn' }, pair('demo')),
    all && h('div', { class: 'card' }, h('h2', {}, pair('allDone'))),
    minor && pair('childNote', 'pair warn', 'p'),
    app.length && h('h2', { class: 'group-title' }, pair('groupApp')),
    app.map(sessionButton),
    !minor && h('h2', { class: 'group-title' }, pair('groupTts')),
    !minor && pair('groupTtsNote', 'pair muted', 'p'),
    tts.map(sessionButton),
    !minor && ttsLocked && h('div', { class: 'card' }, pair('ttsNeedsB'), h('button', { class: 'ghost', onclick: screenConsent }, pair('changeConsent'))),
    (S.script.later || []).length && h('h2', { class: 'group-title' }, pair('groupLater')),
    (S.script.later || []).map((l) => h('div', { class: 'card muted' }, pair([l.kmr, l.tr]))),
    upStatus(),
  );
}

function screenRecord(session, startIndex) {
  if (!R.ctx) { screenMic(); return; }
  let idx = startIndex ?? firstPending(session, S.state.done, S.state.skipped);
  if (idx < 0) { screenSessionDone(session); return; }
  const isTts = session.group === 'tts';
  let samples = null;
  let analysis = null;
  let mode = 'idle'; // idle | rec | review | playing
  let timer = null;

  const m = meter();
  const say = h('div', { class: 'say', lang: 'ku' });
  const gloss = h('div', { class: 'gloss' });
  const examples = h('div', { class: 'examples' });
  const flag = h('div', { class: 'flag' });
  const hint = h('div', { class: 'hint' });
  const counter = h('div', { class: 'counter' });
  const status = h('div', { class: 'status' });
  const warnBox = h('div', { class: 'warns' });
  const note = h('textarea', { rows: 2, lang: 'ku' });
  const recBtn = h('button', { class: 'primary bigrec', onclick: () => toggleRec() });
  const playBtn = h('button', { class: 'ghost', onclick: () => doPlay() }, pair(['▶ ' + T.play[0], T.play[1]]));
  const retakeBtn = h('button', { class: 'ghost', onclick: () => retake() }, pair(['↺ ' + T.retake[0], T.retake[1]]));
  const okBtn = h('button', { class: 'ok', onclick: () => approve() }, pair(['✓ ' + T.approve[0], T.approve[1]]));
  const skipBtn = h('button', { class: 'ghost', onclick: () => skip() }, pair('skip'));
  const reviewRow = h('div', { class: 'row' }, playBtn, retakeBtn);
  const autoplay = h('input', { type: 'checkbox' });
  autoplay.checked = isTts ? false : S.state.autoplay !== false;
  autoplay.addEventListener('change', () => { if (!isTts) { S.state.autoplay = autoplay.checked; saveState(); } });

  function item() { return session.items[idx]; }
  function renderItem() {
    const it = item();
    say.textContent = it.kmr;
    say.classList.toggle('long', it.kmr.length > 18);
    gloss.textContent = it.tr;
    examples.textContent = it.examples ? `${T.examples[0]} / ${T.examples[1]}: ${it.examples.join(' · ')}` : '';
    flag.replaceChildren(it.review ? pair('reviewFlag', 'pair') : '');
    hint.textContent = it.hint;
    note.value = S.state.notes[it.id] || '';
    const st = sessionStats(session, S.state.done, S.state.skipped);
    counter.textContent = `${idx + 1} / ${session.items.length} · ✓ ${st.ok}` + (S.state.done[it.id] ? ` · v${S.state.done[it.id]} ✓` : '');
    setMode('idle');
  }
  function setMode(next) {
    mode = next;
    recBtn.classList.toggle('recording', mode === 'rec');
    recBtn.replaceChildren(h('span', { class: 'dot' }), pair(mode === 'rec' ? 'stop' : 'rec'));
    recBtn.disabled = mode === 'playing';
    reviewRow.style.display = mode === 'review' || mode === 'playing' ? '' : 'none';
    okBtn.style.display = mode === 'review' || mode === 'playing' ? '' : 'none';
    okBtn.disabled = !samples || (analysis && warnings(analysis).includes('nospeech'));
    skipBtn.style.display = mode === 'idle' ? '' : 'none';
    if (mode !== 'review' && mode !== 'playing') warnBox.replaceChildren();
    if (mode === 'rec') status.replaceChildren(pair('recording', 'inline'));
    else if (mode === 'idle') status.replaceChildren();
  }
  async function toggleRec() {
    if (mode === 'rec') {
      clearTimeout(timer);
      samples = await stopRec();
      analysis = analyze(samples, R.ctx.sampleRate);
      setMode('review');
      const ws = warnings(analysis);
      warnBox.replaceChildren(...ws.map((w) => h('div', { class: `warn ${['clip', 'nospeech'].includes(w) ? 'bad' : ''}` }, pair(`W_${w}`))));
      status.replaceChildren(ws.length ? '' : pair(isTts ? 'allGood' : 'listenFirst', 'inline'));
      if (autoplay.checked && !ws.includes('nospeech')) doPlay();
      okBtn.focus({ preventScroll: true });
    } else if (mode === 'idle' || mode === 'review') {
      stopPlay();
      samples = null;
      analysis = null;
      startRec();
      setMode('rec');
      timer = setTimeout(() => { if (mode === 'rec') toggleRec(); }, 30000);
    }
  }
  function doPlay() {
    if (!samples) return;
    if (mode === 'playing') { stopPlay(); setMode('review'); return; }
    setMode('playing');
    play(samples, R.ctx.sampleRate, () => { if (mode === 'playing') setMode('review'); });
  }
  function retake() { stopPlay(); samples = null; analysis = null; setMode('idle'); }
  function saveNote() {
    const it = item();
    const v = note.value.trim();
    if (v) S.state.notes[it.id] = v; else delete S.state.notes[it.id];
  }
  async function approve() {
    if (!samples) return;
    stopPlay();
    saveNote();
    const it = item();
    const v = nextVersion(S.state.done, it.id);
    const rate = R.ctx.sampleRate;
    const wav = encodeWav(samples, rate, 24);
    const meta = {
      item: it.id, version: String(v), kind: it.kind, session: session.id, script: S.script.version,
      text: it.kmr, textNorm: normalizeText(it.kmr), speaker: S.speaker || '',
      sampleRate: String(rate), bits: '24', channels: '1',
      duration: String(analysis.duration), peakDb: String(analysis.peakDb), floorDb: String(analysis.floorDb),
      trimStart: String(analysis.trimStart), trimEnd: String(analysis.trimEnd),
      warnings: warnings(analysis).join(','), note: S.state.notes[it.id] || '',
      consent: `${CONSENT_VERSION}@${S.state.consent ? S.state.consent.agreedAt : ''}`, recordedAt: new Date().toISOString(),
      input: JSON.stringify(pick(R.settings, ['echoCancellation', 'noiseSuppression', 'autoGainControl', 'sampleRate', 'sampleSize', 'channelCount'])),
      ua: navigator.userAgent.slice(0, 180),
    };
    S.state.done[it.id] = v;
    delete S.state.skipped[it.id];
    saveState();
    await enqueue(takeName(it.id, v), wav.buffer, 'audio/wav', meta);
    samples = null;
    advance();
  }
  function skip() {
    saveNote();
    const it = item();
    if (!S.state.done[it.id]) S.state.skipped[it.id] = true;
    saveState();
    advance();
  }
  function advance() {
    const nextIdx = session.items.findIndex((x, i) => i > idx && !S.state.done[x.id] && !S.state.skipped[x.id]);
    const anyIdx = firstPending(session, S.state.done, S.state.skipped);
    const n = nextIdx >= 0 ? nextIdx : anyIdx;
    if (n < 0) { cleanup(); screenSessionDone(session); return; }
    idx = n;
    renderItem();
  }
  function cleanup() {
    m.detach();
    stopPlay();
    if (R.recording) { R.recording = false; }
    document.removeEventListener('keydown', onKey);
  }
  function openList() {
    const sheet = h('div', { class: 'sheet', onclick: (e) => { if (e.target === sheet) sheet.remove(); } },
      h('div', { class: 'card' }, h('h2', {}, pair([session.kmr, session.tr])),
        h('div', { class: 'grid' }, session.items.map((x, i) => h('button', {
          class: [S.state.done[x.id] ? 'done' : S.state.skipped[x.id] ? 'skip' : '', i === idx ? 'cur' : ''].join(' '),
          onclick: () => { sheet.remove(); if (mode === 'rec') return; idx = i; samples = null; renderItem(); },
        }, x.kmr.length > 14 ? x.kmr.slice(0, 13) + '…' : x.kmr))),
        h('button', { class: 'ghost', onclick: () => sheet.remove() }, pair('back'))));
    document.body.append(sheet);
  }
  function onKey(e) {
    if (e.target && ['TEXTAREA', 'INPUT', 'SELECT'].includes(e.target.tagName)) return;
    if (document.querySelector('.sheet')) return;
    if (e.code === 'Space') { e.preventDefault(); if (mode !== 'playing') toggleRec(); }
    else if (e.key === 'Enter' && (mode === 'review' || mode === 'playing') && !okBtn.disabled) { e.preventDefault(); approve(); }
    else if ((e.key === 'r' || e.key === 'R') && mode !== 'rec') retake();
    else if ((e.key === 'p' || e.key === 'P') && (mode === 'review' || mode === 'playing')) doPlay();
  }
  document.addEventListener('keydown', onKey);

  show(
    h('div', { class: 'topbar' },
      h('button', { class: 'ghost', onclick: () => { if (mode === 'rec') return; cleanup(); screenSessions(); } }, '←'),
      h('div', { class: 'grow' }, h('div', {}, h('b', {}, session.kmr)), counter),
      h('button', { class: 'ghost', onclick: openList }, pair('list'))),
    h('div', { class: 'card prompt' }, say, gloss, examples, flag),
    h('details', { class: 'card', open: idx === 0 ? true : null }, h('summary', {}, pair('hintTitle', 'inline')), hint),
    m,
    recBtn,
    status,
    warnBox,
    reviewRow,
    okBtn,
    skipBtn,
    h('details', {}, h('summary', {}, pair('note', 'inline')), note),
    h('label', { class: 'check muted' }, autoplay, pair('autoplay')),
    h('p', { class: 'muted' }, pair('keys')),
    upStatus(),
  );
  renderItem();
}

function pick(o, keys) {
  const out = {};
  for (const k of keys) if (o && o[k] !== undefined) out[k] = o[k];
  return out;
}

function screenSessionDone(session) {
  const st = sessionStats(session, S.state.done, S.state.skipped);
  const btn = h('button', { class: 'primary', onclick: finish }, pair('finish'));
  const status = h('div', { class: 'status' });
  async function finish() {
    btn.disabled = true;
    const summary = {
      session: session.id, script: S.script.version, speaker: S.speaker,
      finishedAt: new Date().toISOString(), stats: st,
      items: session.items.map((it) => ({
        id: it.id, version: S.state.done[it.id] || 0, skipped: !!S.state.skipped[it.id], note: S.state.notes[it.id] || undefined,
      })),
      sampleRate: R.ctx ? R.ctx.sampleRate : null, input: R.settings, userAgent: navigator.userAgent,
    };
    await enqueue(`_session_${session.id}_${Date.now()}.json`, new TextEncoder().encode(JSON.stringify(summary, null, 1)), 'application/json', {});
    up.progressDirty = true;
    pump();
    status.replaceChildren(pair('sent'));
  }
  show(
    LOGO(),
    h('div', { class: 'card center' }, h('h1', {}, pair('sessionDone')), pair([session.kmr, session.tr], 'pair muted'),
      h('p', {}, `✓ ${st.ok} · ${T.skip[0]}/${T.skip[1]}: ${st.skip}`)),
    btn,
    status,
    upStatus(),
    h('button', { class: 'ghost', onclick: screenSessions }, pair('toSessions')),
  );
}

// ---------------------------------------------------------------- açılış
async function main() {
  S.key = parseKey(location.hash);
  if (!S.key) { screenBadLink(); return; }
  S.keyHash = await sha256Hex(S.key);
  S.demo = S.key === DEMO_KEY;
  const sp = SPEAKERS.find((x) => x.hash === S.keyHash);
  if (!sp && !S.demo) { screenBadLink(); return; }
  S.speaker = S.demo ? 'demo' : sp.id;
  try {
    S.script = await (await fetch('script.json', { cache: 'no-cache' })).json();
  } catch (e) {
    show(h('div', { class: 'card err-box' }, String(e)));
    return;
  }
  loadState();
  for (const s of S.script.sessions) s.items.forEach((it) => { it.session = s.id; });
  screenWelcome();
  const server = await fetchServerProgress();
  S.state.done = mergeDone(S.state.done, server);
  saveState();
  pump();
}

main();
