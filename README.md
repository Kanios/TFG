# Asistente inteligente de accesibilidad web
Trabajo de fin de grado de Rubén Pascual Más.

## Descripción
Extensión de navegador de asistente inteligente de accesibilidad web desarrollado para el navegador Google Chrome.

## Configuración
    
1. **Crear archivo configuración:**
  - Crea un archivo config.js
  - Añada la siguiente línea de código:
    const CONFIG = { GEMINI_API_KEY: "TU_API_KEY_AQUI" };
  - Sustituya donde aparece TU_API_KEY_AQUI por su API key de Gemini.
    
2. **Crear API key de Gemini:**
  - Si no tiene una API key de Gemini dirigase a https://aistudio.google.com/app/api-keys
  - Si tiene una cuenta de Google haga log in, por el contrario registrese.
  - Haga clic en "Get API key".
  - Seleccione "Create API key".

3. **Configurar extensión:**
  - Dirigase a chrome://extensions.
  - Activa "Modo desarrollador".
  - Pulse "Cargar descomprimida".
  - Seleccione la dirección donde se ubique la carpeta del proyecto.
