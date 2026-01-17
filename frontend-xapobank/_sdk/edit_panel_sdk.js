// Minimal edit_panel_sdk shim
(function(){
  window.editPanelSdk = {
    init(options) {
      // expose a simple API — call onChange when a config is changed
      return { onChange: options && options.onChange ? options.onChange : () => {} };
    }
  };
})();
