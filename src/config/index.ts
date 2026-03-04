export { ConfigSchema, CONFIG_DEFAULTS, type CurioConfig } from "./schema.js";
export {
  getCurioHome,
  getConfigPaths,
  loadConfig,
  getConfigValue,
  initProjectConfig,
  setConfigValue,
  type LoadConfigOptions,
  type LoadedConfig,
} from "./loader.js";
