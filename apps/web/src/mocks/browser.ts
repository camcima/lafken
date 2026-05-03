import { setupWorker } from "msw/browser";

import { handlers } from "./handlers";

const worker = setupWorker(...handlers);
const IGNORED_INTERCEPTS = ["faro-collector", "grafana.net", "src", "tsx", "js", "png", "fonts"];

export async function enableMocking() {
  if (import.meta.env.VITE_MOCKED_API !== "true") {
    return;
  }

  await worker.start({
    onUnhandledRequest: (request, print) => {
      if (IGNORED_INTERCEPTS.some((ignored) => request.url.includes(ignored))) {
        return;
      }
      print.warning();
    },
  });
}
