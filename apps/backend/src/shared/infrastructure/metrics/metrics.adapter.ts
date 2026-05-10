import { Injectable } from "@nestjs/common";
import { type Counter, type Histogram, metrics, type ObservableGauge } from "@opentelemetry/api";

import {
  type IQueueDepthSampler,
  MetricsPort,
  type ProcessingReleaseReason,
  type ProcessingStep,
  type ProcessingStepDecision,
  type ProcessingTerminalState,
  type UploadProtocol,
} from "@/shared/application/metrics.port";

@Injectable()
export class OpenTelemetryMetricsAdapter extends MetricsPort {
  private readonly uploadIntentCreated: Counter;
  private readonly uploadIntentRefreshed: Counter;
  private readonly uploadConfirmed: Counter;
  private readonly uploadIntentExpiredSwept: Counter;
  private readonly processingJobClaimed: Counter;
  private readonly processingJobReleased: Counter;
  private readonly processingStepDuration: Histogram;
  private readonly processingStepOutcome: Counter;
  private readonly processingRetry: Counter;
  private readonly processingWorkflowTimeout: Counter;
  private readonly processingTerminalState: Counter;
  private readonly processingQueueDepth: ObservableGauge;
  private readonly processingStaleClaimReclaimed: Counter;

  constructor() {
    super();
    const meter = metrics.getMeter("lafken");
    this.uploadIntentCreated = meter.createCounter("lafken.upload.intent.created", {
      description: "Number of upload intents created",
    });
    this.uploadIntentRefreshed = meter.createCounter("lafken.upload.intent.refreshed", {
      description: "Number of upload intent URL refreshes issued",
    });
    this.uploadConfirmed = meter.createCounter("lafken.upload.confirmed", {
      description: "Number of uploads confirmed and promoted to assets",
    });
    this.uploadIntentExpiredSwept = meter.createCounter("lafken.upload.intent.expired_swept", {
      description: "Number of orphan upload intents expired by the sweeper",
    });
    this.processingJobClaimed = meter.createCounter("lafken.processing.job.claimed", {
      description: "Number of processing jobs claimed by a worker",
    });
    this.processingJobReleased = meter.createCounter("lafken.processing.job.released", {
      description: "Number of processing jobs released back to the queue (with reason)",
    });
    this.processingStepDuration = meter.createHistogram("lafken.processing.step.duration", {
      description: "Duration of a processing pipeline step in milliseconds",
      unit: "ms",
    });
    this.processingStepOutcome = meter.createCounter("lafken.processing.step.outcome", {
      description: "Outcome of a processing pipeline step (with step, decision)",
    });
    this.processingRetry = meter.createCounter("lafken.processing.retry", {
      description: "Number of processing retries (with error_class)",
    });
    this.processingWorkflowTimeout = meter.createCounter("lafken.processing.workflow_timeout", {
      description: "Number of workflow-timeout terminations",
    });
    this.processingTerminalState = meter.createCounter("lafken.processing.terminal_state", {
      description: "Number of assets reaching a terminal processing state (with state)",
    });
    this.processingQueueDepth = meter.createObservableGauge("lafken.processing.queue_depth", {
      description: "Sampled depth of the processing queue (released or due jobs)",
    });
    this.processingStaleClaimReclaimed = meter.createCounter(
      "lafken.processing.stale_claim_reclaimed",
      {
        description: "Number of stale processing claims reclaimed by the sweeper",
      },
    );
  }

  recordUploadIntentCreated(input: { namespaceSlug: string; protocol: UploadProtocol }): void {
    this.uploadIntentCreated.add(1, {
      namespace_slug: input.namespaceSlug,
      protocol: input.protocol,
    });
  }

  recordUploadIntentRefreshed(input: { namespaceSlug: string }): void {
    this.uploadIntentRefreshed.add(1, { namespace_slug: input.namespaceSlug });
  }

  recordUploadConfirmed(input: { namespaceSlug: string; state: string }): void {
    this.uploadConfirmed.add(1, { namespace_slug: input.namespaceSlug, state: input.state });
  }

  recordUploadIntentExpiredSwept(input: { namespaceSlug: string }): void {
    this.uploadIntentExpiredSwept.add(1, { namespace_slug: input.namespaceSlug });
  }

  recordProcessingJobClaimed(): void {
    this.processingJobClaimed.add(1);
  }

  recordProcessingJobReleased(input: { reason: ProcessingReleaseReason }): void {
    this.processingJobReleased.add(1, { reason: input.reason });
  }

  recordProcessingStepDuration(input: {
    step: ProcessingStep;
    decision: ProcessingStepDecision;
    durationMs: number;
  }): void {
    this.processingStepDuration.record(input.durationMs, {
      step: input.step,
      decision: input.decision,
    });
  }

  recordProcessingStepOutcome(input: {
    step: ProcessingStep;
    decision: ProcessingStepDecision;
  }): void {
    this.processingStepOutcome.add(1, { step: input.step, decision: input.decision });
  }

  recordProcessingRetry(input: { errorClass: string }): void {
    this.processingRetry.add(1, { error_class: input.errorClass });
  }

  recordProcessingWorkflowTimeout(): void {
    this.processingWorkflowTimeout.add(1);
  }

  recordProcessingTerminalState(input: { state: ProcessingTerminalState }): void {
    this.processingTerminalState.add(1, { state: input.state });
  }

  recordProcessingStaleClaimReclaimed(input: { count: number }): void {
    this.processingStaleClaimReclaimed.add(input.count);
  }

  registerQueueDepthSampler(sampler: IQueueDepthSampler): void {
    this.processingQueueDepth.addCallback(async (result) => {
      try {
        const depth = await sampler();
        result.observe(depth);
      } catch {
        // sampler failures are intentionally swallowed; OTel must not throw from a callback.
      }
    });
  }
}
