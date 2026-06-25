# Auditoria da Base de Pontos · Grupo Arqueo

App interno do **Grupo Arqueo** que lê a planilha `.xlsx` da base de pontos arqueológicos e
gera o **Relatório de Inconsistências** (campos não preenchidos + violações da regra de
profundidade 0,0 cm), com login, identidade visual do Grupo Arqueo 10 anos e análise por IA.

## Como rodar

```bash
pnpm install
pnpm dev        # desenvolvimento  → http://localhost:3000
# produção:
pnpm build && pnpm start
```

## Login (simples / uso interno)

Credenciais em `client/src/contexts/AuthContext.tsx` (edite à vontade):

| Usuário     | Senha          |
|-------------|----------------|
| `arqueo`    | `arqueo10anos` |
| `admin`     | `arqueo2026`   |
| `auditoria` | `pontos`       |

> A sessão fica salva no `localStorage` do navegador. Para sair, use o botão **Sair** no cabeçalho.

## Regras de auditoria

1. **Campos não preenchidos** — qualquer célula vazia gera um item (Ponto · Campo · Responsável).
   A coluna **Coloração** é ignorada (isenta).
2. **Regra 0,0 cm** — quando `Profundidade = 0,0cm`, os campos **Tipo Solo, Munsell e Textura**
   devem ser exatamente `"Não se aplica"`. Pontos fora da regra são listados.

As colunas são detectadas pelo **nome** (sem acento/maiúsculas), então a ordem pode mudar.

## Análise com IA (opcional)

O botão **Análise com IA** chama a API da Anthropic (Claude) via servidor.
Para habilitar, copie `.env.example` → `.env` e preencha `ANTHROPIC_API_KEY`.
A chave fica **somente no servidor** (endpoint `/api/ai-summary`), nunca no navegador.

## Melhorias implementadas nesta versão

1. **Login + identidade visual Grupo Arqueo 10 anos** (logo no login, cabeçalho, favicon e impressão).
2. **Exportação para Excel (.xlsx)** com 3 abas (Inconsistências, Resumo por Responsável, Resumo Executivo) — além do CSV.
3. **Busca e filtro por responsável** nas tabelas de inconsistências.
4. **Índice de qualidade (%)** + **gráfico de pizza** (recharts) por tipo de inconsistência.
5. **Análise executiva com IA** (Anthropic Claude) — endpoint em dev e produção.
6. **Limpeza do repositório**: removido código morto (Map/ManusDialog), `index.html` corrigido
   (idioma pt-BR, título, favicon, script de analytics quebrado removido).
