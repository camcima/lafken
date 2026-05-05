import type { LafkenClient } from "@lafken/client";
import React, { createContext, type ReactNode, useContext } from "react";

const LafkenClientContext = createContext<LafkenClient | null>(null);

/** @internal — exported for use by other @lafken/react components like <AssetImage>. */
export const _LafkenClientContext = LafkenClientContext;

export interface ILafkenProviderProps {
  client: LafkenClient;
  children: ReactNode;
}

export function LafkenProvider(props: ILafkenProviderProps): React.JSX.Element {
  return (
    <LafkenClientContext.Provider value={props.client}>
      {props.children}
    </LafkenClientContext.Provider>
  );
}

export function useLafkenClient(): LafkenClient {
  const client = useContext(LafkenClientContext);
  if (client === null) {
    throw new Error("useLafkenClient must be used inside a <LafkenProvider>");
  }
  return client;
}
