---
name: backend-event-ingestion
description: Implements HTTP-based event ingestion endpoints for receiving events from message brokers via sinks (Kafka Connect, Datadog Vector). Covers endpoint conventions, DTO validation, idempotency, and E2E testing. Use when creating event receiver endpoints or integrating with event streaming pipelines.
---

# Receiving Events via HTTP Endpoints

## Architecture Principle

**No direct broker clients** (Kafka, Google Pub/Sub). Events are delivered via HTTP sinks:

- Kafka Connect HTTP Sink
- Redpanda Connect
- Datadog Vector

The backend exposes HTTP endpoints that receive event payloads as regular REST requests.

## Endpoint Convention

```
POST /v1/events/<event-name>
```

Example: `POST /v1/events/order-placed`

## Controller Structure

```typescript
@Controller("events")
@ApiTags("Events")
export class EventIngestionController {
  constructor(private readonly processOrderPlacedUseCase: ProcessOrderPlacedUseCase) {}

  @Post("order-placed")
  @ApiOperation({ summary: "Receive order-placed event from event pipeline" })
  @ApiOkResponse({ description: "Event processed successfully" })
  async handleOrderPlaced(@Body() eventDto: OrderPlacedEventDTO): Promise<void> {
    await this.processOrderPlacedUseCase.execute({
      orderId: eventDto.orderId,
      timestamp: eventDto.timestamp,
      payload: eventDto.data,
    });
  }
}
```

## Event DTO Validation

```typescript
export class OrderPlacedEventDTO {
  @IsUUID()
  @ApiProperty()
  eventId: string; // For idempotency

  @IsString()
  @ApiProperty()
  orderId: string;

  @IsDateString()
  @ApiProperty()
  timestamp: string;

  @ValidateNested()
  @Type(() => OrderPlacedDataDTO)
  @ApiProperty()
  data: OrderPlacedDataDTO;
}
```

## Idempotency

Events may be delivered multiple times. Ensure idempotency via:

1. **Event ID**: Use `eventId` field as deduplication key
2. **Message keys**: Check for duplicate processing based on business keys
3. **Database constraints**: Use UPSERT or check-before-insert patterns

```typescript
async execute(input: ProcessOrderPlacedInput): Promise<void> {
  // Check if already processed
  const existing = await this.eventLogRepository.findByEventId(input.eventId);
  if (existing) return; // Already processed, skip

  await this.unitOfWork.execute(async () => {
    // Process the event
    await this.orderService.processPlacement(input);
    // Log the event as processed
    await this.eventLogRepository.save({ eventId: input.eventId, processedAt: new Date() });
  });
}
```

## Rules

- Treat event deliveries as **regular REST requests** with DTOs
- Validate ALL payloads with `class-validator`
- Return appropriate HTTP status codes (200 OK, 400 Bad Request, 422 Unprocessable)
- Document in OpenAPI/Swagger
- **Ensure idempotency** - events may be delivered more than once
- Log with correlation IDs for traceability

## E2E Testing

```typescript
describe("Event Ingestion - POST /v1/events/order-placed", () => {
  test("should process a valid order-placed event", async () => {
    // #region [db-setup]
    // ... seed required data ...
    // #endregion

    const res = await request(underlyingHttpServer).post("/v1/events/order-placed").send({
      eventId: "evt-123",
      orderId: "order-456",
      timestamp: "2025-01-15T10:00:00Z",
      data: {
        /* event payload */
      },
    });

    expect.soft(res.statusCode).toBe(HttpStatus.OK);

    // #region [db-checking]
    // Verify event was processed in DB
    // #endregion

    // #region [db-cleanup]
    // Clean up test data
    // #endregion
  });

  test("should be idempotent - processing same event twice", async () => {
    // Send same event twice, verify no duplicate processing
  });
});
```
