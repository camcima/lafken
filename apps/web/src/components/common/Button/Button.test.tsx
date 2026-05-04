import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "./index";

describe("button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("rendering", () => {
    it("renders with default props", () => {
      render(<Button>Click me</Button>);

      const button = screen.getByRole("button", { name: "Click me" });

      expect(button).toBeDefined();
      expect(button).toHaveAttribute("data-slot", "button");
    });

    it("renders with custom text", () => {
      render(<Button>Custom Button Text</Button>);

      expect(screen.getByText("Custom Button Text")).toBeInTheDocument();
    });

    it("renders as a different element when asChild is true", () => {
      render(
        <Button asChild>
          <a href="/test">Link Button</a>
        </Button>,
      );

      const link = screen.getByRole("link", { name: "Link Button" });

      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/test");
    });

    it("applies custom className", () => {
      render(<Button className="custom-class">Button</Button>);

      const button = screen.getByRole("button");

      expect(button).toHaveClass("custom-class");
    });
  });

  describe("variants", () => {
    it("applies default variant styles", () => {
      render(<Button>Default</Button>);

      const button = screen.getByRole("button");

      expect(button).toHaveClass("bg-primary", "text-primary-foreground");
    });

    it("applies destructive variant styles", () => {
      render(<Button variant="destructive">Destructive</Button>);

      const button = screen.getByRole("button");

      expect(button).toHaveClass("bg-destructive", "text-white");
    });

    it("applies outline variant styles", () => {
      render(<Button variant="outline">Outline</Button>);

      const button = screen.getByRole("button");

      expect(button).toHaveClass("border", "bg-card", "text-foreground");
    });

    it("applies secondary variant styles", () => {
      render(<Button variant="secondary">Secondary</Button>);

      const button = screen.getByRole("button");

      expect(button).toHaveClass("bg-secondary", "text-secondary-foreground");
    });

    it("applies ghost variant styles", () => {
      render(<Button variant="ghost">Ghost</Button>);

      const button = screen.getByRole("button");

      expect(button).toHaveClass("hover:bg-secondary", "hover:text-foreground");
    });

    it("applies link variant styles", () => {
      render(<Button variant="link">Link</Button>);

      const button = screen.getByRole("button");

      expect(button).toHaveClass("text-primary", "underline-offset-4");
    });
  });

  describe("sizes", () => {
    it("applies default size styles", () => {
      render(<Button>Default Size</Button>);

      const button = screen.getByRole("button");

      expect(button).toHaveClass("h-8", "px-3");
    });

    it("applies small size styles", () => {
      render(<Button size="sm">Small</Button>);

      const button = screen.getByRole("button");

      expect(button).toHaveClass("h-7", "rounded-md");
    });

    it("applies large size styles", () => {
      render(<Button size="lg">Large</Button>);

      const button = screen.getByRole("button");

      expect(button).toHaveClass("h-9", "rounded-md");
    });

    it("applies icon size styles", () => {
      render(<Button size="icon">Icon</Button>);

      const button = screen.getByRole("button");

      expect(button).toHaveClass("size-8");
    });

    it("applies icon-sm size styles", () => {
      render(<Button size="icon-sm">Icon Small</Button>);

      const button = screen.getByRole("button");

      expect(button).toHaveClass("size-6");
    });

    it("applies icon-lg size styles", () => {
      render(<Button size="icon-lg">Icon Large</Button>);

      const button = screen.getByRole("button");

      expect(button).toHaveClass("size-9");
    });
  });

  describe("interactions", () => {
    it("handles click events", async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(<Button onClick={handleClick}>Click me</Button>);

      const button = screen.getByRole("button");
      await user.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("handles multiple clicks", async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(<Button onClick={handleClick}>Click me</Button>);

      const button = screen.getByRole("button");
      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(handleClick).toHaveBeenCalledTimes(3);
    });

    it("does not trigger click when disabled", async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(
        <Button onClick={handleClick} disabled>
          Disabled Button
        </Button>,
      );

      const button = screen.getByRole("button");
      await user.click(button);

      expect(handleClick).not.toHaveBeenCalled();
    });

    it("handles keyboard interactions", async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(<Button onClick={handleClick}>Keyboard Button</Button>);

      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard("{Enter}");

      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("accessibility", () => {
    it("supports aria-label", () => {
      render(<Button aria-label="Close dialog">×</Button>);

      const button = screen.getByRole("button", { name: "Close dialog" });

      expect(button).toBeInTheDocument();
    });

    it("supports aria-describedby", () => {
      render(
        <div>
          <Button aria-describedby="help-text">Submit</Button>
          <div id="help-text">This will submit the form</div>
        </div>,
      );

      const button = screen.getByRole("button");

      expect(button).toHaveAttribute("aria-describedby", "help-text");
    });

    it("supports aria-pressed for toggle buttons", () => {
      render(<Button aria-pressed="true">Toggle</Button>);

      const button = screen.getByRole("button");

      expect(button).toHaveAttribute("aria-pressed", "true");
    });

    it("supports aria-expanded for expandable buttons", () => {
      render(<Button aria-expanded="false">Menu</Button>);

      const button = screen.getByRole("button");

      expect(button).toHaveAttribute("aria-expanded", "false");
    });

    it("has proper focus styles", () => {
      render(<Button>Focusable Button</Button>);

      const button = screen.getByRole("button");

      expect(button).toHaveClass("outline-none", "focus-visible:border-ring");
    });
  });

  describe("disabled State", () => {
    it("applies disabled styles", () => {
      render(<Button disabled>Disabled</Button>);

      const button = screen.getByRole("button");

      expect(button).toBeDisabled();
      expect(button).toHaveClass("disabled:pointer-events-none", "disabled:opacity-50");
    });

    it("prevents pointer events when disabled", () => {
      render(<Button disabled>Disabled</Button>);

      const button = screen.getByRole("button");

      expect(button).toHaveClass("disabled:pointer-events-none");
    });
  });

  describe("type Safety", () => {
    it("accepts all HTML button attributes", () => {
      render(
        <Button type="submit" form="test-form" value="submit-value" name="submit-button">
          Submit
        </Button>,
      );

      const button = screen.getByRole("button");

      expect(button).toHaveAttribute("type", "submit");
      expect(button).toHaveAttribute("form", "test-form");
      expect(button).toHaveAttribute("value", "submit-value");
      expect(button).toHaveAttribute("name", "submit-button");
    });
  });

  describe("combined Props", () => {
    it("combines variant and size correctly", () => {
      render(
        <Button variant="destructive" size="lg">
          Large Destructive
        </Button>,
      );

      const button = screen.getByRole("button");

      expect(button).toHaveClass("bg-destructive", "h-9");
    });

    it("combines all props correctly", () => {
      render(
        <Button variant="outline" size="sm" className="custom-class" disabled>
          Custom Button
        </Button>,
      );

      const button = screen.getByRole("button");

      expect(button).toHaveClass("border", "h-7", "custom-class");
      expect(button).toBeDisabled();
    });
  });

  describe("edge Cases", () => {
    it("handles empty children", () => {
      render(<Button></Button>);

      const button = screen.getByRole("button");

      expect(button).toBeInTheDocument();
    });

    it("handles null children", () => {
      render(<Button>{null}</Button>);

      const button = screen.getByRole("button");

      expect(button).toBeInTheDocument();
    });

    it("handles undefined variant gracefully", () => {
      render(<Button variant={undefined}>Button</Button>);

      const button = screen.getByRole("button");

      expect(button).toBeInTheDocument();
      // Should fall back to default variant
      expect(button).toHaveClass("bg-primary");
    });

    it("handles undefined size gracefully", () => {
      render(<Button size={undefined}>Button</Button>);

      const button = screen.getByRole("button");

      expect(button).toBeInTheDocument();
      // Should fall back to default size
      expect(button).toHaveClass("h-8");
    });
  });
});
