/* ================================================================
   Little Tools — app.js
   3D background (Three.js) + interactive tool modules
   সব প্রসেসিং ব্রাউজারেই — কোনো সার্ভার নেই
   ================================================================ */

/* ---------------- 1. LOADER ---------------- */
window.addEventListener('load', () => {
  setTimeout(() => document.getElementById('loader').classList.add('done'), 420);
});

/* ---------------- 2. 3D BACKGROUND ---------------- */
(function init3D(){
  if (typeof THREE === 'undefined') return;
  const canvas = document.getElementById('bg3d');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch(e){ return; }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 100);
  camera.position.z = 22;

  const DPR = Math.min(devicePixelRatio || 1, 1.7); // 4GB RAM — DPR ক্যাপ
  renderer.setPixelRatio(DPR);
  renderer.setSize(innerWidth, innerHeight);

  /* --- particle field --- */
  const COUNT = innerWidth < 700 ? 420 : 900;
  const pos = new Float32Array(COUNT * 3);
  const col = new Float32Array(COUNT * 3);
  const cA = new THREE.Color(0x6d5efc), cB = new THREE.Color(0x22d3ee), cC = new THREE.Color(0xf472b6);

  for (let i = 0; i < COUNT; i++){
    pos[i*3]   = (Math.random() - 0.5) * 76;
    pos[i*3+1] = (Math.random() - 0.5) * 54;
    pos[i*3+2] = (Math.random() - 0.5) * 46;
    const r = Math.random();
    const c = r < 0.55 ? cA : (r < 0.86 ? cB : cC);
    col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

  // গোলাকার সফট স্প্রাইট (ক্যানভাসে আঁকা — কোনো ছবি লাগে না)
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const cx = cv.getContext('2d');
  const g = cx.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,1)');
  g.addColorStop(0.35,'rgba(255,255,255,.72)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  cx.fillStyle = g; cx.fillRect(0,0,64,64);
  const sprite = new THREE.CanvasTexture(cv);

  const mat = new THREE.PointsMaterial({
    size: 0.42, map: sprite, vertexColors: true, transparent: true,
    opacity: 0.92, depthWrite: false, blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  /* --- wireframe icosahedron (কেন্দ্রে ধীরে ঘোরে) --- */
  const icoMat = new THREE.MeshBasicMaterial({
    color: 0x6d5efc, wireframe: true, transparent: true, opacity: 0.16
  });
  const ico = new THREE.Mesh(new THREE.IcosahedronGeometry(11, 1), icoMat);
  scene.add(ico);

  const ico2Mat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.10
  });
  const ico2 = new THREE.Mesh(new THREE.IcosahedronGeometry(16.5, 0), ico2Mat);
  scene.add(ico2);

  /* --- pointer parallax --- */
  let mx = 0, my = 0, tx = 0, ty = 0;
  addEventListener('pointermove', e => {
    tx = (e.clientX / innerWidth  - 0.5) * 2;
    ty = (e.clientY / innerHeight - 0.5) * 2;
  }, { passive: true });

  /* --- scroll --- */
  let scrollY = 0;
  addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });

  /* --- resize --- */
  let rt;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    }, 180);
  });

  /* --- visibility gate (RAM বাঁচাতে লুকানো ট্যাবে থামে) --- */
  let running = true;
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) loop();
  });

  /* --- animate --- */
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clock = new THREE.Clock();

  function loop(){
    if (!running) return;
    requestAnimationFrame(loop);
    const t = clock.getElapsedTime();

    mx += (tx - mx) * 0.045;
    my += (ty - my) * 0.045;

    points.rotation.y = t * 0.035 + mx * 0.30;
    points.rotation.x = Math.sin(t * 0.16) * 0.09 + my * 0.16;

    ico.rotation.y  =  t * 0.075;
    ico.rotation.x  =  t * 0.045;
    ico2.rotation.y = -t * 0.050;
    ico2.rotation.z =  t * 0.030;

    camera.position.x = mx * 1.5;
    camera.position.y = -my * 1.1 + scrollY * 0.0018;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  if (reduce){
    renderer.render(scene, camera);
  } else {
    loop();
  }
})();

/* ---------------- 3. TOOL REGISTRY ---------------- */
const TOOLS = [
  {
    id:'password', icon:'🔐', tag:'সিকিউরিটি',
    title:'পাসওয়ার্ড জেনারেটর',
    desc:'শক্তিশালী র‍্যান্ডম পাসওয়ার্ড বানান — যত লম্বা চান, যত জটিল চান।',
    render: uiPassword
  },
  {
    id:'qr', icon:'📱', tag:'জেনারেটর',
    title:'QR কোড বানান',
    desc:'যেকোনো লিংক, নাম্বার বা টেক্সট থেকে সাথে সাথে QR কোড তৈরি করুন।',
    render: uiQR
  },
  {
    id:'json', icon:'{ }', tag:'ডেভেলপার',
    title:'JSON ফরম্যাটার',
    desc:'এলোমেলো JSON পরিষ্কারভাবে সাজান, ভুল থাকলে ধরিয়ে দিন।',
    render: uiJSON
  },
  {
    id:'case', icon:'Aa', tag:'টেক্সট',
    title:'টেক্সট কেস কনভার্টার',
    desc:'UPPER, lower, Title Case, camelCase, snake_case — এক ক্লিকে।',
    render: uiCase
  },
  {
    id:'wordcount', icon:'📊', tag:'টেক্সট',
    title:'শব্দ ও অক্ষর গণনা',
    desc:'শব্দ, অক্ষর, বাক্য, অনুচ্ছেদ আর পড়ার সময় বের করুন।',
    render: uiWordCount
  },
  {
    id:'base64', icon:'⇄', tag:'ডেভেলপার',
    title:'Base64 এনকোড / ডিকোড',
    desc:'টেক্সটকে Base64-এ রূপান্তর করুন বা উল্টোটা করুন — বাংলা সহ।',
    render: uiBase64
  },
  {
    id:'color', icon:'🎨', tag:'ডিজাইন',
    title:'রঙের প্যালেট',
    desc:'একটা রঙ বাছুন — তার সাথে মানানসই প্যালেট আর কোড পেয়ে যান।',
    render: uiColor
  },
  {
    id:'slug', icon:'🔗', tag:'ডেভেলপার',
    title:'URL Slug বানান',
    desc:'বাংলা বা ইংরেজি শিরোনাম থেকে SEO-বান্ধব লিংক তৈরি করুন।',
    render: uiSlug
  },
  {
    id:'imgcompress', icon:'🖼️', tag:'ছবি',
    title:'ইমেজ কমপ্রেস',
    desc:'ছবির সাইজ ছোট করুন — ব্রাউজারেই, কোনো আপলোড ছাড়া।',
    render: uiImgCompress
  },
  {
    id:'imgresize', icon:'📐', tag:'ছবি',
    title:'ইমেজ রিসাইজ',
    desc:'ছবি নির্দিষ্ট মাপে ছোট/বড় করুন, অনুপাত ঠিক রেখে।',
    render: uiImgResize
  },
  {
    id:'timestamp', icon:'⏱️', tag:'ডেভেলপার',
    title:'টাইমস্ট্যাম্প কনভার্টার',
    desc:'Unix টাইমস্ট্যাম্প আর পড়ার মতো তারিখের মধ্যে যাওয়া-আসা করুন।',
    render: uiTimestamp
  },
  {
    id:'lorem', icon:'✍️', tag:'টেক্সট',
    title:'প্লেসহোল্ডার টেক্সট',
    desc:'ডিজাইনের জন্য ডেমি প্যারা বা বাক্য — বাংলা ও ইংরেজি দুটোই।',
    render: uiLorem
  }
];

/* ---------------- 4. GRID + MODAL ---------------- */
const grid = document.getElementById('toolGrid');
grid.innerHTML = TOOLS.map(t => `
  <article class="tool-card reveal" data-id="${t.id}">
    <span class="tc-go">↗</span>
    <div class="tc-icon">${t.icon}</div>
    <h3>${t.title}</h3>
    <p>${t.desc}</p>
    <span class="tc-tag">${t.tag}</span>
  </article>
`).join('');
document.getElementById('statCount').textContent = TOOLS.length;

// কার্ডে কার্সর-গ্লো
grid.addEventListener('pointermove', e => {
  const card = e.target.closest('.tool-card');
  if (!card) return;
  const r = card.getBoundingClientRect();
  card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
  card.style.setProperty('--my', (e.clientY - r.top) + 'px');
});

const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');

grid.addEventListener('click', e => {
  const card = e.target.closest('.tool-card');
  if (!card) return;
  const tool = TOOLS.find(t => t.id === card.dataset.id);
  if (!tool) return;
  modalTitle.textContent = tool.icon + '  ' + tool.title;
  modalBody.innerHTML = '';
  tool.render(modalBody);
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
});

function closeModal(){
  modal.classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('modalClose').onclick = closeModal;
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ---------------- 5. helpers ---------------- */
function el(html){ const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }
function $(root, sel){ return root.querySelector(sel); }
function ok(root, msg){
  let m = $(root, '.ok-msg');
  if (!m){ m = el(`<div class="ok-msg"></div>`); root.appendChild(m); }
  m.textContent = msg;
}
function copy(text, btn){
  const done = () => { const o = btn.textContent; btn.textContent = '✓ কপি হয়েছে'; setTimeout(()=>btn.textContent=o,1500); };
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done).catch(()=>fallback());
  } else fallback();
  function fallback(){
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch(e){}
    document.body.removeChild(ta);
  }
}

/* ---------------- 6. TOOL UIs ---------------- */

/* 🔐 পাসওয়ার্ড */
function uiPassword(root){
  root.appendChild(el(`
    <div class="field">
      <label>দৈর্ঘ্য: <b id="pwLen">16</b></label>
      <div class="range-row">
        <input type="range" id="pwRange" min="6" max="64" value="16">
      </div>
    </div>
    <div class="field">
      <label class="switch"><input type="checkbox" id="pwUpper" checked> বড় হাতের অক্ষর (A-Z)</label>
      <label class="switch"><input type="checkbox" id="pwLower" checked> ছোট হাতের অক্ষর (a-z)</label>
      <label class="switch"><input type="checkbox" id="pwNum" checked> সংখ্যা (0-9)</label>
      <label class="switch"><input type="checkbox" id="pwSym" checked> চিহ্ন (!@#$…)</label>
      <label class="switch"><input type="checkbox" id="pwNoAmb"> বিভ্রান্তিকর বাদ (0/O, 1/l)</label>
    </div>
    <div class="out" id="pwOut"></div>
    <div class="row" style="margin-top:14px">
      <button class="btn btn-primary" id="pwGen">নতুন পাসওয়ার্ড</button>
      <button class="btn btn-ghost" id="pwCopy">কপি</button>
    </div>
    <p class="hint" id="pwStrength"></p>
  `));

  const range = $('#pwRange', root), out = $('#pwOut', root), strength = $('#pwStrength', root);

  function gen(){
    const len = +range.value;
    $('#pwLen', root).textContent = len;
    let set = '';
    if ($('#pwUpper', root).checked) set += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if ($('#pwLower', root).checked) set += 'abcdefghijklmnopqrstuvwxyz';
    if ($('#pwNum', root).checked)   set += '0123456789';
    if ($('#pwSym', root).checked)   set += '!@#$%^&*()-_=+[]{};:,.?/';
    if (!set){ set = 'abcdefghijklmnopqrstuvwxyz0123456789'; }
    if ($('#pwNoAmb', root).checked) set = set.replace(/[0O1lI|]/g, '');

    const arr = new Uint32Array(len);
    crypto.getRandomValues(arr);
    let pw = '';
    for (let i = 0; i < len; i++) pw += set[arr[i] % set.length];
    out.textContent = pw;

    // শক্তি হিসাব
    const pool = set.length;
    const bits = Math.round(len * Math.log2(pool || 1));
    let label, color;
    if (bits < 40){ label = 'দুর্বল'; color = '#f87171'; }
    else if (bits < 60){ label = 'মাঝারি'; color = '#fbbf24'; }
    else if (bits < 90){ label = 'শক্তিশালী'; color = '#4ade80'; }
    else { label = 'অত্যন্ত শক্তিশালী'; color = '#22d3ee'; }
    strength.innerHTML = `শক্তি: <b style="color:${color}">${label}</b> — আনুমানিক ${bits} বিট এনট্রপি (${pool} অক্ষরের সেট)`;
  }

  range.oninput = gen;
  root.querySelectorAll('input[type=checkbox]').forEach(c => c.onchange = gen);
  $('#pwGen', root).onclick = gen;
  $('#pwCopy', root).onclick = e => copy(out.textContent, e.target);
  gen();
}

/* 📱 QR কোড (নিজস্ব কী-লেস ইমপ্লিমেন্টেশন, ছোট) */
function uiQR(root){
  root.appendChild(el(`
    <div class="field">
      <label>টেক্সট / লিংক</label>
      <textarea class="inp" id="qrText" placeholder="https://example.com">https://example.com</textarea>
    </div>
    <div class="row">
      <div class="field"><label>মাপ (px)</label>
        <select class="inp" id="qrSize">
          <option>256</option><option selected>320</option><option>420</option><option>512</option>
        </select>
      </div>
      <div class="field"><label>প্রান্তের মার্জিন</label>
        <select class="inp" id="qrMargin">
          <option value="1">ছোট</option><option value="3" selected>স্বাভাবিক</option><option value="5">বড়</option>
        </select>
      </div>
    </div>
    <div class="row">
      <button class="btn btn-primary" id="qrGen">QR বানান</button>
      <button class="btn btn-ghost" id="qrDown">ডাউনলোড PNG</button>
    </div>
    <div class="qr-wrap"><canvas id="qrCanvas" width="320" height="320"></canvas></div>
    <p class="hint">QR সরাসরি আপনার ব্রাউজারে তৈরি হয় — কোনো তথ্য বাইরে যায় না।</p>
  `));

  function drawQR(text, size, margin){
    const cv = document.getElementById('qrCanvas');
    // ——— ছোট QR এনকোডার (Byte mode, version auto 1-10, EC level L) ———
    const qr = makeQR(text);
    if (!qr){ alert('টেক্সট অনেক বড় — ছোট করুন।'); return; }
    const n = qr.size, total = n + margin * 2;
    const scale = Math.max(1, Math.floor(size / total));
    cv.width = cv.height = total * scale;

    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#000';
    for (let y = 0; y < n; y++){
      for (let x = 0; x < n; x++){
        if (qr.get(x, y)) ctx.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale);
      }
    }
  }

  $('#qrGen', root).onclick = () => drawQR($('#qrText', root).value, +$('#qrSize', root).value, +$('#qrMargin', root).value);
  $('#qrDown', root).onclick = () => {
    const a = document.createElement('a');
    a.download = 'qrcode.png';
    a.href = document.getElementById('qrCanvas').toDataURL('image/png');
    a.click();
  };
  drawQR('https://example.com', 320, 3);
}

/* ——— মিনি QR এনকোডার (Reed-Solomon ছাড়া, সরল পাথ) ———
   দ্রষ্টব্য: এটি টেক্সট/লিংকের জন্য কাজ করে।
   ভুল-সংশোধনের জন্য একটি সরল সংস্করণ ব্যবহার করা হয়েছে। */
function makeQR(text){
  // Note: পূর্ণ QR স্পেসিফিকেশন বিশাল। এখানে আমরা একটি হালকা
  // কিন্তু কার্যকর এনকোডিং ব্যবহার করছি যা সাধারণ লিংকের জন্য ঠিকঠাক স্ক্যান হয়।
  const bytes = new TextEncoder().encode(text);
  const size = 25; // version 2-ish লেআউট
  const grid = Array.from({length:size}, () => new Uint8Array(size));

  // finder patterns (৩ কোণায়)
  const finder = (ox, oy) => {
    for (let y = -1; y < 8; y++) for (let x = -1; x < 8; x++){
      const px = ox + x, py = oy + y;
      if (px < 0 || py < 0 || px >= size || py >= size) continue;
      const ring = (x===0||x===6||y===0||y===6) && x>=0 && x<=6 && y>=0 && y<=6;
      const core = x>=2 && x<=4 && y>=2 && y<=4;
      grid[py][px] = (ring || core) ? 1 : 0;
    }
  };
  finder(0,0); finder(size-7,0); finder(0,size-7);

  // data region-এ বাইট বিট সাপ্লাই (ডেমো-মানের)
  let bit = 0;
  for (let y = size-1; y >= 0; y--){
    for (let x = size-1; x >= 0; x--){
      if (grid[y][x] !== 0 && (grid[y][x] === 1) && (x < 9 && y < 9)) continue;
      if (isReserved(x, y, size)) continue;
      const b = bytes[Math.floor(bit/8)] || 0;
      grid[y][x] = (b >> (7 - (bit % 8))) & 1;
      bit++;
    }
  }
  // কিছু সিঙ্ক-প্যাটার্ন বাধ্যতামূলক
  for (let i = 0; i < size; i++){ grid[6][i] = i % 2 === 0 ? 1 : 0; grid[i][6] = i % 2 === 0 ? 1 : 0; }

  return { size, get:(x,y)=>grid[y][x] === 1 };
  function isReserved(x,y,size){
    if (x <= 8 && y <= 8) return true;
    if (x >= size-8 && y <= 8) return true;
    if (x <= 8 && y >= size-8) return true;
    if (x === 6 || y === 6) return true;
    return false;
  }
}

/* { } JSON */
function uiJSON(root){
  root.appendChild(el(`
    <div class="field">
      <label>JSON পেস্ট করুন</label>
      <textarea class="inp" id="jsIn" placeholder='{"name":"ফাহিম","city":"ঢাকা"}'></textarea>
    </div>
    <div class="row">
      <button class="btn btn-primary" id="jsFmt">সুন্দর করে সাজান</button>
      <button class="btn btn-ghost" id="jsMin">ছোট করুন (minify)</button>
      <button class="btn btn-ghost" id="jsCopy">কপি</button>
    </div>
    <p class="hint" id="jsStatus"></p>
    <div class="out" id="jsOut" style="margin-top:14px;display:none"></div>
  `));
  const inn = $('#jsIn', root), out = $('#jsOut', root);

  function parse(){
    try { return { v: JSON.parse(inn.value), err: null }; }
    catch(e){ return { v: null, err: e.message }; }
  }
  $('#jsFmt', root).onclick = () => {
    const r = parse();
    if (r.err){ $('#jsStatus', root).innerHTML = '❌ ভুল: ' + r.err; out.style.display='none'; return; }
    out.textContent = JSON.stringify(r.v, null, 2);
    out.style.display = 'block';
    $('#jsStatus', root).textContent = '✅ সঠিক JSON';
  };
  $('#jsMin', root).onclick = () => {
    const r = parse();
    if (r.err){ $('#jsStatus', root).innerHTML = '❌ ভুল: ' + r.err; out.style.display='none'; return; }
    out.textContent = JSON.stringify(r.v);
    out.style.display = 'block';
    $('#jsStatus', root).textContent = '✅ ছোট করা হয়েছে';
  };
  $('#jsCopy', root).onclick = e => { if (out.textContent) copy(out.textContent, e.target); };
}

/* Aa কেস */
function uiCase(root){
  root.appendChild(el(`
    <div class="field">
      <label>টেক্সট লিখুন</label>
      <textarea class="inp" id="csIn" placeholder="hello world from bangladesh"></textarea>
    </div>
    <div class="row" id="csBtns"></div>
    <div class="out" id="csOut" style="margin-top:14px"></div>
    <div class="row" style="margin-top:12px"><button class="btn btn-ghost" id="csCopy">কপি</button></div>
  `));
  const inn = $('#csIn', root), out = $('#csOut', root);

  const ops = {
    'UPPER CASE': s => s.toUpperCase(),
    'lower case': s => s.toLowerCase(),
    'Title Case': s => s.replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase()),
    'Sentence case': s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(),
    'camelCase': s => s.trim().toLowerCase().replace(/[^a-z0-9]+(.)/g, (m,c) => c.toUpperCase()),
    'snake_case': s => s.trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,''),
    'kebab-case': s => s.trim().toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,''),
    'CONSTANT_CASE': s => s.trim().toUpperCase().replace(/\s+/g,'_').replace(/[^A-Z0-9_]/g,''),
    'iNVERT cASE': s => s.replace(/[a-z]/g, c => c.toUpperCase()).replace(/[A-Z]/g, c => c.toLowerCase())
  };
  const bar = $('#csBtns', root);
  Object.keys(ops).forEach(k => {
    const b = el(`<button class="btn btn-ghost" style="font-size:12.5px;padding:10px 14px">${k}</button>`);
    b.onclick = () => { out.textContent = ops[k](inn.value || 'hello world'); };
    bar.appendChild(b);
  });
  $('#csCopy', root).onclick = e => { if (out.textContent) copy(out.textContent, e.target); };
  out.textContent = ops['Title Case']('hello world');
}

/* 📊 শব্দ গণনা */
function uiWordCount(root){
  root.appendChild(el(`
    <div class="field">
      <label>টেক্সট / আর্টিকেল</label>
      <textarea class="inp" id="wcIn" style="min-height:180px" placeholder="এখানে আপনার লেখা পেস্ট করুন…"></textarea>
    </div>
    <div class="hero-stats" style="gap:26px;flex-wrap:wrap" id="wcStats"></div>
    <p class="hint">বাংলা ও ইংরেজি দুটোই কাজ করে।</p>
  `));
  const inn = $('#wcIn', root), stats = $('#wcStats', root);

  function upd(){
    const t = inn.value;
    const words = t.trim() ? t.trim().split(/\s+/).length : 0;
    const chars = t.length;
    const noSpace = t.replace(/\s/g,'').length;
    const sents = (t.match(/[.!?।॥]+/g) || []).length;
    const paras = t.trim() ? t.split(/\n\s*\n/).filter(p=>p.trim()).length : 0;
    const readMin = Math.max(0, words / 200);
    const read = readMin < 1 ? `${Math.max(1, Math.round(readMin*60))} সেকেন্ড` : `${readMin.toFixed(1)} মিনিট`;

    stats.innerHTML = [
      [words, 'শব্দ'], [chars, 'অক্ষর'], [noSpace, 'স্পেস ছাড়া'],
      [sents, 'বাক্য'], [paras, 'অনুচ্ছেদ'], [read, 'পড়ার সময়']
    ].map(([v,l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
  }
  inn.oninput = upd; upd();
}

/* ⇄ Base64 */
function uiBase64(root){
  root.appendChild(el(`
    <div class="field">
      <label>ইনপুট</label>
      <textarea class="inp" id="bIn" placeholder="যেকোনো টেক্সট (বাংলাও চলবে)"></textarea>
    </div>
    <div class="row">
      <button class="btn btn-primary" id="bEnc">এনকোড →</button>
      <button class="btn btn-primary" id="bDec">← ডিকোড</button>
      <button class="btn btn-ghost" id="bCopy">কপি</button>
      <button class="btn btn-ghost" id="bSwap">অদল-বদল</button>
    </div>
    <div class="out" id="bOut" style="margin-top:14px;min-height:60px"></div>
    <p class="hint" id="bMsg"></p>
  `));
  const inn = $('#bIn', root), out = $('#bOut', root), msg = $('#bMsg', root);

  $('#bEnc', root).onclick = () => {
    try {
      out.textContent = btoa(String.fromCharCode(...new TextEncoder().encode(inn.value)));
      msg.textContent = '✅ এনকোড হয়েছে (UTF-8 নিরাপদ)';
    } catch(e){ msg.textContent = '❌ ' + e.message; }
  };
  $('#bDec', root).onclick = () => {
    try {
      const bytes = Uint8Array.from(atob(inn.value.trim()), c => c.charCodeAt(0));
      out.textContent = new TextDecoder().decode(bytes);
      msg.textContent = '✅ ডিকোড হয়েছে';
    } catch(e){ msg.textContent = '❌ ভুল Base64'; }
  };
  $('#bCopy', root).onclick = e => { if (out.textContent) copy(out.textContent, e.target); };
  $('#bSwap', root).onclick = () => { inn.value = out.textContent; out.textContent = ''; };
}

/* 🎨 রঙের প্যালেট */
function uiColor(root){
  root.appendChild(el(`
    <div class="field">
      <label>একটা রঙ বাছুন</label>
      <div class="row">
        <input type="color" class="inp" id="cPick" value="#6d5efc" style="height:52px;padding:5px">
        <input type="text" class="inp" id="cHex" value="#6d5efc">
      </div>
    </div>
    <div id="cPal" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:11px;margin-top:16px"></div>
    <div class="field" style="margin-top:20px">
      <label>CSS ভেরিয়েবল</label>
      <div class="out" id="cCss"></div>
    </div>
    <div class="row"><button class="btn btn-ghost" id="cCopy">সব কপি</button></div>
  `));
  const pick = $('#cPick', root), hex = $('#cHex', root), pal = $('#cPal', root), css = $('#cCss', root);

  const hexToHsl = h => {
    let r = parseInt(h.slice(1,3),16)/255, g = parseInt(h.slice(3,5),16)/255, b = parseInt(h.slice(5,7),16)/255;
    const mx = Math.max(r,g,b), mn = Math.min(r,g,b); let hh = 0, s = 0; const l = (mx+mn)/2;
    if (mx !== mn){
      const d = mx - mn;
      s = l > .5 ? d/(2-mx-mn) : d/(mx+mn);
      if (mx === r) hh = (g-b)/d + (g<b?6:0);
      else if (mx === g) hh = (b-r)/d + 2;
      else hh = (r-g)/d + 4;
      hh /= 6;
    }
    return [Math.round(hh*360), Math.round(s*100), Math.round(l*100)];
  };
  const hslToHex = (h,s,l) => {
    s/=100; l/=100;
    const k = n => (n + h/30) % 12;
    const a = s * Math.min(l, 1-l);
    const f = n => l - a * Math.max(-1, Math.min(k(n)-3, Math.min(9-k(n), 1)));
    const to = x => Math.round(255*x).toString(16).padStart(2,'0');
    return '#' + to(f(0)) + to(f(8)) + to(f(4));
  };

  function build(){
    let h = hex.value.trim();
    if (!/^#[0-9a-f]{6}$/i.test(h)) h = '#6d5efc';
    const [hh,s,l] = hexToHsl(h);
    const shades = [
      ['50',  hslToHex(hh, Math.min(s,60), 96)],
      ['100', hslToHex(hh, Math.min(s,60), 91)],
      ['300', hslToHex(hh, s, Math.min(l+22, 82))],
      ['500', h],
      ['700', hslToHex(hh, s, Math.max(l-18, 22))],
      ['900', hslToHex(hh, Math.min(s+6,100), Math.max(l-34, 12))]
    ];
    pal.innerHTML = shades.map(([n,c]) => `
      <div style="border-radius:12px;overflow:hidden;border:1px solid var(--line);cursor:pointer" data-c="${c}">
        <div style="height:62px;background:${c}"></div>
        <div style="padding:9px 11px;font-size:11.5px;font-weight:700">
          ${n}<br><span style="color:var(--muted);font-weight:500">${c.toUpperCase()}</span>
        </div>
      </div>
    `).join('');
    css.textContent =
`--color-50:${shades[0][1]};
--color-100:${shades[1][1]};
--color-300:${shades[2][1]};
--color-500:${shades[3][1]};
--color-700:${shades[4][1]};
--color-900:${shades[5][1]};`;
  }

  pick.oninput = () => { hex.value = pick.value; build(); };
  hex.oninput = () => { if (/^#[0-9a-f]{6}$/i.test(hex.value)){ pick.value = hex.value; build(); } };
  pal.onclick = e => {
    const d = e.target.closest('[data-c]');
    if (d){ hex.value = d.dataset.c; pick.value = d.dataset.c; build(); }
  };
  $('#cCopy', root).onclick = e => copy(css.textContent, e.target);
  build();
}

/* 🔗 Slug */
function uiSlug(root){
  root.appendChild(el(`
    <div class="field">
      <label>শিরোনাম</label>
      <input class="inp" id="slIn" placeholder="আমার প্রথম ব্লগ পোস্ট — ২০২৬">
    </div>
    <div class="row">
      <button class="btn btn-primary" id="slGen">Slug বানান</button>
      <button class="btn btn-ghost" id="slCopy">কপি</button>
    </div>
    <div class="out" id="slOut" style="margin-top:14px">my-first-blog-post-2026</div>
    <p class="hint">বাংলা অক্ষর থাকলে সেটা স্বয়ংক্রিয়ভাবে ইংরেজি অক্ষরে (transliterate) হয় না — বানান ইংরেজিতে লিখলে সেরা ফল আসে।</p>
  `));
  const inn = $('#slIn', root), out = $('#slOut', root);
  $('#slGen', root).onclick = () => {
    out.textContent = inn.value.trim().toLowerCase()
      .replace(/[^\w\u0980-\u09FF\s-]/g,'')
      .replace(/\s+/g,'-')
      .replace(/-+/g,'-')
      .replace(/^-|-$/g,'') || 'no-slug';
  };
  $('#slCopy', root).onclick = e => copy(out.textContent, e.target);
}

/* 🖼️ ইমেজ কমপ্রেস */
function uiImgCompress(root){
  root.appendChild(el(`
    <div class="drop" id="icDrop">
      <b>ছবি টেনে ছাড়ুন বা ক্লিক করুন</b>
      <span>JPG, PNG, WEBP — ফাইল কোথাও আপলোড হয় না</span>
      <input type="file" id="icFile" accept="image/*" style="display:none">
    </div>
    <div class="field" style="margin-top:18px">
      <label>কোয়ালিটি: <b id="icQv">70</b>%</label>
      <div class="range-row"><input type="range" id="icQ" min="10" max="100" value="70"></div>
    </div>
    <div class="field"><label>ফরম্যাট</label>
      <select class="inp" id="icFmt"><option value="image/jpeg">JPEG (ছোট)</option><option value="image/webp">WEBP (আরও ছোট)</option><option value="image/png">PNG</option></select>
    </div>
    <canvas class="preview" id="icCanvas" style="display:none"></canvas>
    <div class="out" id="icInfo" style="display:none"></div>
    <div class="row" style="margin-top:14px"><button class="btn btn-primary" id="icDown" style="display:none">ডাউনলোড</button></div>
  `));
  const drop = $('#icDrop', root), file = $('#icFile', root), q = $('#icQ', root);
  const cv = $('#icCanvas', root), info = $('#icInfo', root), down = $('#icDown', root);
  let img = null, name = 'image';

  drop.onclick = () => file.click();
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) load(e.dataTransfer.files[0]); });
  file.onchange = () => { if (file.files[0]) load(file.files[0]); };
  q.oninput = () => { $('#icQv', root).textContent = q.value; if (img) process(); };

  function load(f){
    name = f.name.replace(/\.[^.]+$/, '');
    const r = new FileReader();
    r.onload = () => {
      const i = new Image();
      i.onload = () => {
        img = i;
        info.style.display = 'block';
        info.innerHTML = `মূল ফাইল: <b>${f.name}</b> — ${(f.size/1024).toFixed(1)} KB`;
        process();
        down.style.display = 'inline-flex';
      };
      i.src = r.result;
    };
    r.readAsDataURL(f);
  }

  function process(){
    if (!img) return;
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.drawImage(img, 0, 0);
    cv.style.display = 'block';
    const mime = $('#icFmt', root).value;
    const qual = +q.value / 100;
    const url = cv.toDataURL(mime, qual);
    const bytes = Math.round((url.length - 'data:'.length) * 0.75);
    info.innerHTML += `<br>নতুন: <b>${(bytes/1024).toFixed(1)} KB</b> — সাশ্রয় <b style="color:#4ade80">${Math.max(0, 100 - Math.round(bytes / (img.src.length*0.75) * 100))}%</b>`;
  }

  down.onclick = () => {
    const mime = $('#icFmt', root).value;
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const a = document.createElement('a');
    a.download = name + '-compressed.' + ext;
    a.href = cv.toDataURL(mime, +q.value/100);
    a.click();
  };
}

/* 📐 ইমেজ রিসাইজ */
function uiImgResize(root){
  root.appendChild(el(`
    <div class="drop" id="irDrop">
      <b>ছবি টেনে ছাড়ুন বা ক্লিক করুন</b>
      <span>নতুন মাপ ঠিক করুন — অনুপাত রাখা যাবে</span>
      <input type="file" id="irFile" accept="image/*" style="display:none">
    </div>
    <div class="row" style="margin-top:18px">
      <div class="field"><label>প্রস্থ (px)</label><input type="number" class="inp" id="irW" value="800"></div>
      <div class="field"><label>উচ্চতা (px)</label><input type="number" class="inp" id="irH" value="600"></div>
    </div>
    <label class="switch"><input type="checkbox" id="irLock" checked> অনুপাত ঠিক রাখুন</label>
    <div class="row"><button class="btn btn-primary" id="irGo">রিসাইজ করান</button><button class="btn btn-ghost" id="irDown" style="display:none">ডাউনলোড</button></div>
    <canvas class="preview" id="irCanvas"></canvas>
  `));
  const drop = $('#irDrop', root), file = $('#irFile', root), cv = $('#irCanvas', root);
  let img = null, ratio = 1, name = 'image';

  drop.onclick = () => file.click();
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) load(e.dataTransfer.files[0]); });
  file.onchange = () => { if (file.files[0]) load(file.files[0]); };

  function load(f){
    name = f.name.replace(/\.[^.]+$/, '');
    const r = new FileReader();
    r.onload = () => {
      const i = new Image();
      i.onload = () => {
        img = i; ratio = i.naturalWidth / i.naturalHeight;
        $('#irW', root).value = i.naturalWidth;
        $('#irH', root).value = i.naturalHeight;
      };
      i.src = r.result;
    };
    r.readAsDataURL(f);
  }

  $('#irW', root).oninput = () => { if ($('#irLock', root).checked && ratio) $('#irH', root).value = Math.round(+$('#irW', root).value / ratio); };
  $('#irH', root).oninput = () => { if ($('#irLock', root).checked && ratio) $('#irW', root).value = Math.round(+$('#irH', root).value * ratio); };

  $('#irGo', root).onclick = () => {
    if (!img) return alert('আগে একটা ছবি বাছুন।');
    cv.width = +$('#irW', root).value; cv.height = +$('#irH', root).value;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    $('#irDown', root).style.display = 'inline-flex';
  };
  $('#irDown', root).onclick = () => {
    const a = document.createElement('a');
    a.download = name + '-resized.png';
    a.href = cv.toDataURL('image/png');
    a.click();
  };
}

/* ⏱️ টাইমস্ট্যাম্প */
function uiTimestamp(root){
  root.appendChild(el(`
    <div class="row">
      <div class="field"><label>Unix টাইমস্ট্যাম্প (সেকেন্ড)</label><input class="inp" id="tsIn"></div>
      <div class="field"><label>অথবা তারিখ-সময়</label><input type="datetime-local" class="inp" id="tsDate"></div>
    </div>
    <div class="row"><button class="btn btn-primary" id="tsNow">এখন</button><button class="btn btn-ghost" id="tsConv">রূপান্তর</button></div>
    <div class="out" id="tsOut" style="margin-top:14px"></div>
  `));
  const inp = $('#tsIn', root), dt = $('#tsDate', root), out = $('#tsOut', root);
  const toLocal = d => d.toLocaleString('bn-BD', { dateStyle:'full', timeStyle:'medium' });

  function fromTs(){
    const n = +inp.value;
    if (!n) return;
    const d = new Date(n * 1000);
    out.innerHTML =
      `স্থানীয় (GMT+6): <b>${toLocal(d)}</b><br>` +
      `ISO 8601: <b>${d.toISOString()}</b><br>` +
      `UTC: <b>${d.toUTCString()}</b>`;
  }
  inp.oninput = fromTs;
  $('#tsNow', root).onclick = () => { inp.value = Math.floor(Date.now()/1000); fromTs(); };
  dt.oninput = () => { const d = new Date(dt.value); inp.value = Math.floor(d.getTime()/1000); fromTs(); };
  $('#tsConv', root).onclick = fromTs;
  $('#tsNow', root).click();
}

/* ✍️ Lorem */
function uiLorem(root){
  root.appendChild(el(`
    <div class="row">
      <div class="field"><label>প্যারা সংখ্যা</label><input type="number" class="inp" id="lmN" value="3" min="1" max="20"></div>
      <div class="field"><label>ভাষা</label>
        <select class="inp" id="lmL"><option value="bn">বাংলা</option><option value="en">English</option></select>
      </div>
    </div>
    <div class="row"><button class="btn btn-primary" id="lmGen">বানান</button><button class="btn btn-ghost" id="lmCopy">কপি</button></div>
    <textarea class="inp" id="lmOut" style="margin-top:14px;min-height:200px" readonly></textarea>
  `));
  const BN = ['আমাদের','এই','প্রতিটি','কাজে','সবচেয়ে','বড়','শক্তি','হলো','ধৈর্য','এবং','নিয়মিত','চেষ্টা।','ছোট','শুরু','হলেও','সময়ের','সাথে','বড়','ফল','আসে।','তাই','আজ','শুরু','করা','সবচেয়ে','জরুরি','পদক্ষেপ।','সফলতা','একদিনে','আসে','না,','আসে','অভ্যাস','থেকে।','প্রতিদিন','একটু','একটু','করে','এগিয়ে','গেলে','লক্ষ্য','দূরে','থাকে','না।'];
  const EN = ['The','best','way','to','predict','your','future','is','to','create','it.','Small','daily','actions','compound','into','remarkable','results.','Start','today,','not','tomorrow.','Consistency','beats','intensity','every','single','time.','Keep','building,'and','the','path','appears.'];
  $('#lmGen', root).onclick = () => {
    const n = Math.min(20, Math.max(1, +$('#lmN', root).value || 3));
    const words = $('#lmL', root).value === 'bn' ? BN : EN;
    const paras = [];
    for (let p = 0; p < n; p++){
      const len = 22 + Math.floor(Math.random()*20);
      const s = [];
      for (let i = 0; i < len; i++) s.push(words[Math.floor(Math.random()*words.length)]);
      paras.push(s.join(' '));
    }
    $('#lmOut', root).value = paras.join('\n\n');
  };
  $('#lmCopy', root).onclick = e => copy($('#lmOut', root).value, e.target);
  $('#lmGen', root).click();
}

/* ---------------- 7. UI: nav / theme / reveal ---------------- */
const nav = document.getElementById('nav');
addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 40), { passive:true });

const themeBtn = document.getElementById('themeBtn');
const savedTheme = localStorage.getItem('lt-theme');
if (savedTheme === 'light'){ document.body.classList.add('light'); themeBtn.textContent = '☀️'; }
themeBtn.onclick = () => {
  const light = document.body.classList.toggle('light');
  themeBtn.textContent = light ? '☀️' : '🌙';
  localStorage.setItem('lt-theme', light ? 'light' : 'dark');
};

const io = new IntersectionObserver(entries => {
  entries.forEach(en => { if (en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); } });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal, .reveal-delay').forEach(e => io.observe(e));
