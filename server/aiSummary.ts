import "dotenv/config";
// Handler compartilhado para gerar análise executiva com IA (Anthropic Claude).
// Usado tanto pelo middleware do Vite (dev) quanto pelo Express (produção).
// Requer a variável de ambiente ANTHROPIC_API_KEY (veja .env.example).

export interface AiSummaryPayload {
  totalPontos: number;
  camposBranco: number;
  violacoesZero: number;
  porResponsavel: Array<{ nome: string; quantidade: number }>;
  detalhes?: Array<{ tipo: string; ponto: string; detalhe: string; responsavel: string }>;
}

const MODEL = "claude-opus-4-8";

// Análise executiva gerada localmente (sem depender de IA externa).
// Garante que o recurso esteja SEMPRE disponível, mesmo sem ANTHROPIC_API_KEY.
function resumoLocal(p: AiSummaryPayload): string {
  const total = p.camposBranco + p.violacoesZero;
  const ranking = [...p.porResponsavel].sort((a, b) => b.quantidade - a.quantidade);
  const lider = ranking[0];
  const score =
    p.totalPontos > 0 ? Math.max(0, Math.round((1 - total / p.totalPontos) * 100)) : 100;

  if (total === 0) {
    return `Diagnóstico geral: a base de ${p.totalPontos} pontos não apresentou inconsistências — índice de qualidade de 100%. Todos os campos obrigatórios foram preenchidos e a regra de profundidade 0,0 cm foi respeitada. Recomendação: manter o padrão atual de preenchimento e seguir com a conferência de rotina.`;
  }

  const partes: string[] = [];
  partes.push(
    `Diagnóstico geral: foram analisados ${p.totalPontos} pontos, com ${total} inconsistência(s) — ${p.camposBranco} campo(s) em branco e ${p.violacoesZero} violação(ões) da regra de profundidade 0,0 cm. O índice de qualidade da base é de aproximadamente ${score}%.`,
  );
  if (ranking.length) {
    const topo = ranking
      .slice(0, 3)
      .map((r) => `${r.nome} (${r.quantidade})`)
      .join(", ");
    partes.push(
      `Principais responsáveis: ${topo}.${
        lider ? ` A maior concentração está em ${lider.nome}, que deve ser priorizado(a) na revisão.` : ""
      }`,
    );
  }
  const recs: string[] = [];
  if (p.camposBranco > 0)
    recs.push("preencher os campos obrigatórios pendentes (exceto Coloração, que é isenta)");
  if (p.violacoesZero > 0)
    recs.push('ajustar os pontos com profundidade 0,0 cm definindo Tipo Solo, Munsell e Textura como "Não se aplica"');
  recs.push("reorientar as equipes com mais ocorrências e reconferir a planilha antes do envio");
  partes.push(`Recomendações práticas: ${recs.join("; ")}.`);
  return partes.join("\n\n");
}

export async function gerarResumoIA(payload: AiSummaryPayload): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  // Sem chave: usa a análise local (recurso sempre disponível).
  if (!apiKey) {
    return resumoLocal(payload);
  }

  const prompt = [
    "Você é um analista de qualidade de dados de uma empresa de arqueologia preventiva (Grupo Arqueo).",
    "Com base nos indicadores da auditoria da base de pontos abaixo, escreva uma análise executiva",
    "objetiva em português do Brasil (máx. 180 palavras), em tom profissional. Estruture em:",
    "1) Diagnóstico geral; 2) Principais responsáveis e padrões; 3) Recomendações práticas de correção.",
    "Não invente números além dos fornecidos.",
    "",
    `Total de pontos analisados: ${payload.totalPontos}`,
    `Campos em branco: ${payload.camposBranco}`,
    `Violações da regra de profundidade 0,0 cm: ${payload.violacoesZero}`,
    `Inconsistências por responsável: ${payload.porResponsavel
      .map((r) => `${r.nome} (${r.quantidade})`)
      .join(", ")}`,
  ].join("\n");

  const texto = await callClaude(prompt, 700);
  return texto || resumoLocal(payload);
}

// ---------- Helper genérico de chamada ao Claude ----------
async function callClaude(prompt: string, maxTokens: number): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
  }).catch(() => null);
  if (!resp || !resp.ok) return null;
  const data = (await resp.json()) as { content?: Array<{ type: string; text?: string }> };
  const t = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  return t || null;
}

// ---------- (10) Sugestões de correção por ponto ----------
export interface SugestaoPayload {
  itens: Array<{ ponto: string; campo: string; responsavel: string }>;
}
function sugestaoLocalCampo(campo: string): string {
  const c = campo.toLowerCase();
  if (c.includes("profundidade")) return 'Informar a profundidade da escavação (ex.: "0,50cm"); se não houve escavação, usar "0,0cm".';
  if (c.includes("tipo solo") || c.includes("munsell") || c.includes("textura"))
    return 'Preencher a caracterização do solo; quando a profundidade for 0,0 cm, usar "Não se aplica".';
  if (c.includes("observ")) return "Descrever o contexto/estratigrafia do ponto ou justificar a ausência de achados.";
  if (c.includes("utm")) return "Informar a coordenada UTM correta (Easting/Northing) conferida em campo/GPS.";
  if (c.includes("vegeta")) return "Informar a cobertura vegetal predominante no ponto.";
  if (c.includes("uso do solo")) return "Informar o uso atual do solo (ex.: pastagem, agricultura).";
  if (c.includes("declive")) return "Informar o declive do terreno (baixo/médio/alto).";
  if (c.includes("status")) return "Informar o status do ponto (ex.: NEGATIVO/POSITIVO).";
  return `Preencher o campo "${campo}" conforme padrão de campo do projeto.`;
}
export async function gerarSugestoes(payload: SugestaoPayload): Promise<Array<{ ponto: string; campo: string; sugestao: string }>> {
  const base = payload.itens.slice(0, 40);
  const local = base.map((i) => ({ ponto: i.ponto, campo: i.campo, sugestao: sugestaoLocalCampo(i.campo) }));
  if (!process.env.ANTHROPIC_API_KEY) return local;
  const prompt =
    "Você é arqueólogo de campo do Grupo Arqueo. Para cada inconsistência (ponto + campo não preenchido/irregular), " +
    "sugira de forma BREVE (1 frase) o que preencher. Responda APENAS um JSON array no formato " +
    '[{"ponto":"","campo":"","sugestao":""}], sem texto extra.\n\nItens:\n' +
    base.map((i) => `- ${i.ponto} | ${i.campo}`).join("\n");
  const t = await callClaude(prompt, 1200);
  if (!t) return local;
  try {
    const j = JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1));
    if (Array.isArray(j) && j.length) return j;
  } catch {}
  return local;
}

// ---------- (11) Chat sobre a base ----------
export interface ChatPayload {
  pergunta: string;
  contexto: {
    totalPontos: number;
    camposBranco: number;
    violacoesZero: number;
    porResponsavel: Array<{ nome: string; quantidade: number }>;
    porProjeto?: Array<{ nome: string; quantidade: number }>;
  };
}
function chatLocal(p: ChatPayload): string {
  const q = p.pergunta.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const c = p.contexto;
  const hit = c.porResponsavel.find((r) => q.includes(r.nome.toLowerCase().split(" ")[0]));
  if (hit) return `${hit.nome} possui ${hit.quantidade} inconsistência(s) na base.`;
  if (q.includes("total")) return `Total de ${c.camposBranco + c.violacoesZero} inconsistências em ${c.totalPontos} pontos.`;
  if (q.includes("branco") || q.includes("preench")) return `Há ${c.camposBranco} campo(s) em branco.`;
  if (q.includes("0,0") || q.includes("profundidade")) return `Há ${c.violacoesZero} violação(ões) da regra de profundidade 0,0 cm.`;
  const top = [...c.porResponsavel].sort((a, b) => b.quantidade - a.quantidade)[0];
  return `Resumo: ${c.totalPontos} pontos, ${c.camposBranco} campos em branco, ${c.violacoesZero} violações 0,0 cm${top ? `; maior responsável: ${top.nome} (${top.quantidade})` : ""}. (Configure a chave de IA para respostas mais elaboradas.)`;
}
export async function responderChat(payload: ChatPayload): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return chatLocal(payload);
  const c = payload.contexto;
  const prompt =
    "Você é um assistente de auditoria de dados arqueológicos do Grupo Arqueo. Responda em português, de forma " +
    "objetiva e SOMENTE com base nos dados abaixo (não invente). Se a pergunta não puder ser respondida com os dados, diga isso.\n\n" +
    `Dados: ${c.totalPontos} pontos; ${c.camposBranco} campos em branco; ${c.violacoesZero} violações 0,0 cm.\n` +
    `Por responsável: ${c.porResponsavel.map((r) => `${r.nome}=${r.quantidade}`).join("; ")}.\n` +
    (c.porProjeto?.length ? `Por projeto: ${c.porProjeto.map((r) => `${r.nome}=${r.quantidade}`).join("; ")}.\n` : "") +
    `\nPergunta: ${payload.pergunta}`;
  const t = await callClaude(prompt, 600);
  return t || chatLocal(payload);
}
