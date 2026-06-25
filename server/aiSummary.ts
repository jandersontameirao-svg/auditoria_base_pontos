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
  }).catch(() => null);

  // Qualquer falha de rede/credencial cai para a análise local (recurso nunca indisponível).
  if (!resp || !resp.ok) return resumoLocal(payload);

  const data = (await resp.json()) as { content?: Array<{ type: string; text?: string }> };
  const texto = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return texto || resumoLocal(payload);
}
