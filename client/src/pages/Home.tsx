import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertCircle, Download, RotateCcw, Printer, LogOut, Search, Sparkles, FileSpreadsheet,
  Loader2, ShieldCheck, FileText, History, Lightbulb, MessageCircle, Send, Moon, Sun, Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip, Legend } from "recharts";
import { useAuth } from "@/contexts/AuthContext";

type Issue = { ponto: string; detalhe: string; responsavel: string; projeto: string; unidade: string };
type Validacao = Issue & { tipo: string };
type FieldDistribution = { campo: string; itens: [string, number][]; total: number };

interface RelatorioData {
  camposBranco: Issue[];
  violacoesZero: Issue[];
  validacoes: Validacao[];
  distribuicoes: FieldDistribution[];
  fileName: string;
  sheetName: string;
  totalPontos: number;
  pontosComProblema: number;
  dataGeracao: Date;
}

const CAMPO_ISENTO = "Coloração";
const CAMPOS_REGRA_ZERO = ["Tipo Solo", "Munsell", "Textura"];
const COL = { prof: "Profundidade", ponto: "Ponto", resp: "Responsável", proj: "Projeto", uni: "Unidade", x: "UTM X", y: "UTM Y", data: "Data", munsell: "Munsell" };

const norm = (v: any) => (v === null || v === undefined ? "" : String(v).trim());
const nk = (s: string) => norm(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function isProfundidadeZero(v: any): boolean {
  let s = norm(v).toLowerCase().replace(/\s/g, "").replace("cm", "").replace(",", ".");
  if (s === "") return false;
  const n = parseFloat(s);
  return !isNaN(n) && n === 0;
}
function listar(a: string[]) { return a.length <= 1 ? a.join("") : a.length === 2 ? a.join(" e ") : a.slice(0, -1).join(", ") + " e " + a.slice(-1); }
const soDigitos = (v: string) => norm(v).replace(/[^\d]/g, "");
const dataValida = (v: string) => { const m = norm(v).match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (!m) return false; const d = +m[1], mo = +m[2]; return d >= 1 && d <= 31 && mo >= 1 && mo <= 12; };
const profValida = (v: string) => /^[\d.,]+\s*(cm|m)?$/i.test(norm(v));
const munsellValido = (v: string) => /^\d(\.\d)?\s?(yr|r|y|gy|g|bg|b|pb|p|rp)\s?\d(\.\d)?\/\d+/i.test(norm(v)) || nk(v) === "nao se aplica";

export default function Home() {
  const { user, logout } = useAuth();
  const [relatorio, setRelatorio] = useState<RelatorioData | null>(null);
  const [erro, setErro] = useState("");
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroResp, setFiltroResp] = useState("");
  const [aiTexto, setAiTexto] = useState(""); const [aiCarregando, setAiCarregando] = useState(false); const [aiErro, setAiErro] = useState("");
  const [sugestoes, setSugestoes] = useState<Array<{ ponto: string; campo: string; sugestao: string }>>([]); const [sugCarregando, setSugCarregando] = useState(false);
  const [chatMsgs, setChatMsgs] = useState<Array<{ q: string; a: string }>>([]); const [chatInput, setChatInput] = useState(""); const [chatCarregando, setChatCarregando] = useState(false);
  const [historico, setHistorico] = useState<any[]>(() => { try { return JSON.parse(localStorage.getItem("arqueo_hist") || "[]"); } catch { return []; } });
  const [mostrarHist, setMostrarHist] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("arqueo_dark") === "1");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => { document.documentElement.classList.toggle("dark", dark); localStorage.setItem("arqueo_dark", dark ? "1" : "0"); }, [dark]);

  // -------- Leitura de arquivo(s): xlsx + csv + múltiplos --------
  const handleFiles = async (files: FileList | File[]) => {
    setErro("");
    const arr = Array.from(files); if (!arr.length) return;
    setNomeArquivo(arr.length === 1 ? arr[0].name : `${arr.length} arquivos`);
    try {
      const XLSX = await import("xlsx");
      // Lê todos os arquivos como objetos {header,rows} e os combina ALINHANDO por nome de coluna,
      // de forma que arquivos com ordem de colunas diferente não desalinhem os dados.
      const lidos: Array<{ header: string[]; rows: any[][] }> = [];
      let sheetName = "";
      for (const f of arr) {
        const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: "array" });
        const sn = wb.SheetNames.find((n) => nk(n) === "pontos") || wb.SheetNames[0];
        sheetName = sn;
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: "" }) as any[][];
        if (rows.length) lidos.push({ header: rows[0].map(norm), rows: rows.slice(1) });
      }
      if (!lidos.length) { setErro("A planilha não contém dados."); return; }
      // Cabeçalho mestre = união de todas as colunas (preserva ordem do 1º arquivo).
      const master: string[] = []; const masterSet = new Set<string>();
      lidos.forEach((l) => l.header.forEach((h) => { if (h && !masterSet.has(nk(h))) { masterSet.add(nk(h)); master.push(h); } }));
      const linhas: any[][] = [];
      lidos.forEach((l) => { const map = l.header.map((h) => master.findIndex((mh) => nk(mh) === nk(h)));
        l.rows.forEach((row) => { const novo = new Array(master.length).fill(""); row.forEach((cell, i) => { if (map[i] >= 0) novo[map[i]] = cell; }); linhas.push(novo); }); });
      processar([master, ...linhas], arr.length === 1 ? arr[0].name : `${arr.length} arquivos combinados`, sheetName);
    } catch (err: any) { setErro("Não foi possível ler o arquivo: " + err.message); }
  };

  const processar = (rows: any[][], fileName: string, sheetName: string) => {
    if (!rows || rows.length < 2) { setErro("A planilha não contém dados."); return; }
    const header = rows[0].map(norm);
    const idx: Record<string, number> = {}; header.forEach((h, i) => (idx[nk(h)] = i));
    const c = (n: string) => idx[nk(n)];
    if ([COL.ponto, COL.resp].some((x) => c(x) === undefined)) { setErro("Colunas essenciais não encontradas: Ponto, Responsável"); return; }
    const iP = c(COL.ponto), iR = c(COL.resp), iPr = c(COL.prof), iIs = c(CAMPO_ISENTO), iProj = c(COL.proj), iUni = c(COL.uni);
    const meta = (row: any[]) => ({ projeto: iProj !== undefined ? norm(row[iProj]) : "", unidade: iUni !== undefined ? norm(row[iUni]) : "" });

    const camposBranco: Issue[] = [], violacoesZero: Issue[] = [], validacoes: Validacao[] = [];
    const distCols = new Set(["vegetacao", "vegetação", "status", "tipo solo", "uso do solo", "declive", "munsell", "profundidade", "textura", "coloracao", "coloração"]);
    const distSkip = new Set([nk(COL.ponto), nk(COL.resp), nk(COL.proj), nk(COL.uni), nk(COL.x), nk(COL.y), nk(COL.data), "observacao", "observação"]);
    const distMap: Record<number, Map<string, number>> = {};
    header.forEach((h, i) => {
      const key = nk(h);
      if (h && !distSkip.has(key)) distMap[i] = new Map();
    });
    const pontosProblema = new Set<string>(); const contagemPonto: Record<string, number> = {}; let totalPontos = 0;

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]; const ponto = norm(row[iP]); if (!ponto) continue;
      totalPontos++; contagemPonto[ponto] = (contagemPonto[ponto] || 0) + 1;
      Object.entries(distMap).forEach(([col, m]) => {
        const valor = norm(row[Number(col)]);
        if (valor) m.set(valor, (m.get(valor) || 0) + 1);
      });
      const resp = norm(row[iR]) || "(sem responsável)"; const m = meta(row);
      // Regra 1 (original) — campos em branco exceto Coloração
      for (let col = 0; col < header.length; col++) {
        if (!header[col] || col === iIs || nk(header[col]) === nk(CAMPO_ISENTO)) continue;
        if (norm(row[col]) === "") { camposBranco.push({ ponto, detalhe: header[col], responsavel: resp, ...m }); pontosProblema.add(ponto); }
      }
      // Regra 2 (original) — profundidade 0,0
      if (iPr !== undefined && isProfundidadeZero(row[iPr])) {
        const errados = CAMPOS_REGRA_ZERO.filter((campo) => { const ci = c(campo); return ci !== undefined && nk(row[ci]) !== "nao se aplica"; });
        if (errados.length) { violacoesZero.push({ ponto, detalhe: listar(errados), responsavel: resp, ...m }); pontosProblema.add(ponto); }
      }
      // (2) Validações adicionais — só checam valores PREENCHIDOS porém irregulares
      const add = (tipo: string, detalhe: string) => { validacoes.push({ ponto, tipo, detalhe, responsavel: resp, ...m }); pontosProblema.add(ponto); };
      if (iPr !== undefined && norm(row[iPr]) && !profValida(row[iPr]) && !isProfundidadeZero(row[iPr])) add("Profundidade inválida", norm(row[iPr]));
      const xv = c(COL.x), yv = c(COL.y);
      if (xv !== undefined && norm(row[xv])) { const n = +soDigitos(row[xv]); if (!n || n < 100000 || n > 999999) add("UTM X fora de faixa", norm(row[xv])); }
      if (yv !== undefined && norm(row[yv])) { const n = +soDigitos(row[yv]); if (!n || n < 1000000 || n > 10000000) add("UTM Y fora de faixa", norm(row[yv])); }
      const dv = c(COL.data);
      if (dv !== undefined && norm(row[dv]) && !dataValida(row[dv])) add("Data inválida", norm(row[dv]));
      const mv = c(COL.munsell);
      if (mv !== undefined && norm(row[mv]) && !munsellValido(row[mv])) add("Munsell fora do padrão", norm(row[mv]));
    }
    // (3) Duplicidade de pontos
    Object.entries(contagemPonto).filter(([, q]) => q > 1).forEach(([p, q]) => validacoes.push({ ponto: p, tipo: "Ponto duplicado", detalhe: `${q} ocorrências`, responsavel: "—", projeto: "", unidade: "" }));

    const distribuicoes = Object.entries(distMap).map(([col, m]) => {
      const campo = header[Number(col)];
      const itens = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
      return { campo, itens, total: itens.reduce((s, [, q]) => s + q, 0) };
    }).filter((d) => d.total > 0 && (distCols.has(nk(d.campo)) || d.itens.length <= 18)).slice(0, 18);

    setAiTexto(""); setAiErro(""); setSugestoes([]); setChatMsgs([]); setBusca(""); setFiltroResp("");
    const rel: RelatorioData = { camposBranco, violacoesZero, validacoes, distribuicoes, fileName, sheetName, totalPontos, pontosComProblema: pontosProblema.size, dataGeracao: new Date() };
    setRelatorio(rel);
    // (8) Histórico
    const score = totalPontos ? Math.round(((totalPontos - pontosProblema.size) / totalPontos) * 100) : 100;
    const reg = { id: Date.now(), data: new Date().toLocaleString("pt-BR"), arquivo: fileName, totalPontos, branco: camposBranco.length, viol: violacoesZero.length, extras: validacoes.length, total: camposBranco.length + violacoesZero.length + validacoes.length, score };
    setHistorico((h) => { const n = [reg, ...h].slice(0, 50); localStorage.setItem("arqueo_hist", JSON.stringify(n)); return n; });
  };

  const reset = () => { setRelatorio(null); setErro(""); setNomeArquivo(""); setAiTexto(""); setSugestoes([]); setChatMsgs([]); setBusca(""); setFiltroResp(""); if (fileInputRef.current) fileInputRef.current.value = ""; };

  // -------- Filtros --------
  const ok = (resp: string, ...campos: string[]) => { if (filtroResp && resp !== filtroResp) return false; if (!busca.trim()) return true; const q = busca.trim().toLowerCase(); return [resp, ...campos].some((x) => x.toLowerCase().includes(q)); };
  const brancoF = useMemo(() => relatorio?.camposBranco.filter((b) => ok(b.responsavel, b.ponto, b.detalhe)) || [], [relatorio, busca, filtroResp]);
  const violF = useMemo(() => relatorio?.violacoesZero.filter((b) => ok(b.responsavel, b.ponto, b.detalhe)) || [], [relatorio, busca, filtroResp]);
  const valF = useMemo(() => relatorio?.validacoes.filter((b) => ok(b.responsavel, b.ponto, b.tipo, b.detalhe)) || [], [relatorio, busca, filtroResp]);

  // -------- Agregações --------
  const todas = useMemo(() => relatorio ? [...relatorio.camposBranco, ...relatorio.violacoesZero, ...relatorio.validacoes] : [], [relatorio]);
  const agrupar = (campo: "responsavel" | "projeto" | "unidade") => { const m: Record<string, number> = {}; todas.forEach((x: any) => { const k = x[campo] || "(vazio)"; if (campo !== "responsavel" && !x[campo]) return; m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const porResp = agrupar("responsavel"), porProj = agrupar("projeto"), porUni = agrupar("unidade");
  const responsaveis = porResp.map(([n]) => n);
  const totalOrig = (relatorio?.camposBranco.length || 0) + (relatorio?.violacoesZero.length || 0);
  const score = relatorio && relatorio.totalPontos ? Math.round(((relatorio.totalPontos - relatorio.pontosComProblema) / relatorio.totalPontos) * 100) : 100;
  const pieData = relatorio ? [
    { name: "Campos em branco", value: relatorio.camposBranco.length, fill: "#f59e0b" },
    { name: "Violação 0,0 cm", value: relatorio.violacoesZero.length, fill: "#dc2626" },
    { name: "Validações extras", value: relatorio.validacoes.length, fill: "#7c3aed" },
  ].filter((d) => d.value > 0) : [];

  // -------- Exportações --------
  const baixar = (blob: Blob, nome: string) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome; a.click(); };
  const todasInc = () => [
    ...(relatorio?.camposBranco.map((b) => ({ Tipo: "Campo não preenchido", Ponto: b.ponto, Detalhe: b.detalhe, Responsável: b.responsavel })) || []),
    ...(relatorio?.violacoesZero.map((b) => ({ Tipo: "Violação 0,0cm", Ponto: b.ponto, Detalhe: b.detalhe, Responsável: b.responsavel })) || []),
    ...(relatorio?.validacoes.map((b) => ({ Tipo: b.tipo, Ponto: b.ponto, Detalhe: b.detalhe, Responsável: b.responsavel })) || []),
  ];
  const downloadCSV = () => { const inc = todasInc(); if (!inc.length) return; const cols = ["Tipo", "Ponto", "Detalhe", "Responsável"]; const l = [cols.join(";")]; inc.forEach((o: any) => l.push(cols.map((cc) => '"' + String(o[cc]).replace(/"/g, '""') + '"').join(";"))); baixar(new Blob(["﻿" + l.join("\r\n")], { type: "text/csv;charset=utf-8" }), "inconsistencias.csv"); };
  const downloadXLSX = async () => {
    if (!relatorio) return; const XLSX = await import("xlsx"); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(todasInc()), "Inconsistências");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porResp.map(([nome, q]) => ({ Responsável: nome, Inconsistências: q }))), "Por Responsável");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { Indicador: "Pontos analisados", Valor: relatorio.totalPontos }, { Indicador: "Campos em branco", Valor: relatorio.camposBranco.length },
      { Indicador: "Violações 0,0 cm", Valor: relatorio.violacoesZero.length }, { Indicador: "Validações extras", Valor: relatorio.validacoes.length },
      { Indicador: "Índice de qualidade (%)", Valor: score }]), "Resumo");
    XLSX.writeFile(wb, "relatorio_inconsistencias.xlsx");
  };
  // (5) PDF nativo com logo
  const downloadPDFSimples = async () => {
    if (!relatorio) return;
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF();
    try {
      const img = await fetch("/arqueo10anos.webp").then((r) => r.blob());
      const bmp = await createImageBitmap(img); const cv = document.createElement("canvas"); cv.width = bmp.width; cv.height = bmp.height;
      cv.getContext("2d")!.drawImage(bmp, 0, 0); doc.addImage(cv.toDataURL("image/png"), "PNG", 150, 8, 45, 32);
    } catch {}
    doc.setFontSize(16); doc.setTextColor(30, 58, 95); doc.text("Relatório de Inconsistências", 14, 20);
    doc.setFontSize(9); doc.setTextColor(100); doc.text(`Grupo Arqueo · ${relatorio.fileName} · ${relatorio.dataGeracao.toLocaleString("pt-BR")}`, 14, 27);
    doc.text(`Pontos: ${relatorio.totalPontos} | Em branco: ${relatorio.camposBranco.length} | Viol. 0,0: ${relatorio.violacoesZero.length} | Extras: ${relatorio.validacoes.length} | Qualidade: ${score}%`, 14, 33);
    const body = todasInc().map((o: any) => [o.Tipo, o.Ponto, o.Detalhe, o.Responsável]);
    autoTable(doc, { startY: 40, head: [["Tipo", "Ponto", "Detalhe", "Responsável"]], body, styles: { fontSize: 8 }, headStyles: { fillColor: [30, 58, 95] } });
    doc.save("relatorio_inconsistencias.pdf");
  };

  const downloadPDF = async () => {
    if (!relatorio || !reportRef.current) return;
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: reportRef.current.scrollWidth,
        onclone: (doc) => {
          doc.documentElement.classList.remove("dark");
          doc.querySelectorAll<HTMLElement>("[data-pdf-hide='true']").forEach((el) => { el.style.display = "none"; });
          doc.querySelectorAll<HTMLElement>("[data-pdf-show='true']").forEach((el) => { el.style.display = "block"; });
        },
      });

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height * imgW) / canvas.width;
      const pageImgH = pageH - margin * 2;
      const pageCanvasH = Math.floor((pageImgH * canvas.width) / imgW);
      let sourceY = 0;
      let page = 0;

      while (sourceY < canvas.height) {
        const sliceH = Math.min(pageCanvasH, canvas.height - sourceY);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = sliceH;
        slice.getContext("2d")!.drawImage(canvas, 0, sourceY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        if (page > 0) pdf.addPage();
        const sliceImgH = (sliceH * imgW) / canvas.width;
        pdf.addImage(slice.toDataURL("image/jpeg", 0.95), "JPEG", margin, margin, imgW, sliceImgH);
        sourceY += sliceH;
        page++;
      }
      pdf.save("relatorio_inconsistencias.pdf");
    } catch (err) {
      console.error(err);
      await downloadPDFSimples();
    }
  };

  // -------- IA --------
  const post = (url: string, body: any) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
  const ctxIA = () => ({ totalPontos: relatorio!.totalPontos, camposBranco: relatorio!.camposBranco.length, violacoesZero: relatorio!.violacoesZero.length, porResponsavel: porResp.map(([nome, quantidade]) => ({ nome, quantidade })), porProjeto: porProj.map(([nome, quantidade]) => ({ nome, quantidade })) });
  const gerarAnalise = async () => { if (!relatorio) return; setAiCarregando(true); setAiErro(""); setAiTexto(""); try { const d = await post("/api/ai-summary", ctxIA()); if (d.error) throw new Error(d.error); setAiTexto(d.summary); } catch (e: any) { setAiErro(e.message); } finally { setAiCarregando(false); } };
  const gerarSugestoes = async () => {
    if (!relatorio) return; setSugCarregando(true);
    const itens = [...relatorio.camposBranco.map((b) => ({ ponto: b.ponto, campo: b.detalhe, responsavel: b.responsavel })), ...relatorio.violacoesZero.map((b) => ({ ponto: b.ponto, campo: b.detalhe, responsavel: b.responsavel }))];
    try { const d = await post("/api/ai-suggest", { itens }); setSugestoes(d.sugestoes || []); } catch { } finally { setSugCarregando(false); }
  };
  const enviarChat = async () => { if (!chatInput.trim() || !relatorio) return; const q = chatInput.trim(); setChatInput(""); setChatCarregando(true); try { const d = await post("/api/ai-chat", { pergunta: q, contexto: ctxIA() }); setChatMsgs((m) => [...m, { q, a: d.resposta || d.error || "—" }]); } catch (e: any) { setChatMsgs((m) => [...m, { q, a: "Erro: " + e.message }]); } finally { setChatCarregando(false); } };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 dark:text-slate-100">
      <header className="bg-gradient-to-r from-blue-950 via-blue-900 to-blue-800 text-white shadow-lg print:hidden">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <img src="/arqueo10anos.webp" alt="Grupo Arqueo 10 anos" className="h-12 w-auto object-contain" />
          <div className="flex-1 min-w-0"><h1 className="text-lg sm:text-xl font-bold truncate">Auditoria de Qualidade da Base de Pontos</h1><p className="text-xs sm:text-sm opacity-90">Grupo Arqueo · Arqueologia Preventiva</p></div>
          <button onClick={() => setDark((d) => !d)} title="Modo escuro" className="p-2 rounded-lg hover:bg-white/10">{dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
          <button onClick={() => setMostrarHist((s) => !s)} title="Histórico" className="p-2 rounded-lg hover:bg-white/10"><History className="w-4 h-4" /></button>
          <div className="hidden sm:flex flex-col items-end text-right"><span className="text-sm font-medium">{user?.nome}</span><button onClick={logout} className="text-xs opacity-80 hover:opacity-100 flex items-center gap-1"><LogOut className="w-3 h-3" /> Sair</button></div>
        </div>
      </header>

      <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        {mostrarHist && (
          <div className="mb-6 bg-white dark:bg-slate-800 rounded-xl shadow p-5 print:hidden">
            <div className="flex items-center justify-between mb-3"><h2 className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2"><History className="w-4 h-4" /> Histórico de auditorias</h2>{historico.length > 0 && <button onClick={() => { localStorage.removeItem("arqueo_hist"); setHistorico([]); }} className="text-xs text-red-600 flex items-center gap-1"><Trash2 className="w-3 h-3" /> Limpar</button>}</div>
            {historico.length === 0 ? <p className="text-sm text-slate-500">Nenhuma auditoria registrada ainda.</p> : (
              <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-slate-500 border-b dark:border-slate-700"><th className="py-1 pr-3">Data</th><th className="pr-3">Arquivo</th><th className="pr-3">Pontos</th><th className="pr-3">Branco</th><th className="pr-3">0,0</th><th className="pr-3">Extras</th><th className="pr-3">Qualidade</th></tr></thead>
                <tbody>{historico.map((h) => <tr key={h.id} className="border-b dark:border-slate-700"><td className="py-1 pr-3">{h.data}</td><td className="pr-3 truncate max-w-[180px]">{h.arquivo}</td><td className="pr-3">{h.totalPontos}</td><td className="pr-3">{h.branco}</td><td className="pr-3">{h.viol}</td><td className="pr-3">{h.extras ?? 0}</td><td className="pr-3 font-semibold">{h.score}%</td></tr>)}</tbody></table></div>
            )}
          </div>
        )}

        {!relatorio ? (
          <>
            <div ref={dropRef} onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); dropRef.current?.classList.add("border-blue-600", "bg-blue-50"); }}
              onDragLeave={() => dropRef.current?.classList.remove("border-blue-600", "bg-blue-50")}
              onDrop={(e) => { e.preventDefault(); dropRef.current?.classList.remove("border-blue-600", "bg-blue-50"); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
              className="bg-white dark:bg-slate-800 border-2 border-dashed border-blue-300 dark:border-slate-600 rounded-2xl p-12 text-center cursor-pointer transition-all hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700">
              <div className="text-5xl mb-4">📊</div>
              <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-200 mb-2">Carregue a planilha de pontos</h2>
              <p className="text-gray-600 dark:text-slate-300 mb-2">Arraste <strong>.xlsx</strong> ou <strong>.csv</strong> (pode selecionar vários) ou clique</p>
              <p className="text-sm text-gray-500 mt-3">Aba <em>Pontos</em> com Responsável, Ponto, Profundidade, Tipo Solo, Munsell, Textura, Observação…</p>
              {nomeArquivo && <div className="text-blue-600 dark:text-blue-300 font-semibold mt-3">📄 {nomeArquivo}</div>}
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" multiple onChange={(e) => e.target.files && handleFiles(e.target.files)} className="hidden" />
            </div>
            {erro && <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3"><AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" /><p className="text-red-800">{erro}</p></div>}
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-6 items-center print:hidden">
              <Button onClick={() => window.print()} className="bg-blue-700 hover:bg-blue-800 text-white gap-2"><Printer className="w-4 h-4" /> Imprimir</Button>
              <Button onClick={() => window.print()} variant="outline" className="gap-2"><FileText className="w-4 h-4" /> PDF</Button>
              <Button onClick={downloadXLSX} variant="outline" className="gap-2"><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
              <Button onClick={downloadCSV} variant="outline" className="gap-2"><Download className="w-4 h-4" /> CSV</Button>
              <Button onClick={gerarAnalise} disabled={aiCarregando} className="bg-amber-600 hover:bg-amber-700 text-white gap-2">{aiCarregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Análise</Button>
              <Button onClick={gerarSugestoes} disabled={sugCarregando} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">{sugCarregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />} Sugestões</Button>
              <Button onClick={reset} variant="outline" className="gap-2"><RotateCcw className="w-4 h-4" /> Outra</Button>
              <span className="text-sm text-gray-600 dark:text-slate-400 ml-auto">{relatorio.totalPontos} pontos</span>
            </div>

            <div ref={reportRef} className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 sm:p-10 print:shadow-none print:p-0">
              <div className="border-b-4 border-blue-700 pb-6 mb-8 flex items-start gap-4">
                <img src="/arqueo10anos.webp" alt="Grupo Arqueo" data-pdf-show="true" className="h-14 w-auto object-contain hidden print:block" />
                <div><h1 className="text-2xl sm:text-3xl font-bold text-blue-900 dark:text-blue-200">Relatório de Inconsistências da Base de Pontos</h1>
                  <div className="text-gray-600 dark:text-slate-300 mt-2">Auditoria de Qualidade dos Dados · Grupo Arqueo</div>
                  <div className="text-sm text-gray-500 mt-3">Arquivo: <strong>{relatorio.fileName}</strong> · Pontos analisados: <strong>{relatorio.totalPontos}</strong></div></div>
              </div>

              {/* Resumo + gráficos */}
              <Sec n="★" t="Resumo Executivo">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="grid grid-cols-2 gap-4 lg:col-span-2">
                    <Kpi cor="from-amber-500 to-orange-600" lbl="Campos em branco" v={relatorio.camposBranco.length} />
                    <Kpi cor="from-red-500 to-red-700" lbl="Violação 0,0 cm" v={relatorio.violacoesZero.length} />
                    <Kpi cor="from-violet-500 to-violet-700" lbl="Validações extras" v={relatorio.validacoes.length} />
                    <Kpi cor="from-emerald-500 to-green-700" lbl="Índice de qualidade" v={`${score}%`} icon />
                  </div>
                  {pieData.length > 0 && (
                    <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 border border-slate-100 dark:border-slate-600">
                      <div className="text-xs uppercase text-slate-500 dark:text-slate-300 mb-1">Distribuição por tipo</div>
                      <ResponsiveContainer width="100%" height={180}><PieChart><Pie data={pieData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={2}>{pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}</Pie><RTooltip /><Legend verticalAlign="bottom" height={28} wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer>
                    </div>
                  )}
                </div>
              </Sec>

              {/* Dashboard: projeto / unidade */}
              {(porProj.length > 0 || porUni.length > 0) && (
                <Sec n="▦" t="Dashboard — Distribuição">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {porProj.length > 0 && <Barras titulo="Por Projeto" dados={porProj.slice(0, 6)} />}
                    {porUni.length > 0 && <Barras titulo="Por Unidade" dados={porUni.slice(0, 6)} />}
                  </div>
                </Sec>
              )}

              {/* IA: análise */}
              {(aiTexto || aiErro || aiCarregando) && (
                <div className="mb-10 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-5">
                  <h2 className="text-base font-bold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4" /> Análise Executiva</h2>
                  {aiCarregando && <p className="text-amber-700 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Gerando análise…</p>}
                  {aiErro && <p className="text-red-700 text-sm">{aiErro}</p>}
                  {aiTexto && <p className="text-slate-700 dark:text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">{aiTexto}</p>}
                </div>
              )}

              {/* IA: sugestões */}
              {sugestoes.length > 0 && (
                <Sec n="💡" t="Sugestões de Correção (IA)">
                  <Tabela cab={["Ponto", "Campo", "Sugestão"]}>{sugestoes.map((s, i) => <tr key={i} className="border-b border-gray-200 dark:border-slate-700"><td className="px-4 py-2 font-semibold text-blue-700 dark:text-blue-300">{s.ponto}</td><td className="px-4 py-2">{s.campo}</td><td className="px-4 py-2 text-slate-700 dark:text-slate-200">{s.sugestao}</td></tr>)}</Tabela>
                </Sec>
              )}

              {/* Filtros */}
              <div data-pdf-hide="true" className="flex flex-wrap gap-3 mb-6 items-center print:hidden">
                <div className="relative flex-1 min-w-[220px]"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por ponto, campo ou responsável…" className="pl-9" /></div>
                <select value={filtroResp} onChange={(e) => setFiltroResp(e.target.value)} className="h-9 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 text-sm"><option value="">Todos os responsáveis</option>{responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}</select>
              </div>

              <Sec n="1" t="Campos Não Preenchidos">
                {brancoF.length ? <Tabela cab={["Ponto", "Pendência", "Responsável"]}>{brancoF.map((it, i) => <Linha key={i} ponto={it.ponto} tag={it.detalhe} cor="amber" resp={it.responsavel} />)}</Tabela> : <Vazio msg={relatorio.camposBranco.length ? "Nenhum resultado para o filtro." : "Nenhum campo em branco."} ok={!relatorio.camposBranco.length} />}
              </Sec>
              <Sec n="2" t="Violação da Regra para Profundidade = 0,0 cm">
                {violF.length ? <Tabela cab={["Ponto", "Inconsistência", "Responsável"]}>{violF.map((it, i) => <Linha key={i} ponto={it.ponto} tag={it.detalhe} cor="red" resp={it.responsavel} />)}</Tabela> : <Vazio msg={relatorio.violacoesZero.length ? "Nenhum resultado para o filtro." : "Nenhuma violação da regra 0,0 cm."} ok={!relatorio.violacoesZero.length} />}
              </Sec>
              <Sec n="3" t="Validações Adicionais">
                {valF.length ? <Tabela cab={["Ponto", "Validação", "Detalhe", "Responsável"]}>{valF.map((it, i) => <tr key={i} className="border-b border-gray-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700"><td className="px-4 py-3 font-semibold text-blue-700 dark:text-blue-300">{it.ponto}</td><td className="px-4 py-3"><span className="bg-violet-100 text-violet-800 px-3 py-1 rounded-full text-xs font-semibold">{it.tipo}</span></td><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{it.detalhe}</td><td className="px-4 py-3">{it.responsavel}</td></tr>)}</Tabela> : <Vazio msg={relatorio.validacoes.length ? "Nenhum resultado para o filtro." : "Nenhuma validação adicional acusou problema."} ok={!relatorio.validacoes.length} />}
              </Sec>
              <Sec n="4" t="Resumo por Responsável">
                {porResp.length ? <Barras dados={porResp} /> : <Vazio msg="Base sem inconsistências." ok />}
              </Sec>
              {relatorio.distribuicoes.length > 0 && (
                <Sec n="5" t="Gráficos por Campo">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {relatorio.distribuicoes.map((dist) => (
                      <div key={dist.campo} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-700">
                        <Barras titulo={dist.campo} dados={dist.itens.slice(0, 10)} />
                        {dist.itens.length > 10 && <div className="mt-2 text-right text-xs text-slate-500 dark:text-slate-300">+{dist.itens.length - 10} categorias</div>}
                      </div>
                    ))}
                  </div>
                </Sec>
              )}

              <div className="border-t border-gray-200 dark:border-slate-700 pt-4 mt-8 flex justify-between text-xs text-gray-500"><span>Plataforma de Auditoria · Grupo Arqueo 10 anos.</span><span>Emitido em {relatorio.dataGeracao.toLocaleString("pt-BR")}</span></div>
            </div>

            {/* (11) Chat */}
            <div className="mt-6 bg-white dark:bg-slate-800 rounded-2xl shadow p-5 print:hidden">
              <h2 className="font-bold text-blue-900 dark:text-blue-200 mb-3 flex items-center gap-2"><MessageCircle className="w-4 h-4" /> Pergunte sobre a base</h2>
              <div className="space-y-3 max-h-72 overflow-y-auto mb-3">
                {chatMsgs.length === 0 && <p className="text-sm text-slate-500">Ex.: "Quantas inconsistências o MAURÍCIO tem?", "Qual projeto tem mais erros?"</p>}
                {chatMsgs.map((m, i) => <div key={i}><div className="text-sm font-semibold text-blue-800 dark:text-blue-300">› {m.q}</div><div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{m.a}</div></div>)}
                {chatCarregando && <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Pensando…</p>}
              </div>
              <div className="flex gap-2"><Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enviarChat()} placeholder="Digite sua pergunta…" /><Button onClick={enviarChat} disabled={chatCarregando} className="bg-blue-700 hover:bg-blue-800 text-white"><Send className="w-4 h-4" /></Button></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Sec({ n, t, children }: { n: string; t: string; children: React.ReactNode }) {
  return <div className="mb-10"><h2 className="text-lg font-bold text-blue-900 dark:text-blue-200 mb-4 flex items-center gap-2"><span className="bg-blue-700 text-white w-7 h-7 rounded flex items-center justify-center text-sm">{n}</span>{t}</h2>{children}</div>;
}
function Kpi({ cor, lbl, v, icon }: { cor: string; lbl: string; v: any; icon?: boolean }) {
  return <div className={`bg-gradient-to-br ${cor} rounded-xl p-5 text-white`}><div className="text-xs uppercase opacity-90 tracking-wide flex items-center gap-1">{icon && <ShieldCheck className="w-3.5 h-3.5" />}{lbl}</div><div className="text-4xl font-bold mt-2">{v}</div></div>;
}
function Tabela({ cab, children }: { cab: string[]; children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full text-sm border-collapse"><thead><tr className="bg-blue-700 text-white">{cab.map((c) => <th key={c} className="text-left px-4 py-3 font-semibold">{c}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
function Linha({ ponto, tag, cor, resp }: { ponto: string; tag: string; cor: "amber" | "red"; resp: string }) {
  const cls = cor === "amber" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
  return <tr className="border-b border-gray-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700"><td className="px-4 py-3 font-semibold text-blue-700 dark:text-blue-300">{ponto}</td><td className="px-4 py-3"><span className={`${cls} px-3 py-1 rounded-full text-xs font-semibold`}>{tag}</span></td><td className="px-4 py-3 text-gray-700 dark:text-slate-300">{resp}</td></tr>;
}
function Barras({ titulo, dados }: { titulo?: string; dados: [string, number][] }) {
  const max = dados.length ? dados[0][1] : 1;
  return <div>{titulo && <div className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">{titulo}</div>}<div className="space-y-3">{dados.map(([nome, q]) => <div key={nome} className="flex items-center gap-4"><div className="w-40 sm:w-56 font-medium text-gray-700 dark:text-slate-300 truncate text-sm">{nome}</div><div className="flex-1 bg-gray-200 dark:bg-slate-700 rounded-lg h-7 overflow-hidden"><div className="bg-gradient-to-r from-blue-600 to-blue-800 h-full flex items-center justify-end pr-3 text-white text-xs font-bold" style={{ width: `${Math.max(8, Math.round((q / max) * 100))}%` }}>{q}</div></div></div>)}</div></div>;
}
function Vazio({ msg, ok }: { msg: string; ok?: boolean }) {
  return <div className={`text-center py-8 font-semibold ${ok ? "text-green-700" : "text-gray-500"}`}>{ok ? "✓ " : ""}{msg}</div>;
}
