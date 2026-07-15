import { useNavigate, useSearch } from "@tanstack/react-router";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { renderWithRouter } from "./render-with-router";

const searchSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
});

// `/_protected/probe/` and `/probe` are synthetic ids that exist only inside
// this self-test's harness-built route tree, not in the app's real
// `routeTree.gen.ts`. The app-wide `Register` type merge (also declared in
// that file) makes `useSearch`/`useNavigate` reject any `from`/`to` outside
// the REAL route set at compile time, so those two literals are cast to
// bypass that check; the destructured/`navigate` shapes are cast back to
// concrete types so the rest of the component stays type-safe.
function ProbePage() {
  const searchResult: { page: number } = useSearch({ from: "/_protected/probe/" as never });
  const { page } = searchResult;
  const navigate = useNavigate();
  return (
    <div>
      <span data-testid="page">{page}</span>
      <button
        type="button"
        onClick={() => {
          void navigate({ to: "/probe", search: { page: page + 1 } } as never);
        }}
      >
        next
      </button>
    </div>
  );
}

afterEach(cleanup);

describe("renderWithRouter", () => {
  it("resolves strict useSearch({ from }) against the recreated index-route id", async () => {
    await renderWithRouter(
      { path: "probe", index: true, component: ProbePage, validateSearch: searchSchema },
      "/probe?page=3",
    );
    expect(await screen.findByTestId("page")).toHaveTextContent("3");
  });

  it("applies schema defaults and lets navigate({ search }) write the URL", async () => {
    const { router } = await renderWithRouter(
      { path: "probe", index: true, component: ProbePage, validateSearch: searchSchema },
      "/probe",
    );
    expect(await screen.findByTestId("page")).toHaveTextContent("1");

    await userEvent.click(screen.getByRole("button", { name: "next" }));

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ page: 2 });
    });
    expect(screen.getByTestId("page")).toHaveTextContent("2");
  });
});
