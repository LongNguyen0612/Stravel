export class SSEClient {
  private eventSource: EventSource | null = null;

  connect(sessionId: string, onEvent: (eventType: string, data: unknown) => void): void {
    this.disconnect();

    this.eventSource = new EventSource(`/api/v1/stream/${sessionId}`);

    const eventTypes = [
      "agent.profiling.question",
      "agent.calculation.result",
      "agent.compliance.flag",
      "stage.change",
      "agent.error",
      "proposal.ready",
      "heartbeat",
    ];

    for (const type of eventTypes) {
      this.eventSource.addEventListener(type, (e) => {
        onEvent(type, JSON.parse((e as MessageEvent).data));
      });
    }
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  get isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }
}
