import "dotenv/config";
import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { gerarResumoIA, gerarSugestoes, responderChat } from "./aiSummary";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "2mb" }));

  // Endpoint de análise executiva com IA (Anthropic)
  app.post("/api/ai-summary", async (req, res) => {
    try {
      res.json({ summary: await gerarResumoIA(req.body) });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Erro ao gerar análise." });
    }
  });
  app.post("/api/ai-suggest", async (req, res) => {
    try {
      res.json({ sugestoes: await gerarSugestoes(req.body) });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Erro ao gerar sugestões." });
    }
  });
  app.post("/api/ai-chat", async (req, res) => {
    try {
      res.json({ resposta: await responderChat(req.body) });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Erro no chat." });
    }
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  // Porta definida pela VPS via variável de ambiente PORT. Fallback alto para
  // não colidir com outros apps (ex.: algo já rodando em 3000) caso PORT não seja informada.
  const port = process.env.PORT || 3001;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
