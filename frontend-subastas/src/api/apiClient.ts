// 1. Importamos la dirección dinámica desde tu archivo de configuración
import { API_URL } from '../config/env';

// 2. Mantenemos nuestra función "cartero" intacta
export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  // Preparamos la dirección final usando la variable dinámica (ej: http://192.168.1.95:3000/api/categorias)
  const url = `${API_URL}${endpoint}`;

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