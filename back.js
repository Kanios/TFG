importScripts('config.js');

//Listener para mensajes desde content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
    
    if (request.action === "generarResumen") {
        generarResumenIA(request.pageInfo)
            .then(summary => sendResponse({ success: true, summary }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
});

//Función para generar alt text para imágenes
async function generarAltTextIA(imagenBase64, contexto) {
    const apiKey = CONFIG.GEMINI_API_KEY;
    
    if (!apiKey || apiKey === "TU_API_KEY_AQUI") {
        throw new Error("API Key no configurada en config.js");
    }

    try {
        const prompt = `Eres un experto en accesibilidad web. Genera un alt text breve y descriptivo para esta imagen.
        Contexto de la página: ${contexto}
        Responde SOLO con el alt text, máximo 15 palabras, sin comillas.`;

        const requestBody = {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: "image/jpeg",
                            data: imagenBase64
                        }
                    }
                ]
            }]
        };

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
        const altText = data.candidates[0].content.parts[0].text.trim();
        return altText.replace(/['"]/g, '');
        
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

    const prompt = `Eres un experto en accesibilidad web. Genera un aria-label descriptivo para este elemento web:
    - Tipo: ${elementInfo.tagName}
    - Clase: ${elementInfo.className || 'ninguna'}
    - ID: ${elementInfo.id || 'ninguno'}
    - URL: ${elementInfo.href || 'N/A'}
    - Texto cercano: ${elementInfo.textoVecino || 'ninguno'}
    - Contexto: ${contexto}

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
        const ariaLabel = data.candidates[0].content.parts[0].text.trim();
        return ariaLabel.replace(/['"]/g, '');
        
    } catch (error) {
        console.error("Error generando aria-label:", error);
        throw error;
    }
}

//Función para generar resumen descriptivo de la página
async function generarResumenIA(pageInfo) {
    const apiKey = CONFIG.GEMINI_API_KEY;
    
    if (!apiKey || apiKey === "TU_API_KEY_AQUI") {
        throw new Error("API Key no configurada en config.js");
    }

    const prompt = `Eres un experto en accesibilidad web. Genera un resumen descriptivo y útil de esta página web para usuarios con discapacidad visual.

    Información de la página:
    - Título: ${pageInfo.titulo}
    - URL: ${pageInfo.url}
    - Encabezado principal: ${pageInfo.encabezadoPrincipal}
    - Meta descripción: ${pageInfo.descripcionMeta}
    - Otros encabezados: ${pageInfo.headings}
    - Contenido inicial: ${pageInfo.parrafos}
    - Navegación: ${pageInfo.tieneNav ? 'Sí - ' + pageInfo.navText : 'No detectada'}
    - Colores detectados: ${pageInfo.colores}
    - Estadísticas: ${pageInfo.stats.links} enlaces, ${pageInfo.stats.buttons} botones, ${pageInfo.stats.imagenes} imágenes

    Genera un resumen que incluya:
    1. El propósito principal de la página (ej: "Página de búsqueda de billetes de tren")
    2. Los colores corporativos o esquema de colores principales detectados(no añadir valores rgb, solo descripciones como "colores oscuros con acentos naranjas")
    3. La estructura de navegación disponible y opciones principales
    4. Cualquier información relevante sobre la organización del contenido

    El resumen debe ser claro, conciso (máximo 80 palabras) y útil para alguien invidente.
    Responde directamente con el resumen, sin introducciones ni formato especial.`;

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
        const summary = data.candidates[0].content.parts[0].text.trim();
        return summary;
        
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
