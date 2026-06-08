export const DATA_SOURCE_MODES = ["mock", "api"] as const;

export type DataSourceMode = (typeof DATA_SOURCE_MODES)[number];

const DEFAULT_DATA_SOURCE_MODE: DataSourceMode = "mock";

const isDataSourceMode = (value: string): value is DataSourceMode =>
  DATA_SOURCE_MODES.includes(value as DataSourceMode);

export const getDataSourceMode = (): DataSourceMode => {
  const value = import.meta.env.VITE_DATA_SOURCE;

  if (typeof value !== "string") {
    return DEFAULT_DATA_SOURCE_MODE;
  }

  const normalizedValue = value.trim().toLowerCase();

  return isDataSourceMode(normalizedValue)
    ? normalizedValue
    : DEFAULT_DATA_SOURCE_MODE;
};

export const isMockMode = (): boolean => getDataSourceMode() === "mock";

export const isApiMode = (): boolean => getDataSourceMode() === "api";
