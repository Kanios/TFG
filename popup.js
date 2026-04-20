//Cargar la configuración al abrir el popup
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.sync.get('configuracion', (data) => {
        const config = data.configuracion || { mostrarColores: true };
        document.getElementById('toggle-colores').checked = config.mostrarColores !== false;
    });
});

//Activar la extensión cuando se pulsa en el botón activar en el popup
document.getElementById("activar").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.runtime.sendMessage({
      action: "activarExtension",
      tabId: tab.id
    });
  });
  window.close();
});

//Botón de cerrar popup
document.getElementById("cerrar").addEventListener("click", () => {
  window.close();
});

//Botón desactivar lo que ha generado la extensión
document.getElementById("desactivar").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.tabs.sendMessage(tab.id, {
      action: "desactivarExtension"
    });
  });

  window.close();
});

//Para expandir/contraer el panel de ajustes
document.getElementById('ajustes-toggle').addEventListener('click', function () {
    const panel = document.getElementById('ajustes-panel');
    const abierto = this.getAttribute('aria-expanded') === 'true';
    this.setAttribute('aria-expanded', String(!abierto));
    panel.hidden = abierto;
});

//Toggle para guardar la configuración de colores
document.getElementById('toggle-colores').addEventListener('change', function () {
    chrome.storage.sync.get('configuracion', (data) => {
        const config = data.configuracion || {};
        config.mostrarColores = this.checked;
        chrome.storage.sync.set({ configuracion: config });
    });
});

//Enlace para abrir la página de configuración de comandos de Chrome
document.getElementById('btn-atajo').addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});