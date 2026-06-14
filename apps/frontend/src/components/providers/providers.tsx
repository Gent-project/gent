"use client";

/**
 * Application root providers.
 *
 * Order matters here:
 *   ReduxProvider must wrap QueryClientProvider so hooks that consume both
 *   (e.g. `useAuth`) can read store state inside query callbacks.
 */
import { ReactNode, useState } from "react";
import { Provider as ReduxProvider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { store } from "@/store";

export function Providers({ children }: { children: ReactNode }) {
  // One client per browser session — kept stable across renders.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </ReduxProvider>
  );
}
