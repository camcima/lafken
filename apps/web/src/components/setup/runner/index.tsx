import { PropsWithChildren, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { BrandedScreen } from "@/components/common/BrandedScreen";
import { Button } from "@/components/common/Button";
import Spinner from "@/components/common/Spinner";
import type { SetupStep, StepFailure } from "@/components/setup/types";

interface BootstrapRunnerProps {
  steps: SetupStep[];
}

type RedirectState = {
  message: string;
  delayMs: number;
  executeRedirect: () => void;
};

type Status = "running" | "failed" | "complete" | "redirecting";

export default function BootstrapRunner({
  steps,
  children,
}: Readonly<PropsWithChildren<BootstrapRunnerProps>>) {
  const { t } = useTranslation();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [status, setStatus] = useState<Status>("running");
  const [stepError, setStepError] = useState<StepFailure | null>(null);
  const [redirect, setRedirect] = useState<RedirectState | null>(null);
  const stepsRef = useRef(steps);

  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  const runStepsFrom = useCallback(async (startIndex: number) => {
    const stepsList = stepsRef.current;
    setStatus("running");
    setStepError(null);
    setRedirect(null);

    for (let i = startIndex; i < stepsList.length; i += 1) {
      setCurrentStepIndex(i);
      const step = stepsList[i];
      const result = await step.run();

      if (result.type === "redirect") {
        setRedirect({
          message: result.message,
          delayMs: result.delayMs,
          executeRedirect: result.executeRedirect,
        });
        setStatus("redirecting");
        return;
      }

      if (result.type === "failure") {
        setStepError(result);
        setStatus("failed");
        return;
      }
    }

    setStatus("complete");
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void runStepsFrom(0);
    }, 0);

    return () => {
      clearTimeout(id);
    };
  }, [runStepsFrom]);

  useEffect(() => {
    if (status !== "redirecting" || !redirect) return;
    const id = setTimeout(() => {
      redirect.executeRedirect();
    }, redirect.delayMs);
    return () => {
      clearTimeout(id);
    };
  }, [status, redirect]);

  const handleRetry = useCallback(() => {
    void runStepsFrom(currentStepIndex);
  }, [currentStepIndex, runStepsFrom]);

  if (status === "complete" || steps.length === 0) {
    return <>{children}</>;
  }

  if (status === "redirecting" && redirect) {
    return (
      <BrandedScreen>
        <Spinner />
        <p className="mt-4 text-neutral-700">{redirect.message}</p>
      </BrandedScreen>
    );
  }

  if (status === "failed" && stepError) {
    return (
      <BrandedScreen>
        <svg
          aria-hidden="true"
          className="mb-4 h-12 w-12 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <h2 className="mb-2 text-xl font-semibold text-neutral-900">{stepError.errorTitle}</h2>
        <p className="mb-6 text-neutral-600">{stepError.errorDescription}</p>
        <Button onClick={handleRetry} variant="pink" className="h-12 w-full">
          {t("common.actions.retry")}
        </Button>
      </BrandedScreen>
    );
  }

  const currentStep = steps[currentStepIndex];

  return (
    <BrandedScreen>
      <Spinner />
      <p className="mt-4 text-neutral-700">{currentStep.message}</p>
    </BrandedScreen>
  );
}
