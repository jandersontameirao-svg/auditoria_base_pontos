import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertCircle, Download, RotateCcw, Printer, LogOut, Search,
  Sparkles, FileSpreadsheet, Loader2, ShieldCheck,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip, Legend } from "recharts";
import { useAuth } from "@/contexts/AuthContext";

interface Inconsistencia {
  tipo: "Campo não preenchido" | "Violação regra 0,0cm";
  ponto: string;
  detalhe: string;
  responsavel: string;
}

interface RelatorioData {
  camposBranco: Array<{ ponto: string; pendencia: string; responsavel: string }>;
  violacoesZero: Array<{ ponto: string; inconsistencia: string; responsavel: string }>;
  fileName: string;
  sheetName: string;
  totalPontos: number;
  pontosComProblema: number;
  dataGeracao: Date;
}

const CAMPO_ISENTO = "Coloração";
const CAMPOS_REGRA_ZERO = ["Tipo Solo", "Munsell", "Textura"];
const COL_PROFUNDIDADE = "Profundidade";
const COL_PONTO = "Ponto";
const COL_RESP = "Responsável";

const norm = (v: any) => (v === null || v === undefined ? "" : String(v).trim());

function normalizaChave(s: string): string {
  return norm(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function isProfundidadeZero(v: any): boolean {
  let s = norm(v).toLowerCase().replace(/\s/g, "").replace("cm", "").replace(",", ".");
  if (s === "") return false;
  const n = parseFloat(s);
  return !isNaN(n) && n === 0;
}

function listar(arr: string[]): string {
  if (arr.length <= 1) return arr.join("");
  if (arr.length === 2) return arr.join(" e ");
  return arr.slice(0, -1).join(", ") + " e " + arr.slice(-1);
}

export default function Home() {
  const { user, logout } = useAuth();
  const [relatorio, setRelatorio] = useState<RelatorioData | null>(null);
  const [erro, setErro] = useState<string>("");
  const [nomeArquivo, setNomeArquivo] = useState<string>("");
  const [inconsistencias, setInconsistencias] = useState<Inconsistencia[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroResp, setFiltroResp] = useState("");
  const [aiTexto, setAiTexto] = useState("");
  const [aiCarregando, setAiCarregando] = useState(false);
  const [aiErro, setAiErro] = useState("");
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setErro("");
    setNomeArquivo(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: "array" });
        const sheetName = wb.SheetNames.find((n) => normalizaChave(n) === "pontos") || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
        processar(rows, file.name, sheetName);
      } catch (err: any) {
        setErro("Não foi possível ler o arquivo: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processar = (rows: any[][], fileName: string, sheetName: string) => {
    if (!rows || rows.length < 2) {
      setErro("A planilha não contém dados.");
      return;
    }
    const header = rows[0].map((h: any) => norm(h));
    const idx: Record<string, number> = {};
    header.forEach((h, i) => { idx[normalizaChave(h)] = i; });
    const col = (nome: string) => idx[normalizaChave(nome)];

    const faltando = [COL_PONTO, COL_RESP].filter((c) => col(c) === undefined);
    if (faltando.length) {
      setErro("Colunas essenciais não encontradas: " + faltando.join(", "));
      return;
    }

    const iPonto = col(COL_PONTO);
    const iResp = col(COL_RESP);
    const iProf = col(COL_PROFUNDIDADE);
    const iIsento = col(CAMPO_ISENTO);

    const camposBranco: RelatorioData["camposBranco"] = [];
    const violacoesZero: RelatorioData["violacoesZero"] = [];
    const pontosProblema = new Set<string>();
    let totalPontos = 0;

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const ponto = norm(row[iPonto]);
      if (!ponto) continue;
      totalPontos++;
      const resp = norm(row[iResp]) || "(sem responsável)";

      for (let c = 0; c < header.length; c++) {
        if (!header[c]) continue;
        if (c === iIsento) continue;
        if (normalizaChave(header[c]) === normalizaChave(CAMPO_ISENTO)) continue;
        if (norm(row[c]) === "") {
          camposBranco.push({ ponto, pendencia: header[c], responsavel: resp });
          pontosProblema.add(ponto);
        }
      }

      if (iProf !== undefined && isProfundidadeZero(row[iProf])) {
        const errados = CAMPOS_REGRA_ZERO.filter((campo) => {
          const ci = col(campo);
          if (ci === undefined) return false;
          return normalizaChave(row[ci]) !== "nao se aplica";
        });
        if (errados.length) {
          violacoesZero.push({ ponto, inconsistencia: listar(errados), responsavel: resp });
          pontosProblema.add(ponto);
        }
      }
    }

    const novas: Inconsistencia[] = [];
    camposBranco.forEach((b) => novas.push({ tipo: "Campo não preenchido", ponto: b.ponto, detalhe: b.pendencia, responsavel: b.responsavel }));
    violacoesZero.forEach((b) => novas.push({ tipo: "Violação regra 0,0cm", ponto: b.ponto, detalhe: b.inconsistencia, responsavel: b.responsavel }));

    setInconsistencias(novas);
    setAiTexto(""); setAiErro("");
    setBusca(""); setFiltroResp("");
    setRelatorio({
      camposBranco, violacoesZero, fileName, sheetName,
      totalPontos, pontosComProblema: pontosProblema.size, dataGeracao: new Date(),
    });
  };

  const reset = () => {
    setRelatorio(null); setErro(""); setNomeArquivo(""); setInconsistencias([]);
    setAiTexto(""); setAiErro(""); setBusca(""); setFiltroResp("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ---------- Filtros ----------
  const correspondeFiltro = (resp: string, ...campos: string[]) => {
    if (filtroResp && resp !== filtroResp) return false;
    if (!busca.trim()) return true;
    const q = busca.trim().toLowerCase();
    return [resp, ...campos].some((c) => c.toLowerCase().includes(q));
  };

  const camposBrancoF = useMemo(
    () => relatorio?.camposBranco.filter((b) => correspondeFiltro(b.responsavel, b.ponto, b.pendencia)) || [],
    [relatorio, busca, filtroResp],
  );
  const violacoesF = useMemo(
    () => relatorio?.violacoesZero.filter((b) => correspondeFiltro(b.responsavel, b.ponto, b.inconsistencia)) || [],
    [relatorio, busca, filtroResp],
  );

  // ---------- Resumos ----------
  const porResp = useMemo(() => {
    const m: Record<string, number> = {};
    if (relatorio) {
      [...relatorio.camposBranco, ...relatorio.violacoesZero].forEach((x) => {
        m[x.responsavel] = (m[x.responsavel] || 0) + 1;
      });
    }
    return m;
  }, [relatorio]);

  const ordenado = Object.entries(porResp).sort((a, b) => b[1] - a[1]);
  const max = ordenado.length ? ordenado[0][1] : 1;
  const responsaveis = ordenado.map(([n]) => n);
  const totalInconsistencias = (relatorio?.camposBranco.length || 0) + (relatorio?.violacoesZero.length || 0);

  const score = relatorio && relatorio.totalPontos > 0
    ? Math.round(((relatorio.totalPontos - relatorio.pontosComProblema) / relatorio.totalPontos) * 100)
    : 100;

  const pieData = relatorio
    ? [
        { name: "Campos em branco", value: relatorio.camposBranco.length, fill: "#f59e0b" },
        { name: "Violação 0,0 cm", value: relatorio.violacoesZero.length, fill: "#dc2626" },
      ].filter((d) => d.value > 0)
    : [];

  // ---------- Exportações ----------
  const downloadCSV = () => {
    if (!inconsistencias.length) return;
    const cols = ["Tipo", "Ponto", "Detalhe", "Responsável"];
    const linhas = [cols.join(";")];
    inconsistencias.forEach((o) =>
      linhas.push(cols.map((c) => '"' + String(o[c as keyof Inconsistencia]).replace(/"/g, '""') + '"').join(";")),
    );
    baixar(new Blob(["﻿" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" }), "inconsistencias_base_pontos.csv");
  };

  const downloadXLSX = () => {
    if (!relatorio) return;
    const wb = XLSX.utils.book_new();
    const wsInc = XLSX.utils.json_to_sheet(
      inconsistencias.map((i) => ({ Tipo: i.tipo, Ponto: i.ponto, Detalhe: i.detalhe, Responsável: i.responsavel })),
    );
    XLSX.utils.book_append_sheet(wb, wsInc, "Inconsistências");
    const wsResp = XLSX.utils.json_to_sheet(ordenado.map(([nome, q]) => ({ Responsável: nome, Inconsistências: q })));
    XLSX.utils.book_append_sheet(wb, wsResp, "Resumo por Responsável");
    const wsResumo = XLSX.utils.json_to_sheet([
      { Indicador: "Pontos analisados", Valor: relatorio.totalPontos },
      { Indicador: "Campos em branco", Valor: relatorio.camposBranco.length },
      { Indicador: "Violações 0,0 cm", Valor: relatorio.violacoesZero.length },
      { Indicador: "Total de inconsistências", Valor: totalInconsistencias },
      { Indicador: "Índice de qualidade (%)", Valor: score },
    ]);
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo Executivo");
    XLSX.writeFile(wb, "relatorio_inconsistencias.xlsx");
  };

  const baixar = (blob: Blob, nome: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    a.click();
  };

  // ---------- IA ----------
  const gerarAnaliseIA = async () => {
    if (!relatorio) return;
    setAiCarregando(true); setAiErro(""); setAiTexto("");
    try {
      const resp = await fetch("/api/ai-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalPontos: relatorio.totalPontos,
          camposBranco: relatorio.camposBranco.length,
          violacoesZero: relatorio.violacoesZero.length,
          porResponsavel: ordenado.map(([nome, quantidade]) => ({ nome, quantidade })),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Falha na análise.");
      setAiTexto(data.summary);
    } catch (e: any) {
      setAiErro(e.message);
    } finally {
      setAiCarregando(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header com logo e usuário */}
      <header className="bg-gradient-to-r from-blue-950 via-blue-900 to-blue-800 text-white shadow-lg print:hidden">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <img src="/arqueo10anos.webp" alt="Grupo Arqueo 10 anos" className="h-12 w-auto object-contain bg-white/95 rounded-md px-2 py-1" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate">Auditoria de Qualidade da Base de Pontos</h1>
            <p className="text-xs sm:text-sm opacity-90">Grupo Arqueo · Arqueologia Preventiva</p>
          </div>
          <div className="hidden sm:flex flex-col items-end text-right">
            <span className="text-sm font-medium">{user?.nome}</span>
            <button onClick={logout} className="text-xs opacity-80 hover:opacity-100 flex items-center gap-1">
              <LogOut className="w-3 h-3" /> Sair
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        {!relatorio ? (
          <>
            <div
              ref={dropzoneRef}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); dropzoneRef.current?.classList.add("border-blue-600", "bg-blue-50"); }}
              onDragLeave={() => dropzoneRef.current?.classList.remove("border-blue-600", "bg-blue-50")}
              onDrop={(e) => { e.preventDefault(); dropzoneRef.current?.classList.remove("border-blue-600", "bg-blue-50"); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
              className="bg-white border-2 border-dashed border-blue-300 rounded-2xl p-12 text-center cursor-pointer transition-all hover:border-blue-600 hover:bg-blue-50"
            >
              <div className="text-5xl mb-4">📊</div>
              <h2 className="text-xl font-semibold text-blue-900 mb-2">Carregue a planilha de pontos</h2>
              <p className="text-gray-600 mb-2">Arraste o arquivo <strong>.xlsx</strong> aqui ou clique para selecionar</p>
              <p className="text-sm text-gray-500 mt-3">
                Esperado: aba <em>Pontos</em> com as colunas Responsável, Ponto, Profundidade, Tipo Solo, Munsell, Textura, Observação…
              </p>
              {nomeArquivo && <div className="text-blue-600 font-semibold mt-3">📄 {nomeArquivo}</div>}
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} className="hidden" />
            </div>
            {erro && (
              <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-red-800">{erro}</p>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex flex-wrap gap-3 mb-6 items-center print:hidden">
              <Button onClick={() => window.print()} className="bg-blue-700 hover:bg-blue-800 text-white flex gap-2">
                <Printer className="w-4 h-4" /> Imprimir / PDF
              </Button>
              <Button onClick={downloadXLSX} variant="outline" className="flex gap-2">
                <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
              </Button>
              <Button onClick={downloadCSV} variant="outline" className="flex gap-2">
                <Download className="w-4 h-4" /> CSV
              </Button>
              <Button onClick={gerarAnaliseIA} disabled={aiCarregando} className="bg-amber-600 hover:bg-amber-700 text-white flex gap-2">
                {aiCarregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Análise com IA
              </Button>
              <Button onClick={reset} variant="outline" className="flex gap-2">
                <RotateCcw className="w-4 h-4" /> Outra planilha
              </Button>
              <span className="text-sm text-gray-600 ml-auto">{relatorio.totalPontos} pontos · {totalInconsistencias} inconsistências</span>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-10 print:shadow-none print:p-0">
              {/* Cabeçalho do relatório */}
              <div className="border-b-4 border-blue-700 pb-6 mb-8 flex items-start gap-4">
                <img src="/arqueo10anos.webp" alt="Grupo Arqueo" className="h-14 w-auto object-contain hidden print:block" />
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-blue-900">Relatório de Inconsistências da Base de Pontos</h1>
                  <div className="text-gray-600 mt-2">Auditoria de Qualidade dos Dados com Responsável pela Execução · Grupo Arqueo</div>
                  <div className="text-sm text-gray-500 mt-3">
                    Arquivo: <strong>{relatorio.fileName}</strong> · Aba: <strong>{relatorio.sheetName}</strong> · Pontos analisados: <strong>{relatorio.totalPontos}</strong>
                  </div>
                </div>
              </div>

              {/* Resumo executivo + score + gráfico */}
              <div className="mb-10">
                <h2 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                  <span className="bg-blue-700 text-white w-7 h-7 rounded flex items-center justify-center text-sm">★</span>
                  Resumo Executivo
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
                  <div className="grid grid-cols-2 gap-4 lg:col-span-2">
                    <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-5 text-white">
                      <div className="text-xs uppercase opacity-90 tracking-wide">Campos em branco</div>
                      <div className="text-4xl font-bold mt-2">{relatorio.camposBranco.length}</div>
                    </div>
                    <div className="bg-gradient-to-br from-red-500 to-red-700 rounded-xl p-5 text-white">
                      <div className="text-xs uppercase opacity-90 tracking-wide">Violação 0,0 cm</div>
                      <div className="text-4xl font-bold mt-2">{relatorio.violacoesZero.length}</div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-5 text-white">
                      <div className="text-xs uppercase opacity-90 tracking-wide">Total de inconsistências</div>
                      <div className="text-4xl font-bold mt-2">{totalInconsistencias}</div>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-500 to-green-700 rounded-xl p-5 text-white">
                      <div className="text-xs uppercase opacity-90 tracking-wide flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Índice de qualidade</div>
                      <div className="text-4xl font-bold mt-2">{score}%</div>
                    </div>
                  </div>
                  {pieData.length > 0 && (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col">
                      <div className="text-xs uppercase text-slate-500 tracking-wide mb-1">Distribuição por tipo</div>
                      <div className="flex-1 min-h-[180px]">
                        <ResponsiveContainer width="100%" height={180}>
                          <PieChart>
                            <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={2}>
                              {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                            </Pie>
                            <RTooltip />
                            <Legend verticalAlign="bottom" height={28} wrapperStyle={{ fontSize: 11 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Análise com IA */}
              {(aiTexto || aiErro || aiCarregando) && (
                <div className="mb-10 rounded-xl border border-amber-200 bg-amber-50 p-5">
                  <h2 className="text-base font-bold text-amber-800 mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Análise Executiva (IA)
                  </h2>
                  {aiCarregando && <p className="text-amber-700 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Gerando análise com Claude…</p>}
                  {aiErro && <p className="text-red-700 text-sm">{aiErro}</p>}
                  {aiTexto && <p className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">{aiTexto}</p>}
                </div>
              )}

              {/* Filtros */}
              <div className="flex flex-wrap gap-3 mb-6 items-center print:hidden">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por ponto, campo ou responsável…" className="pl-9" />
                </div>
                <select
                  value={filtroResp}
                  onChange={(e) => setFiltroResp(e.target.value)}
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
                >
                  <option value="">Todos os responsáveis</option>
                  {responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Seção 1 */}
              <Secao numero="1" titulo="Campos Não Preenchidos">
                {camposBrancoF.length > 0 ? (
                  <Tabela cabecalhos={["Ponto", "Pendência", "Responsável"]}>
                    {camposBrancoF.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-200 hover:bg-blue-50">
                        <td className="px-4 py-3 font-semibold text-blue-700">{item.ponto}</td>
                        <td className="px-4 py-3"><span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-semibold">{item.pendencia}</span></td>
                        <td className="px-4 py-3 text-gray-700">{item.responsavel}</td>
                      </tr>
                    ))}
                  </Tabela>
                ) : <Vazio msg={relatorio.camposBranco.length ? "Nenhum resultado para o filtro." : "Nenhum campo em branco encontrado."} ok={!relatorio.camposBranco.length} />}
              </Secao>

              {/* Seção 2 */}
              <Secao numero="2" titulo="Violação da Regra para Profundidade = 0,0 cm">
                {violacoesF.length > 0 ? (
                  <Tabela cabecalhos={["Ponto", "Inconsistência", "Responsável"]}>
                    {violacoesF.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-200 hover:bg-blue-50">
                        <td className="px-4 py-3 font-semibold text-blue-700">{item.ponto}</td>
                        <td className="px-4 py-3"><span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-semibold">{item.inconsistencia}</span></td>
                        <td className="px-4 py-3 text-gray-700">{item.responsavel}</td>
                      </tr>
                    ))}
                  </Tabela>
                ) : <Vazio msg={relatorio.violacoesZero.length ? "Nenhum resultado para o filtro." : "Nenhuma violação da regra 0,0 cm."} ok={!relatorio.violacoesZero.length} />}
              </Secao>

              {/* Seção 3 */}
              <Secao numero="3" titulo="Resumo por Responsável">
                {ordenado.length > 0 ? (
                  <div className="space-y-4">
                    {ordenado.map(([nome, q]) => (
                      <div key={nome} className="flex items-center gap-4">
                        <div className="w-44 sm:w-64 font-semibold text-gray-700 truncate text-sm">{nome}</div>
                        <div className="flex-1 bg-gray-200 rounded-lg h-7 overflow-hidden">
                          <div className="bg-gradient-to-r from-blue-600 to-blue-800 h-full flex items-center justify-end pr-3 text-white text-xs font-bold" style={{ width: `${Math.max(8, Math.round((q / max) * 100))}%` }}>{q}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <Vazio msg="Base de pontos sem inconsistências." ok />}
              </Secao>

              <div className="border-t border-gray-200 pt-4 mt-8 flex justify-between text-xs text-gray-500">
                <span>Gerado pela Plataforma de Auditoria · Grupo Arqueo 10 anos.</span>
                <span>Emitido em {relatorio.dataGeracao.toLocaleString("pt-BR")}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Secao({ numero, titulo, children }: { numero: string; titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
        <span className="bg-blue-700 text-white w-7 h-7 rounded flex items-center justify-center text-sm">{numero}</span>
        {titulo}
      </h2>
      {children}
    </div>
  );
}

function Tabela({ cabecalhos, children }: { cabecalhos: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-blue-700 text-white">
            {cabecalhos.map((c) => <th key={c} className="text-left px-4 py-3 font-semibold">{c}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Vazio({ msg, ok }: { msg: string; ok?: boolean }) {
  return <div className={`text-center py-8 font-semibold ${ok ? "text-green-700" : "text-gray-500"}`}>{ok ? "✓ " : ""}{msg}</div>;
}
