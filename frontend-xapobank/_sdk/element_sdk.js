// Minimal element_sdk shim used by the frontend for config editing.
(function(){
  window.elementSdk = {
    init(options) {
      // call onConfigChange immediately with defaults if provided
      if (options && options.onConfigChange && options.defaultConfig) {
        options.onConfigChange(options.defaultConfig);
      }
      return {
        setConfig: async (cfg) => {
          // no-op: in a real integration this would persist config
          if (options && options.onConfigChange) options.onConfigChange(cfg);
        }
      };
    }
  };
})();
