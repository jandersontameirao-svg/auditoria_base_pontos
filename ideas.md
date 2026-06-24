# Auditoria da Base de Pontos — Conceitos de Design

## Análise do Código Fonte

O app é um **gerador de relatórios de auditoria** para bases de dados arqueológicos. Funcionalidades principais:

- Upload de planilhas Excel (.xlsx)
- Análise automática de inconsistências em dados de pontos arqueológicos
- Detecção de campos não preenchidos
- Validação de regras (ex: profundidade = 0,0 cm requer "Não se aplica" em certos campos)
- Relatório visual com KPIs, tabelas detalhadas e resumo por responsável
- Exportação em PDF (print) e CSV

## Três Abordagens de Design

### 1. **Minimalista Corporativo** — Probabilidade: 0.07
Estética limpa e profissional, focada em eficiência. Interface neutra com cores institucionais (azul/cinza). Tabelas densas, tipografia clara, sem decorações. Ideal para ferramentas internas de gestão.

### 2. **Técnico Moderno com Profundidade** — Probabilidade: 0.04
Design contemporâneo com camadas visuais, sombras suaves, gradientes sutis. Ênfase em hierarquia através de espaçamento e tipografia variada. Cards com efeitos hover, animações fluidas. Paleta azul-profundo com acentos em laranja/vermelho para alertas.

### 3. **Arqueológico Contextual** — Probabilidade: 0.06
Inspirado em arqueologia: texturas de terra, tipografia serif elegante, paleta terrosa (ocre, marrom, azul-escuro). Elementos visuais que remetem a escavações, estratificação. Mais narrativo e temático.

---

## Abordagem Escolhida: **Técnico Moderno com Profundidade**

Esta abordagem equilibra profissionalismo com sofisticação visual, mantendo a funcionalidade como prioridade.

### Design Movement
**Contemporary Data Visualization + Subtle Neumorphism**
Inspirado em dashboards modernos (Figma, Linear, Vercel), com ênfase em clareza de dados e interatividade refinada.

### Core Principles
1. **Hierarquia através da Profundidade**: Uso de sombras, elevação e espaçamento para criar camadas visuais que guiam a leitura.
2. **Contraste Funcional**: Cores semânticas (alerta, sucesso, informação) usadas com propósito, não por decoração.
3. **Tipografia Expressiva**: Combinação de sans-serif moderna (Geist/Poppins) com pesos variados para estrutura visual clara.
4. **Animações Propositais**: Transições suaves em interações (hover, upload, expansão de relatórios) que reforçam feedback do usuário.

### Color Philosophy
- **Primário**: Azul profundo (`#1e3a5f`) — confiança, profissionalismo, autoridade
- **Secundário**: Laranja quente (`#d68910`) — atenção, campos em branco (não é erro, é pendência)
- **Destrutivo**: Vermelho vibrante (`#c0392b`) — violações críticas de regras
- **Sucesso**: Verde (`#1e8449`) — dados validados
- **Neutro**: Cinza (`#64748b`) — contexto, metadados
- **Fundo**: Branco limpo com cinza muito claro (`#f1f5f9`) para seções

### Layout Paradigm
- **Header Gradiente**: Faixa superior com gradiente azul (135deg) — presença visual forte
- **Dropzone Centralizado**: Área de upload como ponto focal inicial
- **Relatório em Camadas**: Cards/sections com espaçamento generoso, não grid denso
- **Sidebar Implícita**: Toolbar horizontal flutuante com ações contextuais
- **Tabelas Refinadas**: Cabeçalhos azuis, linhas alternadas com fundo claro, hover com destaque

### Signature Elements
1. **Cards com Gradientes**: KPI cards (Resumo Executivo) com gradientes 135deg — visual premium
2. **Badges Semânticas**: Tags coloridas para categorizar inconsistências (branco/laranja para pendências, vermelho para violações)
3. **Barras de Progresso Horizontal**: Resumo por Responsável com barras gradiente azul — visual intuitivo

### Interaction Philosophy
- **Dropzone Animado**: Muda cor/borda ao passar arquivo (drag-over)
- **Botões com Escala**: Feedback tátil em clique (scale 0.97)
- **Transições Suaves**: Scroll para relatório, expansão de seções
- **Feedback Visual**: Mensagens de erro em caixas alertas, sucesso em verde

### Animation
- **Dropzone**: Transição 0.2s na borda/cor ao hover/drag
- **Botões**: Scale 0.97 em 160ms ease-out no `:active`
- **Scroll**: Smooth behavior ao revelar relatório
- **Hover em Tabelas**: Background suave em 150ms
- **Entrada de Relatório**: Fade-in + slide-up suave (200ms)

### Typography System
- **Display/Títulos**: Poppins Bold 700 (22-24px) — autoridade
- **Subtítulos**: Poppins SemiBold 600 (17-18px) — seções
- **Body**: Segoe UI / Roboto Regular 400 (13.5-14px) — leitura
- **Metadados**: Regular 400 (12-13px) com opacidade — contexto
- **Monospace**: Para valores numéricos em cards (38px bold)

### Brand Essence
**Ferramenta de Auditoria Profissional que transforma dados complexos em insights visuais claros, confiável e precisa para arqueólogos e gestores.**

Personalidade: Preciso, Confiável, Acessível

### Brand Voice
- Títulos: Diretos, sem jargão desnecessário. Ex: "Relatório de Inconsistências da Base de Pontos" (não "Análise Avançada de Dados")
- CTAs: Ação clara. Ex: "Exportar / Imprimir PDF", "Baixar inconsistências (CSV)"
- Microcopy: Informativo e guiador. Ex: "Esperado: aba Pontos com as colunas Responsável, Ponto, Profundidade..."

### Wordmark & Logo
Logo: Um símbolo de **estratificação arqueológica** — três camadas horizontais em degradê azul, com um ponto central (representando o ponto de coleta). Sem texto, apenas o símbolo.

### Signature Brand Color
**Azul Profundo (#1e3a5f)** — cor primária, usada em headers, títulos e elementos de ênfase. Transmite confiança e profissionalismo.

---

## Implementação
- Manter estrutura HTML original (dropzone, toolbar, relatório)
- Integrar React com componentes shadcn/ui para botões, diálogos, etc.
- Usar Tailwind CSS com tokens de cor customizados
- Biblioteca XLSX já incluída (xlsx.full.min.js)
- Animações via Tailwind + Framer Motion para transições complexas
- Responsivo: mobile-first, tabelas scrolláveis em mobile
