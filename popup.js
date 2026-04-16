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

