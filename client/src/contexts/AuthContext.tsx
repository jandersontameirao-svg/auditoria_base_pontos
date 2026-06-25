import React, { createContext, useContext, useState } from "react";

interface Usuario {
  usuario: string;
  nome: string;
}

interface AuthContextType {
  user: Usuario | null;
  login: (usuario: string, senha: string) => boolean;
  logout: () => void;
}

// Login simples (uso interno Grupo Arqueo). Para alterar credenciais, edite a lista abaixo.
const CREDENCIAIS: Record<string, { senha: string; nome: string }> = {
  arqueo: { senha: "arqueo10anos", nome: "Equipe Arqueo" },
  admin: { senha: "arqueo2026", nome: "Administrador" },
  auditoria: { senha: "pontos", nome: "Auditoria de Campo" },
};

const STORAGE_KEY = "arqueo_auth";
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Usuario) : null;
    } catch {
      return null;
    }
  });

  const login = (usuario: string, senha: string): boolean => {
    const u = usuario.trim().toLowerCase();
    const found = CREDENCIAIS[u];
    if (found && found.senha === senha) {
      const sess: Usuario = { usuario: u, nome: found.nome };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sess));
      setUser(sess);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
