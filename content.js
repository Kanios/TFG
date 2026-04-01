//chrome://extensions
//Para probar la extensión crear un archivo config.js con el siguiente contenido:// const CONFIG = { // GEMINI_API_KEY: "TU_API_KEY_AQUI" // };
//Para conseguir la key gratuita de Gemini ir a: https://aistudio.google.com/app/api-keys
//Pruebas: 
//https://www.lingscars.com/
//https://www.w3.org/WAI/demos/bad/after/home.html
console.log("Asistente inteligente de accesibilidad web con IA");

//Obtener el contexto de la página para enviar a la IA
function obtenerContextoPagina() {
    const titulo = document.title || "Página sin título";
    const h1 = document.querySelector("h1");
    const encabezadoPrincipal = h1 ? h1.innerText : "sin encabezado principal";
    const metaDescription = document.querySelector('meta[name="description"]');
    const descripcion = metaDescription ? metaDescription.content : "";
    
    return `Título: "${titulo}", Encabezado: "${encabezadoPrincipal}", Descripción: "${descripcion}"`;
}

//Función auxiliar para convertir imagena base64
function convertirImagenABase64(img) {
    return new Promise((resolve, reject) => {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            
            ctx.drawImage(img, 0, 0);
            
            // Convertir a base64 en formato JPEG
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('No se pudo convertir la imagen a blob'));
                    return;
                }
                
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = reader.result.split(',')[1];
                    resolve(base64);
                };
                reader.onerror = () => reject(new Error('Error al leer la imagen'));
                reader.readAsDataURL(blob);
            }, 'image/jpeg', 0.9);
            
        } catch (error) {
            reject(new Error(`Error en Canvas: ${error.message}`));
        }
    });
}

//Procesamiento de imagenes sin alt text
async function procesarImagenesSinAlt() {
    const imagenesSinAlt = document.querySelectorAll("img:not([alt]), img[alt='']");
    
    console.log(`Encontradas ${imagenesSinAlt.length} imágenes sin alt text`);
    
    if (imagenesSinAlt.length === 0) return;

    const contexto = obtenerContextoPagina();
    let procesadas = 0;
    let errores = 0;
    let omitidas = 0;
    
    //Procesar un máximo de 10 imágenes(por costos de API)
    const limite = Math.min(imagenesSinAlt.length, 10);
    
    for (let i = 0; i < limite; i++) {
        const img = imagenesSinAlt[i];
        
        try {
            const imagenUrl = img.src;
            
            //Validar que la imagen sea accesible y no sea muy pequeña (probablemente decorativa)
            if (!imagenUrl || img.width < 20 || img.height < 20) {
                img.setAttribute("alt", "Imagen decorativa");
                omitidas++;
                continue;
            }

            //Verificar que la imagen esté cargada completamente
            if (!img.complete || img.naturalWidth === 0) {
                console.log(`Imagen ${i + 1} no está completamente cargada`);
                img.setAttribute("alt", "Imagen sin descripción disponible");
                omitidas++;
                continue;
            }

            console.log(`Generando alt text para imagen ${i + 1}/${limite}...`);
            
            const imagenBase64 = await convertirImagenABase64(img);
            
            const response = await chrome.runtime.sendMessage({
                action: "generarAltText",
                imagenBase64: imagenBase64,
                contexto: contexto
            });

            if (response.success) {
                img.setAttribute("alt", response.altText);
                img.setAttribute("data-ai-generated", "true");
                procesadas++;
                console.log(`Alt text generado: "${response.altText}"`);
            } else {
                throw new Error(response.error);
            }
            
        } catch (error) {
            console.error(`Error generando alt para imagen ${i + 1}:`, error.message);
            img.setAttribute("alt", "Imagen sin descripción accesible");
            errores++;
        }
        
        // Pequeña pausa para no saturar la API
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`Procesamiento completado: ${procesadas} imágenes procesadas con IA, ${omitidas} omitidas/decorativas, ${errores} errores`);
    if (imagenesSinAlt.length > limite) {
        console.log(`Se procesaron solo ${limite} de ${imagenesSinAlt.length} imágenes`);
    }
}

//procesamiento de elementos interactivos sin aria-label

async function procesarElementosInteractivos() {
    const elementosBotonesEnlaces = document.querySelectorAll("button, a");
    
    //Filtrar los que no tienen texto accesible
    const elementosInaccesibles = Array.from(elementosBotonesEnlaces).filter(el => {
        const tieneTextoVisible = el.innerText && el.innerText.trim().length > 0;
        const tieneAriaLabel = el.hasAttribute("aria-label") && el.getAttribute("aria-label").trim().length > 0;
        const tieneAriaLabelBy = el.hasAttribute("aria-labelledby");
        
        //Controlar que si hereda el alt de una imagen
        const imagenConAlt = el.querySelectorAll("img[alt]");
        const tieneImagenConAlt = Array.from(imagenConAlt).some(img => img.getAttribute("alt").trim().length > 0);
        
        return !tieneTextoVisible && !tieneAriaLabel && !tieneAriaLabelBy && !tieneImagenConAlt;
    });
    
    console.log(`Encontrados ${elementosInaccesibles.length} elementos interactivos sin texto accesible`);
    
    if (elementosInaccesibles.length === 0) return;

    const contexto = obtenerContextoPagina();
    let procesados = 0;
    let errores = 0;
    
    const limite = Math.min(elementosInaccesibles.length, 15);
    
    for (let i = 0; i < limite; i++) {
        const el = elementosInaccesibles[i];
        
        try {
            const elementInfo = {
                tagName: el.tagName.toLowerCase(),
                className: el.className,
                id: el.id,
                href: el.href || null,
                textoVecino: obtenerTextoVecino(el)
            };
            
            console.log(`Generando aria-label para ${elementInfo.tagName} ${i + 1}/${limite}...`);
            
            const response = await chrome.runtime.sendMessage({
                action: "generarAriaLabel",
                elementInfo: elementInfo,
                contexto: contexto
            });

            if (response.success) {
                el.setAttribute("aria-label", response.ariaLabel);
                el.setAttribute("data-ai-generated", "true");
                procesados++;
                console.log(`Aria-label generado: "${response.ariaLabel}"`);
            } else {
                throw new Error(response.error);
            }
            
        } catch (error) {
            console.error(`Error generando aria-label para elemento ${i + 1}:`, error.message);
            let fallbackLabel = "Elemento interactivo sin descripción accesible";
            if (el.tagName.toLowerCase() === "button") {
                fallbackLabel = "Botón sin etiqueta accesible";
            } else if (el.tagName.toLowerCase() === "a") {
                fallbackLabel = "Enlace sin texto accesible";
            }
            el.setAttribute("aria-label", fallbackLabel);
            errores++;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`Procesamiento completado: ${procesados} elementos procesados, ${errores} errores`);
    if (elementosInaccesibles.length > limite) {
        console.log(`Se procesaron solo ${limite} de ${elementosInaccesibles.length} elementos (límite del prototipo)`);
    }
}

//Función auxiliar para obtener texto de elementos vecinos para generar contexto
function obtenerTextoVecino(element) {
    const padre = element.parentElement;
    if (!padre) return "";
    
    const textos = [];
    
    //Texto del padre
    const textoPadre = Array.from(padre.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE && node !== element)
        .map(node => node.textContent.trim())
        .join(" ");
    if (textoPadre) textos.push(textoPadre);
    
    // Texto de hermanos cercanos
    if (element.previousElementSibling) {
        const textoPrevio = element.previousElementSibling.innerText?.trim();
        if (textoPrevio) textos.push(textoPrevio);
    }
    if (element.nextElementSibling) {
        const textoSiguiente = element.nextElementSibling.innerText?.trim();
        if (textoSiguiente) textos.push(textoSiguiente);
    }
    
    return textos.join(" ").substring(0, 200); //limitando caracteres
}

//generar resumen general de la página para el usuario

async function generarResumen() {
    const titulo = document.title || "Página sin título";
    const h1 = document.querySelector("h1");
    const encabezadoPrincipal = h1 ? h1.innerText : "sin encabezado principal";
    
    //Recopilar información relevante para el resumen
    const links = document.querySelectorAll("a").length;
    const botones = document.querySelectorAll("button").length;
    const imagenes = document.querySelectorAll("img").length;
    const nav = document.querySelector("nav");
    const navText = nav ? nav.innerText.substring(0, 500) : "";
    const tieneNav = nav ? true : false;
    
    //Obtener colores dominantes de la página
    const colores = obtenerColoresDominantes();
    
    const meta = document.querySelector('meta[name="description"]');
    const descripcionMeta = meta ? meta.content : "";
    
    const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
        .slice(0, 5)
        .map(h => h.innerText.trim())
        .filter(text => text.length > 0)
        .join(", ");
    
    //Obtener algunos párrafos iniciales
    const parrafos = Array.from(document.querySelectorAll("p"))
        .slice(0, 3)
        .map(p => p.innerText.trim())
        .filter(text => text.length > 0)
        .join(" ")
        .substring(0, 300);
    
    const pageInfo = {
        titulo,
        encabezadoPrincipal,
        descripcionMeta,
        headings,
        parrafos,
        tieneNav,
        navText,
        colores,
        stats: {
            links,
            botones,
            imagenes
        },
        url: window.location.href
    };
    
    try {
        console.log("Generando resumen accesible con IA...");
        
        const response = await chrome.runtime.sendMessage({
            action: "generarResumen",
            pageInfo: pageInfo
        });
        
        if (response.success) {
            return response.summary;
        } else {
            throw new Error(response.error);
        }
    } catch (error) {
        console.error("Error generando resumen con IA:", error);
        //Resumen básico en caso de error
        return `Esta página titulada "${titulo}" presenta como encabezado principal "${encabezadoPrincipal}".
        La página ${tieneNav ? 'incluye un menú de navegación' : 'no tiene menú de navegación detectado'}.
        Y contiene aproximadamente ${links} enlaces, ${botones} botones y ${imagenes} imágenes.`;
    }
}

//Función auxiliar para detectar colores corporativos
function obtenerColoresDominantes() {
    const colores = [];
    
    const colorFondo = window.getComputedStyle(document.body).backgroundColor;
    if (colorFondo && colorFondo !== "rgba(0, 0, 0, 0)" && colorFondo !== "transparent") {
        colores.push(colorFondo);
    }
    
    const colorHeader = document.querySelector("header") || document.querySelector("nav");
    if (colorHeader) {
        const colorHeaderBg = window.getComputedStyle(colorHeader).backgroundColor;
        if (colorHeaderBg && colorHeaderBg !== "rgba(0, 0, 0, 0)" && colorHeaderBg !== "transparent") {
            colores.push(colorHeaderBg);
        }
    }
    
    const colorTextoPrincipal = window.getComputedStyle(document.body).color;
    if (colorTextoPrincipal) {
        colores.push(colorTextoPrincipal);
    }
    
    return colores.slice(0, 3).join(", ");
}

function insertarResumen(textoGenerado) {
    const container = document.createElement("section");

    container.setAttribute("role", "region");
    container.setAttribute("aria-label", "Resumen descriptivo de la página actual.");
    container.setAttribute("tabindex", "0");
    container.style.position = "absolute";
    container.style.left = "-9999px"; //Para que no se vea visualmente

    const heading = document.createElement("h2");
    heading.innerText = "Descripción general de la página";

    const contenido = document.createElement("p");
    contenido.innerText = textoGenerado;

    container.appendChild(heading);
    container.appendChild(contenido);
    document.body.prepend(container);

    console.log("Resumen generado:", textoGenerado);
}

//inicializacion del asistente al cargar la página

window.addEventListener("load", async () => {
    console.log("Iniciando asistente de accesibilidad...");
    
    const textoResumen = await generarResumen();
    insertarResumen(textoResumen);
    
    console.log("Procesando página con IA...");
    
    try {
        await procesarImagenesSinAlt();
        
        await procesarElementosInteractivos();
        
        console.log("Procesamiento completo. La página ahora es más accesible.");
    } catch (error) {
        console.error("Error durante el procesamiento:", error);
    }
});
