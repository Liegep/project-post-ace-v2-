import { useEffect, useRef, useState } from "react";

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

  const scopeRef = useRef(deps[0]);
  useEffect(() => {
    let active = true;
    const scopeChanged = scopeRef.current !== deps[0];
    scopeRef.current = deps[0];

    // Keep the current data on screen while fresh data arrives. Replacing it
    // with the fallback made every small action look like a full reload.
    setState((current) => ({
      ...current,
      data: scopeChanged ? fallback : current.data,
      loading: true,
      source: "backend",
      message: "Atualizando dados.",
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
          error instanceof Error ? error.message : "Sem conexão com a API da V2.";

        // A temporary API failure must never be interpreted as "there is no
        // data". Preserve the last successful snapshot on screen so a timeout,
        // busy server or transient database error cannot make the Kanban or
        // other resources using this hook appear to have been erased.
        setState((current) => ({
          ...current,
          loading: false,
          source: "error",
          message: `Não consegui atualizar os dados. Mantendo a última versão carregada. ${description}`,
        }));
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
