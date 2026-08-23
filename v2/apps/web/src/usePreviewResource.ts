import { useEffect, useState } from "react";

type ResourceState<T> = {
  data: T;
  loading: boolean;
  source: "backend" | "error";
  message: string;
};

export function usePreviewResource<T>(
  fallback: T,
  loader: () => Promise<T>,
  deps: readonly unknown[],
) {
  const [state, setState] = useState<ResourceState<T>>({
    data: fallback,
    loading: true,
    source: "backend",
    message: "Conectando ao banco real da V2.",
  });

  useEffect(() => {
    let active = true;

    // Keep the current board on screen while fresh data arrives. Replacing it
    // with the fallback made every small card action look like a full reload.
    setState((current) => ({
      ...current,
      loading: true,
      source: "backend",
      message: "Atualizando dados do Kanban.",
    }));

    loader()
      .then((data) => {
        if (!active) return;
        setState({
          data,
          loading: false,
          source: "backend",
          message: "Dados reais carregados da V2.",
        });
      })
      .catch((error) => {
        if (!active) return;
        const description =
          error instanceof Error ? error.message : "Sem conexao com a API da V2.";
        setState({
          data: fallback,
          loading: false,
          source: "error",
          message: `Nao consegui carregar os dados reais. ${description}`,
        });
      });

    return () => {
      active = false;
    };
  }, deps);

  const setData = (update: T | ((current: T) => T)) => {
    setState((current) => ({
      ...current,
      data: typeof update === "function" ? (update as (current: T) => T)(current.data) : update,
    }));
  };

  return { ...state, setData };
}
