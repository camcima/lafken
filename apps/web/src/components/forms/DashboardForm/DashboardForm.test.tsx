import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DashboardForm } from "./index";

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "dashboard.quickForm.name": "Name",
        "dashboard.quickForm.submit": "Submit",
        "dashboard.quickForm.reset": "Reset",
      };
      return translations[key] ?? key;
    },
  }),
}));

describe("DashboardForm", () => {
  beforeEach(() => {
    // Clear DOM between tests
    document.body.innerHTML = "";
  });

  describe("Rendering", () => {
    it("renders form with all fields", () => {
      render(<DashboardForm />);

      expect(screen.getByLabelText("Name")).toBeInTheDocument();
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
    });

    it("renders with proper input types", () => {
      render(<DashboardForm />);

      const nameInput = screen.getByLabelText("Name");
      const emailInput = screen.getByLabelText("Email");

      // Default input type is "text" (no explicit type attribute)
      expect(nameInput).not.toHaveAttribute("type");
      expect(emailInput).toHaveAttribute("type", "email");
    });

    it("renders with custom className", () => {
      render(<DashboardForm className="custom-form" />);

      const form = document.querySelector("form");
      expect(form).toHaveClass("custom-form");
    });
  });

  describe("Form Interactions", () => {
    it("handles form submission with valid data", async () => {
      const user = userEvent.setup();
      const onSubmitSuccess = vi.fn();
      render(<DashboardForm onSubmitSuccess={onSubmitSuccess} />);

      const nameInput = screen.getByLabelText("Name");
      const emailInput = screen.getByLabelText("Email");
      const submitButton = screen.getByRole("button", { name: "Submit" });

      await user.type(nameInput, "John Doe");
      await user.type(emailInput, "john@example.com");
      await user.click(submitButton);

      await waitFor(() => {
        expect(onSubmitSuccess).toHaveBeenCalledWith({
          name: "John Doe",
          email: "john@example.com",
        });
      });
    });

    it("handles form reset", async () => {
      const user = userEvent.setup();
      render(<DashboardForm />);

      const nameInput = screen.getByLabelText("Name");
      const emailInput = screen.getByLabelText("Email");
      const resetButton = screen.getByRole("button", { name: "Reset" });

      await user.type(nameInput, "John Doe");
      await user.type(emailInput, "john@example.com");
      await user.click(resetButton);

      expect(nameInput).toHaveValue("");
      expect(emailInput).toHaveValue("");
    });
  });

  describe.todo("Form Validation", () => {
    it("shows validation errors for invalid data", async () => {
      const user = userEvent.setup();
      render(<DashboardForm />);

      const nameInput = screen.getByLabelText("Name");
      const emailInput = screen.getByLabelText("Email");
      const submitButton = screen.getByRole("button", { name: "Submit" });

      await user.type(nameInput, "J");
      await user.type(emailInput, "invalid-email");
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Name must be at least 2 characters")).toBeInTheDocument();
        expect(screen.getByText("Please enter a valid email")).toBeInTheDocument();
      });
    });

    it("validates email format", async () => {
      const user = userEvent.setup();
      render(<DashboardForm />);

      const emailInput = screen.getByLabelText("Email");
      const submitButton = screen.getByRole("button", { name: "Submit" });

      await user.type(emailInput, "not-an-email");
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Please enter a valid email")).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles form submission without onSubmitSuccess callback", async () => {
      const user = userEvent.setup();
      render(<DashboardForm />);

      const nameInput = screen.getByLabelText("Name");
      const emailInput = screen.getByLabelText("Email");
      const submitButton = screen.getByRole("button", { name: "Submit" });

      await user.type(nameInput, "John Doe");
      await user.type(emailInput, "john@example.com");
      await user.click(submitButton);

      // Should not throw an error
      expect(submitButton).toBeInTheDocument();
    });

    it("handles very long valid input", async () => {
      const user = userEvent.setup();
      const onSubmitSuccess = vi.fn();
      render(<DashboardForm onSubmitSuccess={onSubmitSuccess} />);

      const nameInput = screen.getByLabelText("Name");
      const emailInput = screen.getByLabelText("Email");
      const submitButton = screen.getByRole("button", { name: "Submit" });

      const longName = "A".repeat(50); // Maximum allowed length
      const longEmail = "a".repeat(50) + "@example.com"; // Within 100 character limit

      await user.type(nameInput, longName);
      await user.type(emailInput, longEmail);
      await user.click(submitButton);

      await waitFor(() => {
        expect(onSubmitSuccess).toHaveBeenCalledWith({
          name: longName,
          email: longEmail,
        });
      });
    });
  });
});
