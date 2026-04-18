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
            img.setAttribute("data-ai-original-alt", img.hasAttribute("alt") ? img.getAttribute("alt") : "__removed__");
            img.setAttribute("data-ai-generated", "true");

            const imagenUrl = img.src;
            
            //Validar que la imagen sea accesible y no sea muy pequeña (probablemente decorativa)
            if (!imagenUrl || img.width < 20 || img.height < 20) {
                // Cambio según las buenas prácticas de la WCAG las imagenes decorativas es bueno poner ""
                img.setAttribute("alt", "");
                console.log("Imagen omitida:", img);
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
    const elementosBotonesEnlacesPestañasMenu = "button, a, [role='button'], [role='link'], [role='tab'], [role='menuitem']";
    const elementosInteractivos = document.querySelectorAll(elementosBotonesEnlacesPestañasMenu);
    
    //Filtrar los que no tienen texto accesible
    const elementosInaccesibles = Array.from(elementosInteractivos).filter(el => {
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
            el.setAttribute("data-ai-original-aria-label", el.hasAttribute("aria-label") ? el.getAttribute("aria-label") : "__removed__");
            el.setAttribute("data-ai-generated", "true");

            const elementInfo = {
                tagName: el.tagName.toLowerCase(),
                role : el.getAttribute("role") || null,
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
                procesados++;
                console.log(`Aria-label generado: "${response.ariaLabel}"`);
            } else {
                throw new Error(response.error);
            }
            
        } catch (error) {
            console.error(`Error generando aria-label para elemento ${i + 1}:`, error.message);
            let fallbackLabel = "Elemento interactivo sin descripción accesible";
            const tag = el.tagName.toLowerCase();
            const role = el.getAttribute("role");
            if (tag === "button"||role==="button") {
                fallbackLabel = "Botón sin etiqueta accesible";
            } else if (tag === "a"||role==="link") {
                fallbackLabel = "Enlace sin texto accesible";
            }else if (role === "tab") {
                fallbackLabel = "Pestaña sin título accesible";
            }else if (role === "menuitem") {
                fallbackLabel = "Menú sin descripción accesible";
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

//Función para procesar los formularios sin etiqueta
async function procesarFormularios() {
    //omitimos inputs tipo hidden ya que no necesitan label y submit porque en caso de que el botón del formulario no tenga texto ni etiqueta lo habrá detectado la función elementos interactivos
    const elementosTextareaSelect = "input:not([type='hidden']):not([type='submit']), textarea, select";
    const elementosFormulario = document.querySelectorAll(elementosTextareaSelect);
    const elementosInaccesibles = Array.from(elementosFormulario).filter(el => {
        const tieneAriaLabel = el.hasAttribute("aria-label") && el.getAttribute("aria-label").trim().length > 0;
        const tieneAriaLabelBy = el.hasAttribute("aria-labelledby");
        const tieneTitle = el.hasAttribute("title") && el.getAttribute("title").trim().length > 0;
        
        let tieneLabelAsociado = false;
        if (el.closest("label")) {
            tieneLabelAsociado = true;
        }else if (el.id) {
            const labelAsociado = document.querySelector(`label[for="${el.id}"]`);
            if (labelAsociado && labelAsociado.innerText.trim().length > 0) {
                tieneLabelAsociado = true;
            }
        }
        
        return !tieneAriaLabel && !tieneAriaLabelBy && !tieneTitle && !tieneLabelAsociado;

    });
    console.log(`Encontrados ${elementosInaccesibles.length} elementos interactivos sin texto accesible`);
    
    if (elementosInaccesibles.length === 0) return;

    const contexto = obtenerContextoPagina();
    let procesados = 0;
    let errores = 0;
    
    const limite = Math.min(elementosInaccesibles.length, 10);
    for (let i = 0; i < limite; i++) {
        const el = elementosInaccesibles[i];
        
        try {
            el.setAttribute("data-ai-original-aria-label", el.hasAttribute("aria-label") ? el.getAttribute("aria-label") : "__removed__");
            el.setAttribute("data-ai-generated", "true");

            const elementInfo = {
                tagName: el.tagName.toLowerCase(),
                type: el.type || null,
                name: el.name || null,
                id: el.id,
                placeholder: el.placeholder || null,
                textoVecino: obtenerTextoVecino(el)
            };
            
            console.log(`Generando aria-label para formulario ${elementInfo.tagName} ${i + 1}/${limite}...`);
            
            const response = await chrome.runtime.sendMessage({
                action: "generarAriaLabelFormulario",
                elementInfo: elementInfo,
                contexto: contexto
            });

            if (response.success) {
                el.setAttribute("aria-label", response.ariaLabel);
                procesados++;
                console.log(`Aria-label de formulario generado: "${response.ariaLabel}"`);
            } else {
                throw new Error(response.error);
            }
            
        } catch (error) {
            console.error(`Error generando aria-label para formulario ${i + 1}:`, error.message);
            el.setAttribute("aria-label", "Campo de formulario iterativo");
            errores++;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`Procesamiento completado: ${procesados} elementos procesados, ${errores} errores`);
    if (elementosInaccesibles.length > limite) {
        console.log(`Se procesaron solo ${limite} de ${elementosInaccesibles.length} elementos (límite del prototipo)`);
    }
}

//Procesar etiquetas existentes pero insuficientes (primer borrador)
async function procesarEtiquetasInsuficientes() {
    //Normalizar texto (sin tildes, paso a minúsculas)
    const normalizarTexto = (texto) => {
        return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    };

    //Blacklist WCAG (multilingüe)
    const blacklistWCAG = [
        // Español
        "imagen", "foto", "fotografia", "logo", "logotipo", "grafico", "grafica", "dibujo",
        "vacio", "blanco", "enlace", "link", "haga clic", "clic aqui", "click aqui",
        "boton", "pulsar", "mas", "leer mas", "ver mas", "detalle", "info", "aqui", "titulo",
        // Inglés
        "image", "img", "picture", "pic", "photo", "photograph", "logotype", "graphic", "drawing",
        "empty", "blank", "link", "click", "click here", "button", "press",
        "more", "read more", "see more", "details", "info", "here", "title",
        // Comunes CMS
        "untitled", "sin titulo", "default", "null", "undefined", "0"
    ];

    // Expresiones para detectar archivos, nombre solo de imágenes, rutas como "IMG_1234", "DSC001", "Screenshot_2024" o enlaces, o texto que solo tenga símbolos 
    const extensionesRegex = /\.(jpg|jpeg|png|gif|webp|svg|ico|bmp|tiff)$/i;
    const archivosRegex = /^(img|dsc|screenshot|captura|whatsapp|whatsapp_image)[_\-\s]?\d+/i;
    const rutasRegex = /^(https?:\/\/|www\.|\/|\.\.\/)/i;
    const simbolosRegex = /^[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ]+$/;

    const elementosInsuficientes = [];

    const evaluarElemento = (el, textoOriginal) => {
        if (!textoOriginal || textoOriginal.trim().length === 0) return;

        const textoNorm = normalizarTexto(textoOriginal);

        //Se comprueba si cumple con los patrones y se añade a la lista
        if (
            extensionesRegex.test(textoNorm) || 
            archivosRegex.test(textoNorm) ||
            rutasRegex.test(textoNorm) || 
            simbolosRegex.test(textoNorm) || 
            blacklistWCAG.includes(textoNorm)
        ) {
            elementosInsuficientes.push({ el, textoOriginal});
        } 
    };

    // Recopilar imágenes (excluir las ya procesadas por otras funciones)
    const imagenes = document.querySelectorAll("img[alt]");

    imagenes.forEach(img => {
        if (!img.hasAttribute("data-ai-generated")) evaluarElemento(img, img.getAttribute("alt"));
    });

    // Recopilar elementos interactivos (excluir los ya procesados)
    const selectoresInteractivos = "button, a, [role='button'], [role='link'], [role='tab'], [role='menuitem']";
    const elementosInteractivos = document.querySelectorAll(selectoresInteractivos);
    
    elementosInteractivos.forEach(el => {
        if (el.hasAttribute("data-ai-generated")) return;
        const texto = el.getAttribute("aria-label") || el.innerText;
        evaluarElemento(el, texto);
    });

    console.log(`Elementos insuficientes detectados: ${elementosInsuficientes.length}`);

    if (elementosInsuficientes.length === 0) return;

    const contexto = obtenerContextoPagina();
    const limite = Math.min(elementosInsuficientes.length, 10);
    let corregidos = 0;
    let errores = 0;

    for (let i = 0; i < limite; i++) {
        const { el, textoOriginal } = elementosInsuficientes[i];
        const esImagen = el.tagName.toLowerCase() === "img";

        try {
            if (esImagen) {
                el.setAttribute("data-ai-original-alt", el.getAttribute("alt"));
                el.setAttribute("data-ai-generated", "true");

                const imagenBase64 = await convertirImagenABase64(el);
                const response = await chrome.runtime.sendMessage({
                    action: "generarAltText",
                    imagenBase64,
                    contexto
                });

                if (response.success) {
                    el.setAttribute("alt", response.altText);
                    corregidos++;
                    console.log(`[EtiquetaInsuficiente] Alt corregido: "${textoOriginal}" → "${response.altText}"`);
                } else {
                    throw new Error(response.error);
                }
            } else {
                el.setAttribute("data-ai-original-aria-label", el.hasAttribute("aria-label") ? el.getAttribute("aria-label") : "__removed__");
                el.setAttribute("data-ai-generated", "true");

                const elementInfo = {
                    tagName: el.tagName.toLowerCase(),
                    role: el.getAttribute("role") || null,
                    className: el.className,
                    id: el.id,
                    href: el.href || null,
                    textoVecino: obtenerTextoVecino(el)
                };
                const response = await chrome.runtime.sendMessage({
                    action: "generarAriaLabel",
                    elementInfo,
                    contexto
                });

                if (response.success) {
                    el.setAttribute("aria-label", response.ariaLabel);
                    corregidos++;
                    console.log(`[EtiquetaInsuficiente] Aria-label corregido: "${textoOriginal}" → "${response.ariaLabel}"`);
                } else {
                    throw new Error(response.error);
                }
            }
        } catch (error) {
            console.error(`Error corrigiendo etiqueta insuficiente ${i + 1}:`, error.message);
            errores++;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`Etiquetas insuficientes: ${corregidos} corregidas, ${errores} errores`);
    if (elementosInsuficientes.length > limite) {
        console.log(`Se procesaron solo ${limite} de ${elementosInsuficientes.length} elementos`);
    }
}

//Procesar campos obligatorios no accesible
async function procesarCamposObligatorios() {
    const Campos = document.querySelectorAll("input:not([type='hidden']):not([type='submit']), textarea, select");
    let camposMejorados = 0;
    Campos.forEach(campo => {
        let esObligatorio = campo.hasAttribute("required") || campo.getAttribute("aria-required") === "true";
        const label = campo.id ? document.querySelector(`label[for="${campo.id}"]`) : campo.closest("label");
        const textoLabel = label ? label.innerText.trim() : "";
        const placeholder = campo.getAttribute("placeholder") || "";

        if(!esObligatorio){
            const textoLabelMin = textoLabel.toLowerCase();
            const placeholderMin = placeholder.toLowerCase();
            if(textoLabelMin.includes("obligatorio") || placeholderMin.includes("obligatorio") || textoLabel.includes("*")|| placeholder.includes("*")){
                esObligatorio = true;
            }
        }
        if(esObligatorio && campo.getAttribute("aria-required") !== "true"){
            campo.setAttribute("data-ai-original-aria-required", campo.hasAttribute("aria-required") ? campo.getAttribute("aria-required") : "__removed__");
            campo.setAttribute("aria-required", "true");
            const descActual = campo.getAttribute("aria-description") || "";
            if(!descActual.toLowerCase().includes("obligatorio")){
                campo.setAttribute("data-ai-original-aria-description", campo.hasAttribute("aria-description") ? campo.getAttribute("aria-description") : "__removed__");
                campo.setAttribute("aria-description", (descActual + " Campo obligatorio.").trim());
            }
            campo.setAttribute("data-ai-generated", "true");
            camposMejorados++;
        }
    });
    if(camposMejorados > 0){
        console.log(`Se han mejorado ${camposMejorados} campos de formulario para indicar que son obligatorios.`);
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

    container.setAttribute("id", "resumen-accesibilidad");
    container.setAttribute("role", "region");
    container.setAttribute("aria-label", "Resumen descriptivo de la página actual.");
    container.setAttribute("data-ai-generated", "true");
    // Se elimina la etiqueta tabindex=0
    container.style.position = "absolute";
    // Cambio, forma de ocultar visualmente el resumen
    container.style.width = "1px";          
    container.style.height = "1px";
    container.style.margin = "-1px";
    container.style.overflow = "hidden"; //Para que no se vea visualmente
    container.style.whiteSpace = "nowrap"; 
    //Comprobar que haya 1 h1, si lo hay generar un h2, sino un h1. Incluso si no hay h1 cambiar el título a descripción general de: Generar título
    let heading;
    if(document.querySelector('h1')){
        heading = document.createElement("h2");
    }else{
        heading = document.createElement("h1");
    }
    heading.innerText = "Descripción general de la página";
    const contenido = document.createElement("p");
    contenido.innerText = textoGenerado;

    container.appendChild(heading);
    container.appendChild(contenido);
    document.body.prepend(container);

    console.log("Resumen generado:", textoGenerado);
}

//Cambio para cuando se active con el botón del popup o se desactive
if (!window.asistenteAccesibilidadActivo) {
  window.asistenteAccesibilidadActivo = true;
  iniciarAsistente();
}

async function iniciarAsistente(){
    console.log("Iniciando asistente de accesibilidad...");
    
    const textoResumen = await generarResumen();
    insertarResumen(textoResumen);
    
    console.log("Procesando página con IA...");
    
    try {
        await procesarImagenesSinAlt();
        
        await procesarElementosInteractivos();
        await procesarFormularios();
        await procesarEtiquetasInsuficientes();
        await procesarCamposObligatorios();
        
        console.log("Procesamiento completo. La página ahora es más accesible.");
    } catch (error) {
        console.error("Error durante el procesamiento:", error);
    }
};

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "desactivarExtension") {
    desactivarAsistente();
  }
});

function desactivarAsistente() {
    if (!window.asistenteAccesibilidadActivo) return;

    console.log("Desactivando asistente de accesibilidad...");

    document.querySelectorAll("[data-ai-generated]").forEach(el => {
        const restoreAttr = (dataKey, attrName) => {
            if (!el.hasAttribute(dataKey)) return;
            const original = el.getAttribute(dataKey);
            if (original === "__removed__") {
                el.removeAttribute(attrName);
            } else {
                el.setAttribute(attrName, original);
            }
            el.removeAttribute(dataKey);
        };

        restoreAttr("data-ai-original-alt", "alt");
        restoreAttr("data-ai-original-aria-label", "aria-label");
        restoreAttr("data-ai-original-aria-required", "aria-required");
        restoreAttr("data-ai-original-aria-description", "aria-description");

        el.removeAttribute("data-ai-generated");
    });

    document.getElementById("resumen-accesibilidad")?.remove();

    window.asistenteAccesibilidadActivo = false;
    console.log("Asistente desactivado. Cambios revertidos.");
}