import type { MockPaymentResult, MockScenario, RuntimeConfig } from "../runtime";

export function getDelayMs(config: Pick<RuntimeConfig, "mockScenario">) {
  return config.mockScenario === "slow" ? 900 : 300;
}

export function shouldReturnEmpty(config: Pick<RuntimeConfig, "mockScenario">) {
  return config.mockScenario === "empty";
}

export function shouldThrowMockError(config: Pick<RuntimeConfig, "mockScenario">) {
  return config.mockScenario === "error";
}

export async function mockDelay(config: Pick<RuntimeConfig, "mockScenario">) {
  await new Promise((resolve) => setTimeout(resolve, getDelayMs(config)));
}

export type { MockPaymentResult, MockScenario };