// 1. Ponemos la dirección de tu Mac (Reemplazá las X por tu IP real)
// Si usás el simulador de iOS en la Mac, podés poner 'http://localhost:3000'
const BASE_URL = 'http://192.168.0.21:3000';

// 2. Creamos nuestra función "cartero"
export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  // Preparamos la dirección final (ej: http://192.168.0.15:3000/categorias)
  const url = `${BASE_URL}${endpoint}`;

  // Configuramos los encabezados (headers) para avisar que mandamos/recibimos JSON
  const customHeaders = new Headers(options.headers || {});
  if (!customHeaders.has('Content-Type')) {
    customHeaders.set('Content-Type', 'application/json');
  }

  // TODO: Más adelante, cuando integres el login al 100%, 
  // acá vamos a inyectar automáticamente tu JWT para las rutas protegidas.

  const config: RequestInit = {
    ...options,
    headers: customHeaders,
  };

try {
    const response = await fetch(url, config);
    // Agregamos este log para chusmear qué responde el backend
    console.log(`Respuesta de ${endpoint}:`, response.status); 
    return response;
  } catch (error) {
    // Le sacamos el silenciador
    console.error(`Error brutal al intentar conectar con ${url}:`, error);
    throw error;
  }
};