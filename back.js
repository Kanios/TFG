importScripts('config.js');

//Listener para mensajes desde content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    //Cambio con scripting para que solo se active cuando se pulsa el botón de activar en el popup
    if (request.action === "activarExtension") {
        chrome.scripting.executeScript({
            target: { tabId: request.tabId },
            func: () => Boolean(window.asistenteAccesibilidadActivo)
        }).then(([result]) => {
            if (!result.result) {
                chrome.scripting.executeScript({
                    target: { tabId: request.tabId },
                    files: ["content.js"]
                }).then(() => {
                    sendResponse({ success: true, injected: true });
                }).catch(error => {
                    sendResponse({ success: false, error: error.message });
                });
            } else {
                sendResponse({ success: true, injected: false });
            }
        }).catch(error => {
            sendResponse({ success: false, error: error.message });
        });

        return true;
    }
    
    if (request.action === "generarAltText") {
        generarAltTextIA(request.imagenBase64, request.contexto)
            .then(altText => sendResponse({ success: true, altText }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    
    if (request.action === "generarAriaLabel") {
        generarAriaLabelIA(request.elementInfo, request.contexto)
            .then(ariaLabel => sendResponse({ success: true, ariaLabel }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    
    if (request.action === "generarAriaLabelFormulario") {
        generarAriaLabelFormularioIA(request.elementInfo, request.contexto)
            .then(ariaLabel => sendResponse({ success: true, ariaLabel }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }

    if (request.action === "generarResumen") {
        generarResumenIA(request.pageInfo)
            .then(summary => sendResponse({ success: true, summary }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }

    if (request.action === "generarAriaLabelNav") {
        generarAriaLabelNavIA(request.navInfo, request.contexto)
            .then(ariaLabel => sendResponse({ success: true, ariaLabel }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    if (request.action === "generarAriaLabelTabla") {
        generarAriaLabelTablaIA(request.tablaInfo, request.contexto)
            .then(ariaLabel => sendResponse({ success: true, ariaLabel }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
});

//Cambio Toggle para que si el usuario configura un atajo de teclado para la extensión en los ajustes de Google se active o desactive la extensión
chrome.commands.onCommand.addListener((command) => {
    if (command === "toggle-extension") {

        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
            if (!tab?.id) return;

            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => Boolean(window.asistenteAccesibilidadActivo)
            }).then(([result]) => {

                if (result.result) {
                    chrome.tabs.sendMessage(tab.id, {
                        action: "desactivarExtension"
                    });
                } else {
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ["content.js"]
                    });
                }

            });
        });
    }
});

//Función para generar alt text para imágenes
async function generarAltTextIA(imagenBase64, contexto) {
    const apiKey = CONFIG.GEMINI_API_KEY;
    
    if (!apiKey || apiKey === "TU_API_KEY_AQUI") {
        throw new Error("API Key no configurada en config.js");
    }

    const prompt = `Eres un experto en accesibilidad web. Genera un alt text para esta imagen siguiendo WCAG 1.1.1.
    - Contexto de la página: ${contexto}

    Reglas:
    - Describe el CONTENIDO y el PROPÓSITO de la imagen, no su estilo ni sus colores
    - Si el contexto indica que la imagen es el único contenido de un enlace, el alt debe describir el DESTINO del enlace
    - No empieces con "Imagen de", "Foto de" ni similares — el lector de pantalla ya anuncia que es una imagen
    - Si es un logotipo, menciona el nombre de la marca

    Ejemplos de buenos alt text: "Gráfico de ventas trimestrales 2024", "Portada del libro El Quijote", "Ir a la página de inicio", "Logotipo de TechCorp"
    Responde SOLO con el alt text, máximo 15 palabras, sin comillas.`;

    const requestBody = {
        contents: [{
            parts: [
                { text: prompt },
                { inline_data: { mime_type: "image/jpeg", data: imagenBase64 } }
            ]
        }]
    };

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Error de Gemini API: ${error}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text.trim().replace(/['"]/g, "");
    } catch (error) {
        console.error("Error generando alt text:", error);
        throw error;
    }
}

//Función para generar aria-label para elementos interactivos
async function generarAriaLabelIA(elementInfo, contexto) {
    const apiKey = CONFIG.GEMINI_API_KEY;
    if (!apiKey || apiKey === "TU_API_KEY_AQUI") {
        throw new Error("API Key no configurada en config.js");
    }

    const prompt = `Eres un experto en accesibilidad web. Genera un aria-label descriptivo para este elemento interactivo sin texto visible WCAG 4.1.2.
    - Tipo de elemento: ${elementInfo.tagName}
    - Rol ARIA: ${elementInfo.role || "ninguno"}
    - ID: ${elementInfo.id || "ninguno"}
    - URL de destino: ${elementInfo.href || "N/A"}
    - Texto cercano en el DOM: ${elementInfo.textoVecino || "ninguno"}
    - Contexto de la página: ${contexto}

    Reglas según el tipo de elemento:
    - Botones (button, role=button): verbo de acción en imperativo (ejemplos: "Abrir menú de navegación", "Enviar formulario", "Cerrar ventana emergente")
    - Enlaces (a, role=link): describir el destino o acción (ejemplos: "Ir a la sección de precios", "Descargar catálogo en PDF", "Ver más noticias")
    - Pestañas (role=tab): describir el contenido de la pestaña (ejemplos: "Pestaña de configuración", "Pestaña de historial de pedidos")
    - Menú (role=menuitem): describir la opción (ejemplo: "Opción de idioma español")

    Responde SOLO con el aria-label, máximo 8 palabras, sin comillas.`;

    const requestBody = {
        contents: [{
            parts: [{ text: prompt }]
        }]
    };

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Error de Gemini API: ${error}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text.trim().replace(/['"]/g, "");
    } catch (error) {
        console.error("Error generando aria-label:", error);
        throw error;
    }
}

//función para generar aria-label para formularios
async function generarAriaLabelFormularioIA(elementInfo, contexto) {
    const apiKey = CONFIG.GEMINI_API_KEY;
    if (!apiKey || apiKey === "TU_API_KEY_AQUI") {
        throw new Error("API Key no configurada en config.js");
    }

    const prompt = `Eres un experto en accesibilidad web. Genera un aria-label para este campo de formulario sin etiqueta visible WCAG 1.3.1.
    - Elemento HTML: ${elementInfo.tagName}
    - Tipo de input: ${elementInfo.type || "texto"}
    - Atributo name: ${elementInfo.name || "ninguno"}
    - Placeholder: ${elementInfo.placeholder || "ninguno"}
    - ID: ${elementInfo.id || "ninguno"}
    - Grupo del fieldset (legend): ${elementInfo.legendContext || "ninguno"}
    - Texto cercano en el DOM: ${elementInfo.textoVecino || "ninguno"}
    - Contexto de la página: ${contexto}

    Reglas:
    - Deduce el propósito del campo a partir de todos los datos anteriores
    - Usa forma imperativa para campos de texto (ejemplos: "Introduzca su correo electrónico", "Escriba su nombre completo", "Ingrese su número de teléfono")
    - Para checkboxes y radios describe la opción (ejemplos: "Acepto los términos y condiciones", "Género masculino", "Suscribirse al boletín")
    - Para select describe qué se selecciona (ejemplos: "Seleccione su país", "Elija un idioma")

    Responde SOLO con el aria-label, máximo 8 palabras, sin comillas.`;

    const requestBody = { contents: [{ parts: [{ text: prompt }] }] };

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            }
        );
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Error de Gemini API: ${error}`);
        }
        const data = await response.json();
        return data.candidates[0].content.parts[0].text.trim().replace(/['"]/g, "");
    } catch (error) {
        console.error("Error generando aria-label para formulario:", error);
        throw error;
    }
}

//Función para generar aria-label para navs cuando hay más de uno
async function generarAriaLabelNavIA(navInfo, contexto) {
    const apiKey = CONFIG.GEMINI_API_KEY;
    if (!apiKey || apiKey === "TU_API_KEY_AQUI") {
        throw new Error("API Key no configurada en config.js");
    }
    const prompt = `Eres un experto en accesibilidad web. Esta página tiene ${navInfo.totalNavs} elementos de navegación y necesitan aria-label únicos para distinguirlos WCAG ARIA11.
    Genera un aria-label breve para esta navegación concreta:
    - Elemento padre en el DOM: ${navInfo.posicion || "desconocido"}
    - Encabezado dentro del nav: ${navInfo.encabezado || "ninguno"}
    - Primeros enlaces que contiene: ${navInfo.enlaces?.join(", ") || "ninguno"}
    - Contexto de la página: ${contexto}

    Ejemplos de buenos aria-label: "Navegación principal", "Menú de pie de página", "Navegación de categorías", "Menú secundario", "Redes sociales", "Pasos del proceso".
    Responde SOLO con el aria-label, máximo 4 palabras, sin comillas.`;

    const requestBody = { contents: [{ parts: [{ text: prompt }] }] };
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) }
        );
        if (!response.ok) throw new Error(`Error de Gemini API: ${await response.text()}`);
        const data = await response.json();
        return data.candidates[0].content.parts[0].text.trim().replace(/['"]/g, "");
    } catch (error) {
        console.error("Error generando aria-label para nav:", error);
        throw error;
    }
}

//Función para generar aria-label para tablas sin encabezado
async function generarAriaLabelTablaIA(tablaInfo, contexto) {
    const apiKey = CONFIG.GEMINI_API_KEY;
    if (!apiKey || apiKey === "TU_API_KEY_AQUI") {
        throw new Error("API Key no configurada en config.js");
    }

    const prompt = `Eres un experto en accesibilidad web. Genera un aria-label descriptivo para una tabla de datos sin nombre accesible, siguiendo WCAG 1.3.1.
    - Encabezados de columna/fila: ${tablaInfo.encabezados?.join(", ") || "ninguno"}
    - Muestra de primeras filas: ${tablaInfo.muestrasFilas?.join(" / ") || "no disponible"}
    - Texto cercano en el DOM: ${tablaInfo.textoVecino || "ninguno"}
    - Contexto de la página: ${contexto}

    Reglas:
    - Describe qué datos contiene la tabla, no su estructura
    - Ejemplos de buenos aria-label: "Resultados de búsqueda de vuelos", "Comparativa de precios de tarifas", "Horario de clases del primer semestre", "Listado de empleados por departamento"
    - Responde SOLO con el aria-label, máximo 6 palabras, sin comillas.`;

    const requestBody = { contents: [{ parts: [{ text: prompt }] }] };

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) }
        );
        if (!response.ok) throw new Error(`Error de Gemini API: ${await response.text()}`);
        const data = await response.json();
        return data.candidates[0].content.parts[0].text.trim().replace(/['"]/g, "");
    } catch (error) {
        console.error("Error generando aria-label para tabla:", error);
        throw error;
    }
}

//Función para generar resumen descriptivo de la página
async function generarResumenIA(pageInfo) {
    const apiKey = CONFIG.GEMINI_API_KEY;
    if (!apiKey || apiKey === "TU_API_KEY_AQUI") {
        throw new Error("API Key no configurada en config.js");
    }

    const prompt = `Eres un experto en accesibilidad web. Genera un resumen descriptivo de esta página para ser leído por un lector de pantalla al inicio.
    - Título de la página: ${pageInfo.titulo}
    - URL: ${pageInfo.url}
    - Encabezado principal (h1): ${pageInfo.encabezadoPrincipal}
    - Meta descripción: ${pageInfo.descripcionMeta || "no disponible"}
    - Otros encabezados: ${pageInfo.headings}
    - Primeros párrafos: ${pageInfo.parrafos}
    - Menú de navegación: ${pageInfo.tieneNav ? "Sí — " + pageInfo.navText : "No detectado"}
    - Colores detectados: ${pageInfo.colores}
    - Estadísticas: ${pageInfo.stats.links} enlaces, ${pageInfo.stats.buttons} botones, ${pageInfo.stats.imagenes} imágenes

    El resumen debe cubrir en este orden de prioridad:
    1. Propósito principal de la página en una frase (ejemplo: "Página de compra de billetes de tren de Renfe")
    2. Estructura de navegación disponible y sus opciones principales
    3. Organización general del contenido
    4. Esquema de colores en lenguaje natural, sin valores RGB (ejemplo: "fondo blanco con botones azules")

    Reglas:
    - Máximo 80 palabras en total
    - Sin listas, sin viñetas, solo texto continuo
    - Sin introducciones como "Esta página..." — empieza directamente con el propósito
    - Usa lenguaje claro y directo, pensado para ser escuchado por usuarios de lectores de pantalla

    Responde directamente con el resumen, sin formato adicional.`;

    const requestBody = {
        contents: [{
            parts: [{ text: prompt }]
        }]
    };

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Error de Gemini API: ${error}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
        console.error("Error generando resumen de página:", error);
        throw error;
    }
}

chrome.runtime.onInstalled.addListener(() => {
    console.log("Asistente de accesibilidad web instalado");
    
    if (!CONFIG.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY === "TU_API_KEY_AQUI") {
        console.warn("API Key no configurada en config.js");
    } else {
        console.log("API Key configurada correctamente");
    }
});
