export type DataMode = "mock" | "api";

export type MockScenario = "success" | "empty" | "error" | "slow";

export type MockPaymentResult = "success" | "fail" | "pending";

export interface RuntimeConfig {
  dataMode: DataMode;
  apiBaseUrl: string;
  mockScenario: MockScenario;
  mockPaymentResult: MockPaymentResult;
  mockHoldTtlSeconds: number;
}

const DEFAULT_CONFIG: RuntimeConfig = {
  dataMode: "mock",
  apiBaseUrl: "http://localhost:8000",
  mockScenario: "success",
  mockPaymentResult: "success",
  mockHoldTtlSeconds: 30,
};

function parseDataMode(value: string | undefined): DataMode {
  return value === "api" ? "api" : "mock";
}

function parseScenario(value: string | undefined): MockScenario {
  if (value === "empty" || value === "error" || value === "slow") {
    return value;
  }

  return "success";
}

function parsePaymentResult(value: string | undefined): MockPaymentResult {
  if (value === "fail" || value === "pending") {
    return value;
  }

  return "success";
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readRuntimeConfig(): RuntimeConfig {
  return {
    dataMode: parseDataMode(process.env.VITE_DATA_MODE),
    apiBaseUrl: process.env.VITE_API_BASE_URL ?? DEFAULT_CONFIG.apiBaseUrl,
    mockScenario: parseScenario(process.env.VITE_MOCK_SCENARIO),
    mockPaymentResult: parsePaymentResult(process.env.VITE_MOCK_PAYMENT_RESULT),
    mockHoldTtlSeconds: parsePositiveInt(
      process.env.VITE_MOCK_HOLD_TTL_SECONDS,
      DEFAULT_CONFIG.mockHoldTtlSeconds
    ),
  };
}