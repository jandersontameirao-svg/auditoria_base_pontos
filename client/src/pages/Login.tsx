import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { LogIn, Lock, User, AlertCircle } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    if (!login(usuario, senha)) {
      setErro("Usuário ou senha inválidos.");
      setSenha("");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-950 via-blue-900 to-slate-800 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Cabeçalho com logo */}
          <div className="bg-gradient-to-br from-white to-slate-50 px-8 pt-10 pb-6 text-center border-b border-slate-100">
            <img
              src="/arqueo10anos.webp"
              alt="Grupo Arqueo - 10 anos"
              className="h-24 mx-auto object-contain"
            />
            <h1 className="text-xl font-bold text-blue-900 mt-4">Auditoria da Base de Pontos</h1>
            <p className="text-sm text-slate-500 mt-1">Plataforma interna · Grupo Arqueo</p>
          </div>

          {/* Formulário */}
          <form onSubmit={onSubmit} className="px-8 py-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="usuario" className="text-slate-700">Usuário</Label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="usuario"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="seu usuário"
                  autoFocus
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="senha" className="text-slate-700">Senha</Label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="senha"
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9"
                />
              </div>
            </div>

            {erro && (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {erro}
              </div>
            )}

            <Button type="submit" className="w-full bg-blue-800 hover:bg-blue-900 text-white gap-2 h-11">
              <LogIn className="w-4 h-4" />
              Entrar
            </Button>
          </form>
        </div>
        <p className="text-center text-xs text-blue-200/70 mt-6">
          © {new Date().getFullYear()} Grupo Arqueo · Arqueologia Preventiva
        </p>
      </div>
    </div>
  );
}
