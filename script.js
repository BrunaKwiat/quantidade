/* ======================================================================
   RQ-504-01 — Registro de Inspeção (script enxuto)
   - Salvar/abrir no navegador (localStorage)
   - Adicionar/remover linhas (Produtos / Ensaios)
   - PDF simples (jsPDF)
   - Imprimir página (CSS de impressão)
   - Troca de tema com diálogo minimalista
   ====================================================================== */

/* =========================
   Constantes / helpers
   ========================= */
const STORAGE_KEY = "rq504-relatorios-v1";
const THEME_KEY = "ui-theme";
const THEME_META = {
  claro:  { colorScheme: "light", themeColor: "#0E3554" },
  escuro: { colorScheme: "dark",  themeColor: "#121933" },
  marinho:{ colorScheme: "dark",  themeColor: "#10253f" },
  sepia:  { colorScheme: "light", themeColor: "#9c6b3c" },
};

const $  = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : (Date.now()+Math.random()).toString(36));

function todayISO(){ return new Date().toISOString().slice(0,10); }
function toBRDate(isoOrAny){
  if (!isoOrAny) return "";
  const s = String(isoOrAny);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(s);
  if (!isNaN(d)) {
    const dd = String(d.getDate()).padStart(2,"0");
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  }
  return s;
}
function sanitizeFileName(s){
  return String(s||"")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toast(msg, type="info"){
  const live = $("#ariaLive");
  const pill = document.createElement("div");
  pill.className = "toast";
  pill.textContent = msg;
  pill.style.cssText = `
    position:fixed; right:16px; bottom:16px; z-index:9999;
    background:${type==="error" ? "#e11d48" : (type==="success" ? "#18A864" : "#111827")};
    color:#fff; padding:10px 12px; border-radius:12px;
    box-shadow:0 10px 30px rgba(0,0,0,.18); font:600 13px/1 system-ui,-apple-system,Segoe UI,Roboto,Ubuntu;
  `;
  document.body.appendChild(pill);
  setTimeout(() => { pill.style.opacity="0"; pill.style.transform="translateY(6px)"; }, 1800);
  setTimeout(() => pill.remove(), 2400);
  if (live){ live.textContent=""; setTimeout(()=>live.textContent=msg, 12); }
}

/* =========================
   Estado / Storage
   ========================= */
let relatorios = loadAll();
let atualId = null; // id do relatório aberto/atual

function loadAll(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function persistAll(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(relatorios));
}

/* =========================
   Tema (dialogo minimalista)
   ========================= */
function currentTheme(){
  return document.documentElement.getAttribute("data-theme") || localStorage.getItem(THEME_KEY) || "claro";
}
function applyTheme(theme){
  const html = document.documentElement;
  html.setAttribute("data-theme", theme);
  // metas
  let metaScheme = document.querySelector('meta[name="color-scheme"]');
  if (!metaScheme){ metaScheme = document.createElement("meta"); metaScheme.name = "color-scheme"; document.head.appendChild(metaScheme); }
  metaScheme.setAttribute("content", THEME_META[theme]?.colorScheme || "light");

  let metaTheme = document.querySelector('meta[name="theme-color"]');
  if (!metaTheme){ metaTheme = document.createElement("meta"); metaTheme.name = "theme-color"; document.head.appendChild(metaTheme); }
  metaTheme.setAttribute("content", THEME_META[theme]?.themeColor || "#0E3554");

  localStorage.setItem(THEME_KEY, theme);
}
function initThemeFromStorage(){ applyTheme(currentTheme()); }

function ensureThemeDialog(){
  if ($("#dlgTemas")) return;

  const tpl = document.createElement("template");
  tpl.innerHTML = `
    <dialog id="dlgTemas" style="border:0;padding:0;border-radius:14px;max-width:420px;width:92vw;">
      <form method="dialog" style="background:var(--surface);border:1px solid var(--border);border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.18)">
        <header style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
          <strong style="font:700 1.05rem/1.2 var(--ff-title)">Temas</strong>
          <button type="button" id="btnTemaFechar" aria-label="Fechar" style="background:transparent;border:0;font-size:20px;line-height:1;cursor:pointer">×</button>
        </header>
        <div style="padding:14px 16px;display:grid;gap:10px">
          ${["claro","escuro","marinho","sepia"].map((t,i)=>`
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
              <input type="radio" name="tema" value="${t}" ${i===0?"checked":""}/>
              <span style="font-weight:600;text-transform:capitalize">${t}</span>
            </label>
          `).join("")}
        </div>
        <footer style="padding:12px 16px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end">
          <button type="button" id="btnTemaAplicar" class="btn btn--primary">Aplicar</button>
          <button type="button" id="btnTemaCancelar" class="btn">Cancelar</button>
        </footer>
      </form>
    </dialog>
  `.trim();
  document.body.appendChild(tpl.content);

  const dlg = $("#dlgTemas");
  const close = () => (dlg.open ? dlg.close() : dlg.removeAttribute("open"));
  $("#btnTemaFechar")?.addEventListener("click", close);
  $("#btnTemaCancelar")?.addEventListener("click", close);
  $("#btnTemaAplicar")?.addEventListener("click", ()=>{
    const t = dlg.querySelector('input[name="tema"]:checked')?.value || "claro";
    applyTheme(t);
    toast("Tema aplicado: " + t, "success");
    close();
  });
  dlg.addEventListener("click", (ev)=>{
    const r = dlg.getBoundingClientRect();
    const inside = ev.clientX>=r.left && ev.clientX<=r.right && ev.clientY>=r.top && ev.clientY<=r.bottom;
    if (!inside) close();
  });
}

/* =========================
   DOM Ready
   ========================= */
document.addEventListener("DOMContentLoaded", () => {
  // ano no rodapé
  const ano = $("#ano"); if (ano) ano.textContent = new Date().getFullYear();

  // tema
  initThemeFromStorage();
  $("#btnTemas")?.addEventListener("click", () => {
    ensureThemeDialog();
    const dlg = $("#dlgTemas");
    // marca atual
    const t = currentTheme();
    const radio = dlg.querySelector(`input[name="tema"][value="${t}"]`);
    if (radio) radio.checked = true;
    try { dlg.showModal(); } catch { dlg.setAttribute("open","open"); }
  });

  // defaults do formulário
  if ($("#dataRelatorio") && !$("#dataRelatorio").value) $("#dataRelatorio").value = todayISO();

  // adicionar/remover linhas (tabelas)
  $("#addLinha")?.addEventListener("click", addProdutoRow);
  $("#addEnsaio")?.addEventListener("click", addEnsaioRow);

  // Delegação para remover linhas
  $("#tabelaProdutos tbody")?.addEventListener("click", (e)=>{
    const btn = e.target.closest(".remover"); if (!btn) return;
    const tr = btn.closest("tr"); if (!tr) return;
    tr.remove();
  });
  $("#tabelaEnsaios tbody")?.addEventListener("click", (e)=>{
    const btn = e.target.closest(".remover"); if (!btn) return;
    const tr = btn.closest("tr"); if (!tr) return;
    tr.remove();
  });

  // ações principais
  $("#btnSalvar")?.addEventListener("click", salvarAtual);
  $("#btnPDF")?.addEventListener("click", () => gerarPDF({save:true}));
  $("#btnImprimir")?.addEventListener("click", () => window.print());

  // busca/filtra lista
  $("#filtroLista")?.addEventListener("input", desenharLista);
  $("#btnBuscarRelatorio")?.addEventListener("click", desenharLista);

  // carrega lista e inicia com formulário “novo”
  desenharLista();
  limparFormulario();
});

/* =========================
   Linhas de tabela
   ========================= */
function addProdutoRow(){
  const tpl = $("#tplProdutoRow"); const tbody = $("#tabelaProdutos tbody");
  if (!tpl || !tbody) return;
  const node = tpl.content.firstElementChild.cloneNode(true);
  tbody.appendChild(node);
}
function addEnsaioRow(){
  const tpl = $("#tplEnsaioRow"); const tbody = $("#tabelaEnsaios tbody");
  if (!tpl || !tbody) return;
  const node = tpl.content.firstElementChild.cloneNode(true);
  tbody.appendChild(node);
}

/* =========================
   Coletar / Preencher form
   ========================= */
function coletarForm(){
  const produtos = $$("#tabelaProdutos tbody tr").map(tr => ({
    descricao: tr.querySelector('input[name="descricao[]"]')?.value?.trim() || "",
    lote:      tr.querySelector('input[name="lote[]"]')?.value?.trim() || "",
    data:      tr.querySelector('input[name="data[]"]')?.value || "",
    quantidade:tr.querySelector('input[name="quantidade[]"]')?.value || ""
  })).filter(p=>p.descricao || p.lote || p.data || p.quantidade);

  const ensaios = $$("#tabelaEnsaios tbody tr").map(tr => ({
    ensaio:    tr.querySelector('select[name="ensaio[]"]')?.value || "",
    amostras:  tr.querySelector('select[name="amostras[]"]')?.value || "",
    metodo:    tr.querySelector('select[name="metodo[]"]')?.value || "",
    resultado: tr.querySelector('select[name="resultado[]"]')?.value || ""
  })).filter(e=>e.ensaio || e.amostras || e.metodo || e.resultado);

  const nbrSel = $$('input[name="nbr[]"]:checked').map(c=>c.value);

  // Suporte ao id malformado anterior e ao id corrigido
  const ordemEl = document.getElementById("ordemProducao") || document.querySelector('[id="#ordemProducao"]') || document.querySelector('[name="#ordemProducao"]');

  return {
    id: (atualId || uid()),
    ordemProducao: ordemEl?.value?.trim() || "",
    quantidadeaverificar: $("#quantidadeaverificar")?.value?.trim() || "",
    quandoexecutarinspecao: $("#quandoexecutarinspecao")?.value?.trim() || "",
    dataRelatorio: $("#dataRelatorio")?.value || "",
    produtos,
    ensaios,
    nbr: nbrSel,
    updatedAt: Date.now(),
  };
}

function preencherForm(data){
  atualId = data?.id || null;

  const ordemEl = document.getElementById("ordemProducao") || document.querySelector('[id="#ordemProducao"]') || document.querySelector('[name="#ordemProducao"]');
  if (ordemEl) ordemEl.value = data.ordemProducao || "";

  if ($("#quantidadeaverificar")) $("#quantidadeaverificar").value = data.quantidadeaverificar || "";
  if ($("#quandoexecutarinspecao")) $("#quandoexecutarinspecao").value = data.quandoexecutarinspecao || "";
  if ($("#dataRelatorio")) $("#dataRelatorio").value = data.dataRelatorio || todayISO();

  // produtos
  const pBody = $("#tabelaProdutos tbody");
  if (pBody){
    pBody.innerHTML = "";
    if ((data.produtos||[]).length){
      data.produtos.forEach(p => {
        addProdutoRow();
        const tr = pBody.lastElementChild;
        tr.querySelector('input[name="descricao[]"]').value = p.descricao || "";
        tr.querySelector('input[name="lote[]"]').value = p.lote || "";
        tr.querySelector('input[name="data[]"]').value = p.data || "";
        tr.querySelector('input[name="quantidade[]"]').value = p.quantidade || "";
      });
    } else {
      addProdutoRow(); // mantém 1 linha vazia
    }
  }

  // ensaios
  const eBody = $("#tabelaEnsaios tbody");
  if (eBody){
    eBody.innerHTML = "";
    if ((data.ensaios||[]).length){
      data.ensaios.forEach(e => {
        addEnsaioRow();
        const tr = eBody.lastElementChild;
        tr.querySelector('select[name="ensaio[]"]').value = e.ensaio || "";
        tr.querySelector('select[name="amostras[]"]').value = e.amostras || "";
        tr.querySelector('select[name="metodo[]"]').value = e.metodo || "";
        tr.querySelector('select[name="resultado[]"]').value = e.resultado || "";
      });
    } else {
      addEnsaioRow();
    }
  }

  // NBR
  $$('input[name="nbr[]"]').forEach(c => { c.checked = (data.nbr || []).includes(c.value); });
}

function limparFormulario(){
  preencherForm({
    id: null,
    ordemProducao: "",
    quantidadeaverificar: "",
    quandoexecutarinspecao: "",
    dataRelatorio: todayISO(),
    produtos: [],
    ensaios: [],
    nbr: []
  });
}

/* =========================
   Salvar / Lista lateral
   ========================= */
function salvarAtual(){
  const form = $("#formRelatorio");
  if (form && !form.reportValidity()) return;

  const data = coletarForm();

  const ix = relatorios.findIndex(r => r.id === data.id);
  if (ix >= 0) {
    relatorios[ix] = data;
  } else {
    relatorios.unshift(data);
  }
  atualId = data.id;
  persistAll();
  desenharLista();
  toast("Relatório salvo!", "success");
}

function desenharLista(){
  const ul = $("#listaRelatorios"); if (!ul) return;
  const termo = ($("#filtroLista")?.value || "").toLowerCase().trim();

  ul.innerHTML = "";
  relatorios
    .filter(r => {
      const base = [
        r.ordemProducao, r.quandoexecutarinspecao, r.dataRelatorio,
        ...(r.produtos||[]).map(p=>p.descricao)
      ].join(" ").toLowerCase();
      return base.includes(termo);
    })
    .sort((a,b)=> b.updatedAt - a.updatedAt)
    .forEach(r => {
      const li = document.createElement("li");
      const dataTxt = r.dataRelatorio ? toBRDate(r.dataRelatorio) : "-";
      const resumoProd = (r.produtos && r.produtos[0]?.descricao) ? `• ${r.produtos[0].descricao}` : "";
      li.innerHTML = `
        <strong>${r.ordemProducao ? "FP nº " + r.ordemProducao : "(sem nº)"} — ${dataTxt}</strong>
        <span class="meta" style="color:var(--muted);font-size:.9rem">${resumoProd}</span>
        <div class="row-actions" style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn" data-open>Abrir</button>
          <button class="btn remover" data-delete>Apagar</button>
        </div>
      `;
      li.querySelector("[data-open]").addEventListener("click", () => {
        preencherForm(r);
        toast("Relatório carregado");
      });
      li.querySelector("[data-delete]").addEventListener("click", () => {
        if (!confirm("Apagar este relatório?")) return;
        relatorios = relatorios.filter(x => x.id !== r.id);
        if (atualId === r.id) { atualId = null; limparFormulario(); }
        persistAll();
        desenharLista();
        toast("Relatório apagado");
      });
      ul.appendChild(li);
    });

  if (!ul.children.length){
    const li = document.createElement("li");
    li.textContent = "Nenhum relatório salvo.";
    ul.appendChild(li);
  }
}

/* =========================
   PDF (jsPDF) — simples e direto
   ========================= */
function getImageAsDataURL(src, preferPNG=false){
  return new Promise((resolve, reject)=>{
    if (!src) return resolve(null);
    if (/^data:image\//i.test(src)) return resolve(src);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try{
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (preferPNG){
          ctx.clearRect(0,0,canvas.width,canvas.height);
          ctx.drawImage(img,0,0);
          resolve(canvas.toDataURL("image/png"));
        } else {
          ctx.fillStyle = "#fff";
          ctx.fillRect(0,0,canvas.width,canvas.height);
          ctx.drawImage(img,0,0);
          resolve(canvas.toDataURL("image/jpeg", .92));
        }
      }catch(err){ reject(err); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function gerarPDF(opts = {}) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("jsPDF não está carregado. Confira a tag no <head>.");
    return;
  }
  const { jsPDF } = window.jspdf;

  // ---------- Helpers ----------
  const HEX = {
    brand: (window.THEME?.brand) || "#E1262D",
    ink:   (window.THEME?.ink)   || "#0F1E3D",
    muted: (window.THEME?.muted) || "#5C6B84",
    border:(window.THEME?.border)|| "#E2E8F0",
  };
  const hex2rgb = (hex) => {
    const s = hex.replace("#","").trim();
    const b = s.length === 3
      ? s.split("").map(ch => parseInt(ch+ch,16))
      : [s.slice(0,2),s.slice(2,4),s.slice(4,6)].map(v=>parseInt(v,16));
    return b;
  };
  const RGB = {
    brand: hex2rgb(HEX.brand),
    ink:   hex2rgb(HEX.ink),
    muted: hex2rgb(HEX.muted),
    border:hex2rgb(HEX.border),
    grayBg:[246,248,251],
    headBg:[234,239,246]
  };

  const formatDateBR = (input) => {
    if (!input) return "";
    const s = String(input).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
    const d = new Date(s);
    if (!isNaN(d)) {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
    return s;
  };

  const pick = (selectors) => {
    for (const sel of selectors) {
      const el = sel.startsWith("#") || sel.startsWith("[")
        ? document.querySelector(sel)
        : document.getElementById(sel);
      const v = (el && ("value" in el)) ? (el.value ?? "").toString() : "";
      if (v?.trim()) return v.trim();
    }
    return "";
  };

  const _getLogoDataURL = (typeof getLogoDataURL === "function")
    ? getLogoDataURL
    : async function () {
        const logoEl = document.querySelector(".brand img");
        const src = logoEl?.src || "shiva.png";
        try {
          if (typeof loadImageAsDataURL === "function") {
            return await loadImageAsDataURL(src, /* preferPNG */ true);
          }
          return src;
        } catch { return null; }
      };

  // ---------- Coleta do HTML atual ----------
  const fichaProducao = pick(['#ordemProducao','[id="#ordemProducao"]','[name="#ordemProducao"]']);
  const qtdVerificar  = pick(['#quantidadeaverificar','[name="quantidadeaverificar"]']);
  const quandoInspec  = pick(['#quandoexecutarinspecao','[name="quandoexecutarinspecao"]']);
  const dataRelatorio = formatDateBR(pick(['#dataRelatorio','[name="dataRelatorio"]']));

  const produtos = Array.from(document.querySelectorAll('#tabelaProdutos tbody tr')).map(tr => ({
    descricao: tr.querySelector('input[name="descricao[]"]')?.value?.trim() || "",
    lote:      tr.querySelector('input[name="lote[]"]')?.value?.trim() || "",
    data:      formatDateBR(tr.querySelector('input[name="data[]"]')?.value || ""),
    quantidade:tr.querySelector('input[name="quantidade[]"]')?.value?.trim() || ""
  })).filter(x => x.descricao || x.lote || x.data || x.quantidade);

  const ensaios = Array.from(document.querySelectorAll('#tabelaEnsaios tbody tr')).map(tr => ({
    ensaio:    tr.querySelector('select[name="ensaio[]"] option:checked')?.textContent?.trim() || "",
    amostras:  tr.querySelector('select[name="amostras[]"] option:checked')?.textContent?.trim() || "",
    metodo:    tr.querySelector('select[name="metodo[]"] option:checked')?.textContent?.trim() || "",
    resultado: tr.querySelector('select[name="resultado[]"] option:checked')?.textContent?.trim() || ""
  })).filter(x => x.ensaio || x.amostras || x.metodo || x.resultado);

  const nbr = Array.from(document.querySelectorAll('.nbr-options input[name="nbr[]"]:checked'))
              .map(i => i.value?.toUpperCase() || "").filter(Boolean);

  // ---------- jsPDF ----------
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  doc.setProperties({
    title:  "RQ-504-01 — Registro de Inspeção",
    subject:"Peças acabadas por lote produzido",
    author: "Shiva Conexões",
    creator:"Relatórios Digitais"
  });

  const PAGE = { W: doc.internal.pageSize.getWidth(), H: doc.internal.pageSize.getHeight(), M: 42 };
  let y = PAGE.M;
  const font = { base: "helvetica", bold: "bold" };

  // ---------- Cabeçalho / Rodapé / Moldura ----------
  let _logoDrawn = false, _logoW = 90, _lineGap = 12;

  const drawHeader = async () => {
    doc.setFont(font.base, font.bold);
    doc.setFontSize(13);
    doc.setTextColor(...RGB.ink);

    // Logo
    let titleX = PAGE.M; // fallback
    try {
      const logo = await _getLogoDataURL();
      if (logo) {
        const w = _logoW; const h = 24;
        doc.addImage(logo, "PNG", PAGE.M, y, w, h, undefined, "FAST");
        _logoDrawn = true;
        titleX = PAGE.M + w + 12;
      }
    } catch {
      _logoDrawn = false;
      titleX = PAGE.M;
    }

    // Título à direita da logo
    const title = "RQ-504-01 — Registro de Inspeção de Peças Acabadas por Lote Produzido";
    doc.text(title, titleX, y + 16);

    // Barra fina de acento — QUEBRADA (não passa sob a logo)
    doc.setDrawColor(...RGB.brand);
    doc.setLineWidth(1.4);
    const lineY = y + 30;
    const start = _logoDrawn ? (PAGE.M + _logoW + _lineGap) : PAGE.M;
    doc.line(start, lineY, PAGE.W - PAGE.M, lineY);

    y += 38;
    // reset de estilo
    doc.setTextColor(...RGB.ink);
    doc.setLineWidth(.8);
  };

  const drawFooter = (pageNum) => {
    const text = `Shiva Conexões • pág. ${pageNum}`;
    doc.setFont(font.base, "normal");
    doc.setFontSize(9); doc.setTextColor(...RGB.muted);

    // linha antes do rodapé
    doc.setDrawColor(...RGB.border);
    doc.setLineWidth(0.8);
    doc.line(PAGE.M, PAGE.H - PAGE.M - 22, PAGE.W - PAGE.M, PAGE.H - PAGE.M - 22);

    doc.text(text, PAGE.W - PAGE.M, PAGE.H - PAGE.M - 8, { align: "right" });
  };

  const drawPageFrame = () => {
    doc.setDrawColor(...RGB.border);
    doc.setLineWidth(0.8);
    doc.roundedRect(PAGE.M - 10, PAGE.M - 10, PAGE.W - (PAGE.M - 10) * 2, PAGE.H - (PAGE.M - 10) * 2, 8, 8);
  };

  const ensureSpace = async (h = 24) => {
    if (y + h <= PAGE.H - PAGE.M - 34) return;
    drawFooter(doc.internal.getNumberOfPages());
    doc.addPage();
    y = PAGE.M;
    drawPageFrame();
    await drawHeader();
  };

  // ---------- Seções e campos ----------
  const section = async (title) => {
    await ensureSpace(46);
    doc.setFillColor(...RGB.headBg);
    doc.setDrawColor(...RGB.border);
    doc.setLineWidth(0.8);
    doc.roundedRect(PAGE.M, y, PAGE.W - PAGE.M * 2, 30, 6, 6, "FD");

    doc.setFillColor(...RGB.brand);
    doc.rect(PAGE.M + 6, y + 6, 6, 18, "F");

    doc.setFont(font.base, font.bold);
    doc.setFontSize(12); doc.setTextColor(...RGB.ink);
    doc.text(title, PAGE.M + 20, y + 20);
    y += 38;
  };

  const field = async (label, value) => {
    await ensureSpace(58);
    const w = PAGE.W - PAGE.M * 2;

    doc.setFont(font.base, "normal");
    doc.setTextColor(...RGB.muted);
    doc.setFontSize(10);
    doc.text(label, PAGE.M + 10, y + 10);

    const lines = doc.splitTextToSize((value || "-").toString(), w - 20);
    const h = Math.max(34, 18 + lines.length * 13);

    doc.setDrawColor(...RGB.border);
    doc.setLineWidth(0.8);
    doc.roundedRect(PAGE.M, y + 16, w, h, 6, 6);

    doc.setFont(font.base, "normal");
    doc.setTextColor(...RGB.ink);
    doc.setFontSize(11);
    lines.forEach((ln, i) => doc.text(ln, PAGE.M + 10, y + 32 + i * 13));

    y += h + 12;
  };

  // --- NOVO: linha de campos inline (custom width) ---
  let _inline = null;
  const inlineStart = async () => {
    await ensureSpace(80);
    _inline = { x: PAGE.M, y0: y, maxH: 0 };
  };
  const fieldInline = async (label, value, widthPt) => {
    if (!_inline) await inlineStart();
    const x = _inline.x;
    const maxW = widthPt - 20;

    // label
    doc.setFont(font.base, "normal");
    doc.setTextColor(...RGB.muted);
    doc.setFontSize(10);
    doc.text(label, x + 10, _inline.y0 + 10);

    // box
    const lines = doc.splitTextToSize((value || "-").toString(), maxW);
    const h = Math.max(34, 18 + lines.length * 13);
    doc.setDrawColor(...RGB.border);
    doc.setLineWidth(0.8);
    doc.roundedRect(x, _inline.y0 + 16, widthPt, h, 6, 6);

    // valor
    doc.setFont(font.base, "normal");
    doc.setTextColor(...RGB.ink);
    doc.setFontSize(11);
    lines.forEach((ln, i) => doc.text(ln, x + 10, _inline.y0 + 32 + i * 13));

    _inline.x += widthPt + 16;
    _inline.maxH = Math.max(_inline.maxH, h);
  };
  const inlineEnd = () => {
    if (!_inline) return;
    y = _inline.y0 + _inline.maxH + 28;
    _inline = null;
  };

  const textArea = async (label, text, minH = 90) => {
    await ensureSpace(minH + 40);
    doc.setFont(font.base, "normal");
    doc.setTextColor(...RGB.muted);
    doc.setFontSize(10);
    doc.text(label, PAGE.M + 10, y + 10);

    const w = PAGE.W - PAGE.M * 2;
    const lines = doc.splitTextToSize((text || " ").toString(), w - 20);
    const h = Math.max(minH, 18 + lines.length * 13);

    doc.setDrawColor(...RGB.border);
    doc.setLineWidth(0.8);
    doc.roundedRect(PAGE.M, y + 16, w, h, 6, 6);

    doc.setFont(font.base, "normal");
    doc.setTextColor(...RGB.ink);
    doc.setFontSize(11);
    lines.forEach((ln, i) => doc.text(ln, PAGE.M + 10, y + 32 + i * 13));

    y += h + 12;
  };

  const table = async ({ cols, rows, title }) => {
    const w = PAGE.W - PAGE.M * 2;
    const colXs = [];
    let x = PAGE.M;

    if (title) {
      await ensureSpace(28);
      doc.setFont(font.base, font.bold); doc.setTextColor(...RGB.ink); doc.setFontSize(11);
      doc.text(title, PAGE.M, y + 2);
      y += 10;
    }

    await ensureSpace(40);
    doc.setFillColor(...RGB.headBg);
    doc.setDrawColor(...RGB.border);
    doc.setTextColor(...RGB.ink);
    doc.setLineWidth(0.8);
    const th = 26;

    cols.forEach((c) => { colXs.push(x); x += c.w; });
    doc.roundedRect(PAGE.M, y, w, th, 6, 6, "FD");

    doc.setFont(font.base, font.bold); doc.setFontSize(10);
    cols.forEach((c, i) => {
      doc.text(c.title, colXs[i] + 8, y + 17);
      if (i < cols.length - 1) {
        doc.setDrawColor(...RGB.border);
        doc.line(colXs[i] + c.w, y, colXs[i] + c.w, y + th);
      }
    });
    y += th;

    doc.setFont(font.base, "normal"); doc.setFontSize(10);
    rows.forEach(async (row, rIndex) => {
      const heights = cols.map((c) => {
        const txt = (row[c.key] || "-").toString();
        const innerW = c.w - 16;
        const lines = doc.splitTextToSize(txt, innerW);
        return Math.max(26, 16 + lines.length * 12);
      });
      let rowH = Math.max(...heights);

      await ensureSpace(rowH);
      doc.setDrawColor(...RGB.border);
      doc.roundedRect(PAGE.M, y, w, rowH, (rIndex === rows.length - 1 ? 6 : 0), (rIndex === rows.length - 1 ? 6 : 0), "S");

      cols.forEach((c, i) => {
        if (i < cols.length - 1) {
          doc.line(colXs[i] + c.w, y, colXs[i] + c.w, y + rowH);
        }
        const txt = (row[c.key] || "-").toString();
        const innerW = c.w - 16;
        const lines = doc.splitTextToSize(txt, innerW);
        lines.forEach((ln, k) => doc.text(ln, colXs[i] + 8, y + 16 + k * 12));
      });
      y += rowH;
    });
    y += 8;
  };

  const signatures = async (leftLabel, rightLabel, leftName = "", rightName = "") => {
    await ensureSpace(120);
    const fullW = PAGE.W - PAGE.M * 2;
    const gutter = 24;
    const colW = (fullW - gutter) / 2;

    doc.setDrawColor(...RGB.border);
    doc.setLineWidth(0.8);

    doc.text(leftLabel, PAGE.M, y + 14);
    doc.line(PAGE.M, y + 50, PAGE.M + colW, y + 50);
    if (leftName) doc.text(leftName, PAGE.M, y + 66);

    const x2 = PAGE.M + colW + gutter;
    doc.text(rightLabel, x2, y + 14);
    doc.line(x2, y + 50, x2 + colW, y + 50);
    if (rightName) doc.text(rightName, x2, y + 66);

    y += 90;
  };

  // ---------- Build ----------
  drawPageFrame();
  await drawHeader();

  // 1) Identificação
  await section("1. Identificação do Relatório");

  // --- Nº da Ficha DEVE SER COMPACTO (≈14ch) ---
  // largura sugerida ~ 140–160pt; vamos usar 150pt para boa leitura
  await inlineStart();
  await fieldInline("Nº da Ficha de Produção", (fichaProducao || "-"), 150);
  await fieldInline("Quantidade a verificar",   (qtdVerificar  || "-"), 180);
  inlineEnd();

  await field("Quando executar a inspeção", (quandoInspec || "-"));
  await inlineStart();
  await fieldInline("Data do relatório", (dataRelatorio || "-"), 180);
  inlineEnd();

  // 2) Produtos
  await section("2. Produtos Inspecionados");
  if (!produtos.length) {
    await textArea("Produtos", "Sem produtos informados.", 60);
  } else {
    const fullW = PAGE.W - PAGE.M * 2;
    const cols = [
      { key: "descricao",  title: "Descrição do produto", w: fullW * 0.40 },
      { key: "lote",       title: "Lote",                 w: fullW * 0.18 },
      { key: "data",       title: "Data",                 w: fullW * 0.18 },
      { key: "quantidade", title: "Quantidade",           w: fullW * 0.24 },
    ];
    await table({ cols, rows: produtos });
  }

  // 3) Ensaios
  await section("3. Ensaios Realizados");
  if (!ensaios.length) {
    await textArea("Ensaios", "Sem ensaios informados.", 60);
  } else {
    const fullW = PAGE.W - PAGE.M * 2;
    const cols = [
      { key: "ensaio",    title: "Ensaio realizado", w: fullW * 0.34 },
      { key: "amostras",  title: "Amostras",         w: fullW * 0.16 },
      { key: "metodo",    title: "Método",           w: fullW * 0.30 },
      { key: "resultado", title: "Resultado",        w: fullW * 0.20 },
    ];
    await table({ cols, rows: ensaios });
  }

  // 4) Observação / NBR
  await section("4. Observação e Normas");
  await field("Teste conforme NBR", (nbr.length ? nbr.join(" • ") : "—"));

  // 5) Assinaturas
  await section("5. Assinaturas");
  await signatures("Responsável pelos testes:", "Responsável pela verificação:");

  drawFooter(doc.internal.getNumberOfPages());

  // ---------- Saída ----------
  const filename = `RQ-504-01-registro-inspecao.pdf`;
  if (opts.returnBlob) return doc.output("blob");
  if (opts.save !== false) doc.save(filename);
  return null;
}
