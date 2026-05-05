import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AssetImage } from "../src/index";

describe("AssetImage", () => {
  it("renders <img> with the named preset's URL", () => {
    const { container } = render(
      <AssetImage
        asset={{
          previewUrls: {
            thumbnail: "https://cdn.example/thumb.webp",
            preview: "https://cdn.example/preview.webp",
          },
        }}
        preset="thumbnail"
        alt="cover"
      />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe("https://cdn.example/thumb.webp");
    expect(img!.getAttribute("alt")).toBe("cover");
    expect(img!.getAttribute("loading")).toBe("lazy");
    expect(img!.getAttribute("decoding")).toBe("async");
  });

  it("falls back to the first preview URL when preset is omitted", () => {
    const { container } = render(
      <AssetImage
        asset={{ previewUrls: { thumbnail: "https://cdn.example/first.webp" } }}
        alt=""
      />,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://cdn.example/first.webp",
    );
  });

  it("falls back to the first URL when the named preset is missing", () => {
    const { container } = render(
      <AssetImage
        asset={{ previewUrls: { thumbnail: "https://cdn.example/thumb.webp" } }}
        preset="missing"
        alt=""
      />,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://cdn.example/thumb.webp",
    );
  });

  it("renders nothing when asset has no previewUrls", () => {
    const { container } = render(<AssetImage asset={{}} alt="" />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders nothing when previewUrls is empty", () => {
    const { container } = render(<AssetImage asset={{ previewUrls: {} }} alt="" />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders nothing when asset is null", () => {
    const { container } = render(<AssetImage asset={null} alt="" />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("hides the image after onError fires", () => {
    const { container } = render(
      <AssetImage
        asset={{ previewUrls: { thumbnail: "https://cdn.example/broken.webp" } }}
        alt=""
      />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    fireEvent.error(img!);
    expect(container.querySelector("img")).toBeNull();
  });

  it("forwards arbitrary <img> attributes", () => {
    const { container } = render(
      <AssetImage
        asset={{ previewUrls: { thumbnail: "https://cdn.example/thumb.webp" } }}
        className="foo"
        data-testid="bar"
        alt=""
      />,
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("class")).toBe("foo");
    expect(img?.getAttribute("data-testid")).toBe("bar");
  });
});
