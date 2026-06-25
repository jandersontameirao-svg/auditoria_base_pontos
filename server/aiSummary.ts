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

export async function gerarResumoIA(payload: AiSummaryPayload): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY não configurada no servidor. Defina-a no arquivo .env (veja .env.example).",
    );
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

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Erro da API Anthropic (${resp.status}): ${txt.slice(0, 300)}`);
  }

  const data = (await resp.json()) as { content?: Array<{ type: string; text?: string }> };
  const texto = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return texto || "A IA não retornou conteúdo.";
}
