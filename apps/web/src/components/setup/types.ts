export type StepFailure = {
  type: "failure";
  failed: true;
  errorTitle: string;
  errorDescription: string;
};

export type StepSuccess = {
  type: "success";
  failed: false;
};

export type StepRedirect = {
  type: "redirect";
  message: string;
  delayMs: number;
  executeRedirect: () => void;
};

export type StepResult = StepSuccess | StepFailure | StepRedirect;

export interface SetupStep {
  id: string;
  message: string;
  run: () => Promise<StepResult>;
}
