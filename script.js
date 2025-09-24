
// ======================================================
// RQ-504-01 — SCRIPT PRINCIPAL (versão corrigida)
// — Observações + Norma -> aparecem em PDF/Imprimir
// — "Quando executar" formatado dd/MM/yyyy (flexível)
// — Ensaios/Métodos: valores consistentes com o HTML
// — PDF/Impressão usam o TEXTO dos selects (labels), não só o value
// ======================================================

"use strict";

// ----------------------
// ELEMENTOS
// ----------------------
const form = document.getElementById("formRelatorio");
const btnSalvar = document.getElementById("btnSalvar");
const btnPDF = document.getElementById("btnPDF");
const btnImprimir = document.getElementById("btnImprimir");
const listaRelatorios = document.getElementById("listaRelatorios");
const ariaLive = document.getElementById("ariaLive");
const anoRodape = document.getElementById("ano");

const fileInput = document.getElementById("fileInput");
const uploadArea = document.getElementById("uploadArea");
const imagePreview = document.getElementById("imagePreview");

// Novos campos (observações + norma única)
const txtObservacoes = document.getElementById("observacoes");
const selNorma = document.getElementById("norma");

// ----------------------
// UTILS
// ----------------------
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// YYYY-MM-DD -> dd/MM/yyyy (uso para dataRelatorio)
function formatarDataBR(isoDate) {
  if (!isoDate) return "-";
  const [ano, mes, dia] = String(isoDate).split("-");
  if (!ano || !mes || !dia) return isoDate;
  return `${dia}/${mes}/${ano}`;
}

// Formata vários formatos (YYYY-MM-DD, YYYY/MM/DD, YYYY-MM-DDTHH:mm, dd/MM/yyyy) para dd/MM/yyyy
// (usada para "quandoexecutarinspecao", que pode vir de datetime-local)
function formatarDataFlexBR(valor) {
  if (!valor) return "-";
  const s = String(valor).trim();
  const semHora = s.split("T")[0].replace(/\//g, "-"); // tira hora e normaliza separadores
  const partes = semHora.split("-");
  if (partes.length === 3) {
    const [a, b, c] = partes;
    if (a.length === 4) {
      // yyyy-mm-dd
      return `${c.padStart(2, "0")}/${b.padStart(2, "0")}/${a}`;
    }
    if (c.length === 4) {
      // dd-mm-yyyy
      return `${a.padStart(2, "0")}/${b.padStart(2, "0")}/${c}`;
    }
  }
  // fallback
  const d = new Date(s);
  if (!isNaN(d)) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  return s;
}

// Pega {value, label} do <select>
function getSelectValueAndLabel(selectEl) {
  if (!selectEl) return { value: "", label: "" };
  const idx = selectEl.selectedIndex;
  const opt = idx >= 0 ? selectEl.options[idx] : null;
  return {
    value: selectEl.value || "",
    label: opt ? opt.text : ""
  };
}

// ----------------------
// GERAR RELATÓRIO (obj)
// ----------------------
function gerarRelatorio() {
  const dados = {};

  // Identificação
  dados.identificacao = {
    ordemProducao: form.ordemProducao?.value || "",
    quantidadeaverificar: form.quantidadeaverificar?.value || "",
    quandoexecutarinspecao: form.quandoexecutarinspecao?.value || "", // guardamos o original
    dataRelatorio: form.dataRelatorio?.value || "",                   // yyyy-mm-dd
  };

  // Produtos
  dados.produtos = [];
  form.querySelectorAll("#tabelaProdutos tbody tr").forEach((tr) => {
    const produto = {
      descricao: tr.querySelector("input[name='descricao[]']")?.value || "",
      lote: tr.querySelector("input[name='lote[]']")?.value || "",
      data: tr.querySelector("input[name='data[]']")?.value || "",
      quantidade: tr.querySelector("input[name='quantidade[]']")?.value || "",
    };
    if (produto.descricao) dados.produtos.push(produto);
  });

  // Ensaios (salvamos value e label para mostrar corretamente no PDF/print)
  dados.ensaios = [];
  form.querySelectorAll("#tabelaEnsaios tbody tr").forEach((tr) => {
    const ensaioSel = tr.querySelector("select[name='ensaio[]']");
    const amostrasSel = tr.querySelector("select[name='amostras[]']");
    const metodoSel = tr.querySelector("select[name='metodo[]']");
    const resultadoSel = tr.querySelector("select[name='resultado[]']");

    const tipo = getSelectValueAndLabel(ensaioSel);
    const amostras = getSelectValueAndLabel(amostrasSel);
    const metodo = getSelectValueAndLabel(metodoSel);
    const resultado = getSelectValueAndLabel(resultadoSel);

    if (tipo.value) {
      dados.ensaios.push({
        tipo: tipo.value,
        tipoLabel: tipo.label,
        amostras: amostras.value,
        amostrasLabel: amostras.label || amostras.value,
        metodo: metodo.value,
        metodoLabel: metodo.label,
        resultado: resultado.value,
        resultadoLabel: resultado.label
      });
    }
  });

  // Observações + Norma
  const norma = getSelectValueAndLabel(selNorma);
  dados.observacoes = txtObservacoes?.value?.trim() || "";
  dados.norma = norma.value || "";
  dados.normaLabel = norma.label || norma.value;

  // Fotos (dataURL)
  dados.fotos = [];
  imagePreview.querySelectorAll("img").forEach((img) => {
    dados.fotos.push(img.src);
  });

  return dados;
}

// ----------------------
// LISTA LATERAL
// ----------------------
function atualizarListaRelatorios() {
  listaRelatorios.innerHTML = "";

  const chaves = Object.keys(localStorage).filter(k => k.startsWith("relatorio_"));
  chaves.sort(); // deixa previsível
  chaves.forEach((chave) => {
    let dados;
    try { dados = JSON.parse(localStorage.getItem(chave)); } catch { return; }
    if (!dados) return;

    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.justifyContent = "space-between";
    li.style.alignItems = "center";
    li.style.marginBottom = "4px";

    const span = document.createElement("span");
    span.textContent = `#${dados.identificacao?.ordemProducao || "?"} (${dados.identificacao?.dataRelatorio || "sem data"})`;
    span.style.cursor = "pointer";
    span.addEventListener("click", () => carregarRelatorio(dados));

    const btnExcluir = document.createElement("button");
    btnExcluir.textContent = "❌";
    btnExcluir.style.border = "none";
    btnExcluir.style.background = "transparent";
    btnExcluir.style.cursor = "pointer";
    btnExcluir.title = "Excluir relatório";
    btnExcluir.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm("Tem certeza que deseja excluir este relatório?")) {
        localStorage.removeItem(chave);
        atualizarListaRelatorios();
        ariaLive.textContent = "🗑️ Relatório excluído.";
      }
    });

    li.appendChild(span);
    li.appendChild(btnExcluir);
    listaRelatorios.appendChild(li);
  });
}

// ----------------------
// SALVAR / CARREGAR
// ----------------------
function salvarRelatorio() {
  const dados = gerarRelatorio();
  if (!dados.identificacao.ordemProducao) {
    alert("Preencha ao menos o Nº da Ficha de Produção.");
    return;
  }
  const chave = `relatorio_${dados.identificacao.ordemProducao}`;
  localStorage.setItem(chave, JSON.stringify(dados));
  atualizarListaRelatorios();
  ariaLive.textContent = "✅ Relatório salvo com sucesso.";
}

function carregarRelatorio(dados) {
  form.ordemProducao.value = dados.identificacao?.ordemProducao || "";
  form.quantidadeaverificar.value = dados.identificacao?.quantidadeaverificar || "";
  form.quandoexecutarinspecao.value = dados.identificacao?.quandoexecutarinspecao || "";
  form.dataRelatorio.value = dados.identificacao?.dataRelatorio || "";

  if (txtObservacoes) txtObservacoes.value = dados.observacoes || "";
  if (selNorma) selNorma.value = dados.norma || "";

  // limpar tabelas
  document.querySelector("#tabelaProdutos tbody").innerHTML = "";
  document.querySelector("#tabelaEnsaios tbody").innerHTML = "";

  // carregar produtos
  (dados.produtos || []).forEach((p) => adicionarProduto(p));

  // carregar ensaios (setando por value; se não existir, fica vazio)
  (dados.ensaios || []).forEach((e) => adicionarEnsaio(e));

  // carregar imagens
  imagePreview.innerHTML = "";
  (dados.fotos || []).forEach((src) => {
    const img = document.createElement("img");
    img.src = src;
    imagePreview.appendChild(img);
  });

  ariaLive.textContent = "📂 Relatório carregado.";
}

// ----------------------
// PDF
// ----------------------
function exportarPDF() {
  const dados = gerarRelatorio();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const agora = new Date();
  const dataHora = agora.toLocaleDateString("pt-BR") + " " + agora.toLocaleTimeString("pt-BR");

  const logo = new Image();
  logo.src = "shiva.png";

  logo.onload = function () {
    // Cabeçalho
    doc.setDrawColor(225, 38, 45);
    doc.setLineWidth(1.2);
    try { doc.addImage(logo, "PNG", 5, 10, 20, 20); } catch {}

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(14, 53, 84);
    doc.text("RQ-504-01 — REGISTRO DE INSPEÇÃO", 120, 60);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(`Emitido em: ${dataHora}`, 400, 60);

    doc.line(40, 100, 550, 100);

    // 1. Identificação
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(14, 53, 84);
    doc.text("1. IDENTIFICAÇÃO", 40, 120);

    doc.autoTable({
      startY: 130,
      theme: "grid",
      headStyles: { fillColor: [14, 53, 84], textColor: 255, fontStyle: "bold", halign: "center" },
      alternateRowStyles: { fillColor: [240, 245, 250] },
      bodyStyles: { fontSize: 10 },
      head: [["Nº Ficha", "Qtd Verificar", "Quando Executar", "Data"]],
      body: [[
        dados.identificacao.ordemProducao || "-",
        dados.identificacao.quantidadeaverificar || "-",
        formatarDataFlexBR(dados.identificacao.quandoexecutarinspecao),
        formatarDataBR(dados.identificacao.dataRelatorio)
      ]]
    });

    // 2. Produtos
    doc.setTextColor(14, 53, 84);
    doc.text("2. PRODUTOS INSPECIONADOS", 40, doc.lastAutoTable.finalY + 30);
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 40,
      theme: "grid",
      headStyles: { fillColor: [14, 53, 84], textColor: 255, fontStyle: "bold", halign: "center" },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      bodyStyles: { fontSize: 10 },
      head: [["Produto", "Lote", "Data", "Quantidade"]],
      body: (dados.produtos || []).map((p) => [
        p.descricao || "-",
        p.lote || "-",
        formatarDataBR(p.data),
        p.quantidade || "-",
      ]),
    });

    // 3. Ensaios (usando labels)
    doc.setTextColor(14, 53, 84);
    doc.text("3. ENSAIOS REALIZADOS", 40, doc.lastAutoTable.finalY + 30);
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 40,
      theme: "grid",
      headStyles: { fillColor: [14, 53, 84], textColor: 255, fontStyle: "bold", halign: "center" },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      bodyStyles: { fontSize: 10 },
      head: [["Ensaio", "Amostras", "Método", "Resultado"]],
      body: (dados.ensaios || []).map((e) => [
        e.tipoLabel || e.tipo || "-",
        e.amostrasLabel || e.amostras || "-",
        e.metodoLabel || e.metodo || "-",
        e.resultadoLabel || e.resultado || "-",
      ]),
    });

    // 4. Observações + Norma
    doc.setTextColor(14, 53, 84);
    doc.text("4. OBSERVAÇÕES E NORMA", 40, doc.lastAutoTable.finalY + 30);
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 40,
      theme: "grid",
      headStyles: { fillColor: [14, 53, 84], textColor: 255, fontStyle: "bold", halign: "center" },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      bodyStyles: { fontSize: 10, valign: "top" },
      columnStyles: { 0: { cellWidth: 380 }, 1: { cellWidth: 130 } },
      head: [["Observações", "Norma"]],
      body: [[dados.observacoes || "—", dados.normaLabel || "—"]],
    });

    // 5. Fotos
    let y = doc.lastAutoTable.finalY + 30;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(14, 53, 84);
    doc.text("5. REGISTRO FOTOGRÁFICO", 40, y);

    y += 20;
    const imgSize = 80;
    const margin = 12;
    let x = 40;
    let col = 0;

    for (let src of (dados.fotos || [])) {
      try {
        const fmt = /^data:image\/png/i.test(src) ? "PNG" : "JPEG";
        doc.addImage(src, fmt, x, y, imgSize, imgSize);
      } catch (err) {
        console.warn("Erro ao carregar imagem:", err);
      }
      x += imgSize + margin;
      col++;
      if (col === 5) {
        col = 0;
        x = 40;
        y += imgSize + margin;
      }
    }

    // Assinaturas
    const paginaAltura = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0);

    doc.line(60, paginaAltura - 120, 250, paginaAltura - 120);
    doc.text("Responsável Técnico", 100, paginaAltura - 105);

    doc.line(300, paginaAltura - 120, 500, paginaAltura - 120);
    doc.text("Supervisor", 370, paginaAltura - 105);

    doc.line(60, paginaAltura - 70, 250, paginaAltura - 70);
    doc.text("Data / Assinatura", 100, paginaAltura - 55);

    doc.line(300, paginaAltura - 70, 500, paginaAltura - 70);
    doc.text("Cliente / Representante", 340, paginaAltura - 55);

    // Rodapé
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `Relatório gerado automaticamente pelo sistema RQ-504-01 | Emitido em: ${dataHora}`,
      40,
      paginaAltura - 30
    );

    // Salvar
    doc.save(`Relatorio_${dados.identificacao.ordemProducao || "sem_numero"}.pdf`);
  };
}

// ----------------------
// IMPRESSÃO (usa labels)
// ----------------------
function imprimirRelatorio() {
  const dados = gerarRelatorio();
  const agora = new Date();
  const dataHora = agora.toLocaleDateString("pt-BR") + " " + agora.toLocaleTimeString("pt-BR");

  const html = `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Relatório de Inspeção</title>
    <style>
      body { font-family: "Helvetica", Arial, sans-serif; margin: 40px; color: #0E3554; line-height: 1.5; }
      header { display: flex; align-items: center; border-bottom: 3px solid #E1262D; padding-bottom: 12px; margin-bottom: 25px; }
      header img { width: 70px; height: 70px; margin-right: 18px; }
      header h1 { font-size: 1.6rem; margin: 0; color: #0E3554; }
      header small { display: block; font-size: 0.8rem; color: #5C6B84; }
      section { margin-bottom: 28px; }
      h2 { font-size: 1.15rem; margin-bottom: 10px; border-left: 5px solid #0E3554; padding-left: 8px; color: #0E3554; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { border: 1px solid #ccc; padding: 8px; font-size: 0.9rem; }
      th { background: #0E3554; color: white; text-align: center; }
      tr:nth-child(even) td { background: #f6f8fb; }
      .assinaturas { margin-top: 60px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 60px; text-align: center; }
      .assinaturas div { border-top: 1px solid #000; padding-top: 6px; font-size: 0.9rem; }
      footer { font-size: 0.75rem; color: #555; text-align: center; margin-top: 50px; border-top: 1px solid #ddd; padding-top: 6px; }
      .fotos img { max-width: 120px; margin: 5px; border: 1px solid #ccc; border-radius: 6px; }
    </style>
  </head>
  <body>
    <header>
      <img src="shiva.png" alt="Logo">
      <div>
        <h1>RQ-504-01 — Registro de Inspeção</h1>
        <small>Emitido em: ${dataHora}</small>
      </div>
    </header>

    <section>
      <h2>1. Identificação</h2>
      <table>
        <tr><th>Nº Ficha</th><td>${escapeHtml(dados.identificacao.ordemProducao) || "-"}</td></tr>
        <tr><th>Qtd Verificar</th><td>${escapeHtml(dados.identificacao.quantidadeaverificar) || "-"}</td></tr>
        <tr><th>Quando Executar</th><td>${escapeHtml(formatarDataFlexBR(dados.identificacao.quandoexecutarinspecao))}</td></tr>
        <tr><th>Data</th><td>${formatarDataBR(dados.identificacao.dataRelatorio)}</td></tr>
      </table>
    </section>

    <section>
      <h2>2. Produtos Inspecionados</h2>
      <table>
        <thead>
          <tr><th>Produto</th><th>Lote</th><th>Data</th><th>Qtd</th></tr>
        </thead>
        <tbody>
          ${(dados.produtos || []).map(p => `
            <tr>
              <td>${escapeHtml(p.descricao) || "-"}</td>
              <td>${escapeHtml(p.lote) || "-"}</td>
              <td>${formatarDataBR(p.data)}</td>
              <td style="text-align:center">${escapeHtml(p.quantidade) || "-"}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </section>

    <section>
      <h2>3. Ensaios Realizados</h2>
      <table>
        <thead>
          <tr><th>Ensaio</th><th>Amostras</th><th>Método</th><th>Resultado</th></tr>
        </thead>
        <tbody>
          ${(dados.ensaios || []).map(e => `
            <tr>
              <td>${escapeHtml(e.tipoLabel || e.tipo) || "-"}</td>
              <td style="text-align:center">${escapeHtml(e.amostrasLabel || e.amostras) || "-"}</td>
              <td>${escapeHtml(e.metodoLabel || e.metodo) || "-"}</td>
              <td style="text-align:center">${escapeHtml(e.resultadoLabel || e.resultado) || "-"}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </section>

    <section>
      <h2>4. Observações e Norma</h2>
      <table>
        <tr><th>Observações</th><td>${escapeHtml(dados.observacoes) || "-"}</td></tr>
        <tr><th>Norma</th><td>${escapeHtml(dados.normaLabel) || "-"}</td></tr>
      </table>
    </section>

    <section>
      <h2>5. Registro Fotográfico</h2>
      <div class="fotos">
        ${(dados.fotos && dados.fotos.length)
          ? dados.fotos.map(f => `<img src="${f}" alt="Foto do relatório">`).join("")
          : "<p>Nenhuma foto anexada</p>"}
      </div>
    </section>

    <div class="assinaturas">
      <div>Responsável Técnico</div>
      <div>Supervisor</div>
      <div>Data / Assinatura</div>
      <div>Cliente / Representante</div>
    </div>

    <footer>
      Relatório gerado automaticamente pelo sistema RQ-504-01 — ${dataHora}
    </footer>
  </body>
  </html>
  `;

  const w = window.open("", "PRINT", "height=700,width=900");
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

// ----------------------
// ADICIONAR/REMOVER LINHAS
// ----------------------
function adicionarProduto(p = {}) {
  const tbody = document.querySelector("#tabelaProdutos tbody");
  const template = tbody.querySelector("tr");
  const tr = template ? template.cloneNode(true) : document.createElement("tr");

  if (!template) {
    tr.innerHTML = `
      <td><input type="text" name="descricao[]" value="" required placeholder="Produto"></td>
      <td><input type="text" name="lote[]" value="" placeholder="Lote"></td>
      <td><input type="date" name="data[]" value=""></td>
      <td><input type="number" name="quantidade[]" min="1" value=""></td>
      <td><button type="button" class="remover" aria-label="Remover linha">❌</button></td>
    `;
  }

  tr.querySelector("input[name='descricao[]']").value = p.descricao || "";
  tr.querySelector("input[name='lote[]']").value = p.lote || "";
  tr.querySelector("input[name='data[]']").value = p.data || "";
  tr.querySelector("input[name='quantidade[]']").value = p.quantidade || "";

  tbody.appendChild(tr);
}

function adicionarEnsaio(e = {}) {
  const tbody = document.querySelector("#tabelaEnsaios tbody");
  const template = tbody.querySelector("tr");
  const tr = template ? template.cloneNode(true) : document.createElement("tr");

  if (!template) {
    // valores/labels iguais ao HTML atualizado
    tr.innerHTML = `
      <td>
        <select name="ensaio[]" required>
          <option value="">Selecione...</option>
          <option value="phi">Pressão hidrostática (PHI)</option>
          <option value="vacuo">Vácuo</option>
          <option value="dimensional">Dimensional</option>
          <option value="marcacoes">Marcações</option>
          <option value="achatamento">Achatamento</option>
          <option value="calor">Comportamento ao calor</option>
          <option value="impacto">Resistência ao impacto</option>
          <option value="estanquiedade_anel">Estanquiedade da junta com anel de vedação elastomérico</option>
          <option value="mecanica_flexibilidade">Resistência mecânica ou flexibilidade</option>
        </select>
      </td>
      <td>
        <select name="amostras[]" required>
          <option value="">Selecione...</option>
          ${["01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","20","32","50","80","125"].map(n=>`<option value="${n}">${n}</option>`).join("")}
        </select>
      </td>
      <td>
        <select name="metodo[]" required>
          <option value="0.5_kgf_15min">0,5 Kgf/cm² × 15 min</option>
          <option value="2_kgf_15min">2 Kgf/cm² × 15 min</option>
          <option value="-0.3_bar_15min">-0,3 Bar × 15 min</option>
          <option value="gabarito">Gabarito</option>
          <option value="visual">Visual</option>
          <option value="deflexao_30">Deflexão de (X) 30%</option>
          <option value="150c_30min">150º ± 2º × 15 min</option>
          <option value="150c_30min">150º ± 2º × 30 min</option>
          <option value="Alturadequeda">Altura de Queda 500 mm</option>
          <option value="Alturadequeda">Altura de Queda 1000 mm</option>
          <option value="Alturadequeda">Altura de Queda 2000 mm</option>
          <option value="deflexao_ponta_10">Deflexão da ponta ≥10%</option>
          <option value="deflexao_bolsa_5">Deflexão da bolsa ≥5%</option>
          <option value="diferenca_5">Diferença ≥5%</option>
          <option value="deflexao_ang_le_315">Deflexão Angular dn ≤ 315 mm 2º</option>
          <option value="deflexao_ang_315_630">Deflexão Angular 315 mm &lt; dn ≤ 630 mm 1,5º</option>
          <option value="deflexao_ang_gt_630">Deflexão Angular dn &gt; 630 mm 1º</option>
        </select>
      </td>
      <td>
        <select name="resultado[]" required>
          <option value="">Selecione...</option>
          <option value="aprovado">Aprovado</option>
          <option value="reprovado">Reprovado</option>
        </select>
      </td>
      <td><button type="button" class="remover" aria-label="Remover linha">❌</button></td>
    `;
  }

  // set values (se value não existir no HTML, fica vazio)
  tr.querySelector("select[name='ensaio[]']").value   = e.tipo || "";
  tr.querySelector("select[name='amostras[]']").value = e.amostras || "";
  tr.querySelector("select[name='metodo[]']").value   = e.metodo || "";
  tr.querySelector("select[name='resultado[]']").value= e.resultado || "";

  tbody.appendChild(tr);
}

// Remover linhas (delegação)
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("remover")) {
    e.target.closest("tr")?.remove();
  }
});

// ----------------------
// UPLOAD DE FOTOS
// ----------------------
function handleFiles(files) {
  for (let file of files) {
    if (!file.type.startsWith("image/")) continue;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement("img");
      img.src = e.target.result;
      imagePreview.appendChild(img);
    };
    reader.readAsDataURL(file);
  }
}
fileInput?.addEventListener("change", () => handleFiles(fileInput.files));
uploadArea?.addEventListener("dragover", (e) => { e.preventDefault(); uploadArea.classList.add("dragover"); });
uploadArea?.addEventListener("dragleave", () => uploadArea.classList.remove("dragover"));
uploadArea?.addEventListener("drop", (e) => { e.preventDefault(); uploadArea.classList.remove("dragover"); handleFiles(e.dataTransfer.files); });

// ----------------------
// TEMA (dialog + persistência)
// ----------------------
const btnTemas = document.getElementById("btnTemas");
const dlgTemas = document.getElementById("dlgTemas");

function aplicarTema(tema) {
  if (!tema) return;
  document.documentElement.setAttribute("data-theme", tema);
  localStorage.setItem("tema", tema);
  const radio = dlgTemas?.querySelector(`input[name='tema'][value="${tema}"]`);
  if (radio) radio.checked = true;
}
btnTemas?.addEventListener("click", () => {
  dlgTemas?.showModal();
  const primeiroRadio = dlgTemas?.querySelector("input[name='tema']");
  if (primeiroRadio) primeiroRadio.focus();
});
dlgTemas?.addEventListener("submit", (e) => {
  e.preventDefault();
  const temaSelecionado = dlgTemas?.querySelector("input[name='tema']:checked");
  if (temaSelecionado) aplicarTema(temaSelecionado.value);
  dlgTemas?.close();
});
dlgTemas?.addEventListener("click", (e) => {
  const rect = dlgTemas.getBoundingClientRect();
  if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
    dlgTemas.close();
  }
});
document.addEventListener("DOMContentLoaded", () => {
  const temaSalvo = localStorage.getItem("tema");
  if (temaSalvo) aplicarTema(temaSalvo);
});

// ----------------------
// EVENTOS / INICIALIZAÇÃO
// ----------------------
document.getElementById("addLinha")?.addEventListener("click", () => adicionarProduto());
document.getElementById("addEnsaio")?.addEventListener("click", () => adicionarEnsaio());

btnSalvar?.addEventListener("click", salvarRelatorio);
btnPDF?.addEventListener("click", exportarPDF);
btnImprimir?.addEventListener("click", imprimirRelatorio);

if (anoRodape) anoRodape.textContent = new Date().getFullYear();
atualizarListaRelatorios();

