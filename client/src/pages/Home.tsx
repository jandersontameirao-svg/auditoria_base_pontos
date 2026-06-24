import { Button } from "@/components/ui/button";
import { AlertCircle, Download, RotateCcw, Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";

interface Inconsistencia {
  tipo: "Campo não preenchido" | "Violação regra 0,0cm";
  ponto: string;
  detalhe: string;
  responsavel: string;
}

interface ResumoResp {
  nome: string;
  quantidade: number;
}

interface RelatorioData {
  camposBranco: Array<{ ponto: string; pendencia: string; responsavel: string }>;
  violacoesZero: Array<{ ponto: string; inconsistencia: string; responsavel: string }>;
  fileName: string;
  sheetName: string;
  totalPontos: number;
  dataGeracao: Date;
}

const CAMPO_ISENTO = "Coloração";
const CAMPOS_REGRA_ZERO = ["Tipo Solo", "Munsell", "Textura"];
const COL_PROFUNDIDADE = "Profundidade";
const COL_PONTO = "Ponto";
const COL_RESP = "Responsável";

const norm = (v: any) => (v === null || v === undefined) ? "" : String(v).trim();

function normalizaChave(s: string): string {
  return norm(s).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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

function esc(s: any): string {
  return String(s).replace(/[&<>"]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  }[c] || c));
}

export default function Home() {
  const [relatorio, setRelatorio] = useState<RelatorioData | null>(null);
  const [erro, setErro] = useState<string>("");
  const [nomeArquivo, setNomeArquivo] = useState<string>("");
  const [inconsistencias, setInconsistencias] = useState<Inconsistencia[]>([]);
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    dropzoneRef.current?.classList.add("drag");
  };

  const handleDragLeave = () => {
    dropzoneRef.current?.classList.remove("drag");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dropzoneRef.current?.classList.remove("drag");
    if (e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    setErro("");
    setNomeArquivo(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: "array" });
        let sheetName = wb.SheetNames.find((n) => normalizaChave(n) === "pontos") || wb.SheetNames[0];
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
    header.forEach((h, i) => {
      idx[normalizaChave(h)] = i;
    });

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

    const camposBranco: Array<{ ponto: string; pendencia: string; responsavel: string }> = [];
    const violacoesZero: Array<{ ponto: string; inconsistencia: string; responsavel: string }> = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const ponto = norm(row[iPonto]);
      if (!ponto) continue;

      const resp = norm(row[iResp]) || "(sem responsável)";

      // Regra 1: campos não preenchidos
      for (let c = 0; c < header.length; c++) {
        if (!header[c]) continue;
        if (c === iIsento) continue;
        if (normalizaChave(header[c]) === normalizaChave(CAMPO_ISENTO)) continue;
        if (norm(row[c]) === "") {
          camposBranco.push({ ponto, pendencia: header[c], responsavel: resp });
        }
      }

      // Regra 2: Profundidade = 0,0 cm
      if (iProf !== undefined && isProfundidadeZero(row[iProf])) {
        const errados = CAMPOS_REGRA_ZERO.filter((campo) => {
          const ci = col(campo);
          if (ci === undefined) return false;
          return normalizaChave(row[ci]) !== "nao se aplica";
        });
        if (errados.length) {
          violacoesZero.push({ ponto, inconsistencia: listar(errados), responsavel: resp });
        }
      }
    }

    const novasInconsistencias: Inconsistencia[] = [];
    camposBranco.forEach((b) =>
      novasInconsistencias.push({
        tipo: "Campo não preenchido",
        ponto: b.ponto,
        detalhe: b.pendencia,
        responsavel: b.responsavel,
      })
    );
    violacoesZero.forEach((b) =>
      novasInconsistencias.push({
        tipo: "Violação regra 0,0cm",
        ponto: b.ponto,
        detalhe: b.inconsistencia,
        responsavel: b.responsavel,
      })
    );

    setInconsistencias(novasInconsistencias);
    setRelatorio({
      camposBranco,
      violacoesZero,
      fileName,
      sheetName,
      totalPontos: rows.length - 1,
      dataGeracao: new Date(),
    });
  };

  const reset = () => {
    setRelatorio(null);
    setErro("");
    setNomeArquivo("");
    setInconsistencias([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const downloadCSV = () => {
    if (inconsistencias.length === 0) return;

    const cols = ["Tipo", "Ponto", "Detalhe", "Responsável"];
    const linhas = [cols.join(";")];

    inconsistencias.forEach((o) => {
      linhas.push(
        cols
          .map((c) => '"' + String(o[c as keyof Inconsistencia]).replace(/"/g, '""') + '"')
          .join(";")
      );
    });

    const blob = new Blob(["\ufeff" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "inconsistencias_base_pontos.csv";
    a.click();
  };

  const porResp: Record<string, number> = {};
  if (relatorio) {
    const todos = [
      ...relatorio.camposBranco.map(x => ({ responsavel: x.responsavel })),
      ...relatorio.violacoesZero.map(x => ({ responsavel: x.responsavel }))
    ];
    todos.forEach((x) => {
      porResp[x.responsavel] = (porResp[x.responsavel] || 0) + 1;
    });
  }

  const ordenado = Object.entries(porResp).sort((a, b) => b[1] - a[1]);
  const max = ordenado.length ? ordenado[0][1] : 1;

  const totalInconsistencias = (relatorio?.camposBranco.length || 0) + (relatorio?.violacoesZero.length || 0);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-6 py-7">
          <h1 className="text-2xl font-bold tracking-tight">Auditoria de Qualidade da Base de Pontos</h1>
          <p className="text-sm opacity-90 mt-1">Gerador do Relatório de Inconsistências · Arqueologia Preventiva</p>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        {!relatorio ? (
          <>
            {/* Dropzone */}
            <div
              ref={dropzoneRef}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="bg-white border-2 border-dashed border-blue-300 rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 hover:border-blue-600 hover:bg-blue-50 drag:border-blue-600 drag:bg-blue-50"
            >
              <div className="text-5xl mb-4">📊</div>
              <h2 className="text-xl font-semibold text-blue-900 mb-2">Carregue a planilha de pontos</h2>
              <p className="text-gray-600 mb-2">Arraste o arquivo <strong>.xlsx</strong> aqui ou clique para selecionar</p>
              <p className="text-sm text-gray-500 mt-3">
                Esperado: aba <em>Pontos</em> com as colunas Responsável, Ponto, Profundidade, Tipo Solo, Munsell, Textura, Observação…
              </p>
              {nomeArquivo && <div className="text-blue-600 font-semibold mt-3">📄 {nomeArquivo}</div>}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>

            {/* Error Message */}
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
            <div className="flex flex-wrap gap-3 mb-8 items-center">
              <Button
                onClick={() => window.print()}
                className="bg-blue-700 hover:bg-blue-800 text-white flex gap-2"
              >
                <Printer className="w-4 h-4" />
                Exportar / Imprimir PDF
              </Button>
              <Button
                onClick={downloadCSV}
                variant="outline"
                className="flex gap-2"
              >
                <Download className="w-4 h-4" />
                Baixar inconsistências (CSV)
              </Button>
              <Button
                onClick={reset}
                variant="outline"
                className="flex gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Carregar outra planilha
              </Button>
              <span className="text-sm text-gray-600 ml-auto">
                {relatorio.totalPontos} pontos · {totalInconsistencias} inconsistências
              </span>
            </div>

            {/* Report */}
            <div className="bg-white rounded-2xl shadow-lg p-10">
              {/* Report Header */}
              <div className="border-b-4 border-blue-700 pb-6 mb-8">
                <h1 className="text-3xl font-bold text-blue-900">Relatório de Inconsistências da Base de Pontos</h1>
                <div className="text-gray-600 mt-2">Auditoria de Qualidade dos Dados com Responsável pela Execução</div>
                <div className="text-sm text-gray-500 mt-3">
                  Arquivo: <strong>{relatorio.fileName}</strong> · Aba: <strong>{relatorio.sheetName}</strong> · Pontos analisados: <strong>{relatorio.totalPontos}</strong>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="mb-10">
                <h2 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                  <span className="bg-blue-700 text-white w-7 h-7 rounded flex items-center justify-center text-sm">★</span>
                  Resumo Executivo
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-6 text-white">
                    <div className="text-xs uppercase opacity-90 tracking-wide">Campos em branco</div>
                    <div className="text-4xl font-bold mt-2">{relatorio.camposBranco.length}</div>
                  </div>
                  <div className="bg-gradient-to-br from-red-500 to-red-700 rounded-xl p-6 text-white">
                    <div className="text-xs uppercase opacity-90 tracking-wide">Violação da regra 0,0 cm</div>
                    <div className="text-4xl font-bold mt-2">{relatorio.violacoesZero.length}</div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-6 text-white">
                    <div className="text-xs uppercase opacity-90 tracking-wide">Total de inconsistências</div>
                    <div className="text-4xl font-bold mt-2">{totalInconsistencias}</div>
                  </div>
                </div>
              </div>

              {/* Section 1: Campos Não Preenchidos */}
              <div className="mb-10">
                <h2 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                  <span className="bg-blue-700 text-white w-7 h-7 rounded flex items-center justify-center text-sm">1</span>
                  Campos Não Preenchidos
                </h2>
                {relatorio.camposBranco.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-blue-700 text-white">
                          <th className="text-left px-4 py-3 font-semibold">Ponto</th>
                          <th className="text-left px-4 py-3 font-semibold">Pendência</th>
                          <th className="text-left px-4 py-3 font-semibold">Responsável</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relatorio.camposBranco.map((item, idx) => (
                          <tr key={idx} className="border-b border-gray-200 hover:bg-blue-50 transition-colors">
                            <td className="px-4 py-3 font-semibold text-blue-700">{item.ponto}</td>
                            <td className="px-4 py-3">
                              <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-semibold">
                                {item.pendencia}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-700">{item.responsavel}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-green-700 font-semibold">✓ Nenhum campo em branco encontrado.</div>
                )}
              </div>

              {/* Section 2: Violação da Regra 0,0 cm */}
              <div className="mb-10">
                <h2 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                  <span className="bg-blue-700 text-white w-7 h-7 rounded flex items-center justify-center text-sm">2</span>
                  Violação da Regra para Profundidade = 0,0 cm
                </h2>
                {relatorio.violacoesZero.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-blue-700 text-white">
                          <th className="text-left px-4 py-3 font-semibold">Ponto</th>
                          <th className="text-left px-4 py-3 font-semibold">Inconsistência</th>
                          <th className="text-left px-4 py-3 font-semibold">Responsável</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relatorio.violacoesZero.map((item, idx) => (
                          <tr key={idx} className="border-b border-gray-200 hover:bg-blue-50 transition-colors">
                            <td className="px-4 py-3 font-semibold text-blue-700">{item.ponto}</td>
                            <td className="px-4 py-3">
                              <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-semibold">
                                {item.inconsistencia}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-700">{item.responsavel}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-green-700 font-semibold">✓ Nenhuma violação da regra 0,0 cm.</div>
                )}
              </div>

              {/* Section 3: Resumo por Responsável */}
              <div className="mb-10">
                <h2 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                  <span className="bg-blue-700 text-white w-7 h-7 rounded flex items-center justify-center text-sm">3</span>
                  Resumo por Responsável
                </h2>
                {ordenado.length > 0 ? (
                  <div className="space-y-4">
                    {ordenado.map(([nome, q]) => {
                      const pct = Math.max(8, Math.round((q / max) * 100));
                      return (
                        <div key={nome} className="flex items-center gap-4">
                          <div className="w-64 font-semibold text-gray-700 truncate">{nome}</div>
                          <div className="flex-1 bg-gray-200 rounded-lg h-7 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-blue-600 to-blue-800 h-full flex items-center justify-end pr-3 text-white text-xs font-bold transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            >
                              {q}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-green-700 font-semibold">✓ Base de pontos sem inconsistências.</div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 pt-4 mt-8 flex justify-between text-xs text-gray-500">
                <span>Gerado automaticamente pelo app de Auditoria da Base de Pontos.</span>
                <span>Emitido em {relatorio.dataGeracao.toLocaleString("pt-BR")}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
