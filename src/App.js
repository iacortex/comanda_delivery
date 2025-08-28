import React, { useState, useRef } from 'react';
import { MapPin, User, Phone, Home, MessageSquare, QrCode, Navigation, AlertCircle, CheckCircle } from 'lucide-react';

const App = () => {
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    address: '',
    city: 'Puerto Montt',
    references: ''
  });
  
  const [coordinates, setCoordinates] = useState(null);
  const [qrCode, setQrCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [isMapVisible, setIsMapVisible] = useState(false);
  const [orders, setOrders] = useState([]);
  
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // Validaciones
  const validateForm = () => {
    const newErrors = {};
    
    if (!customerData.name.trim()) {
      newErrors.name = 'El nombre es obligatorio';
    } else if (customerData.name.trim().length < 2) {
      newErrors.name = 'El nombre debe tener al menos 2 caracteres';
    }
    
    if (!customerData.phone.trim()) {
      newErrors.phone = 'El teléfono es obligatorio';
    } else if (!/^\+?[\d\s\-\(\)]{8,15}$/.test(customerData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Formato de teléfono inválido';
    }
    
    if (!customerData.address.trim()) {
      newErrors.address = 'La dirección es obligatoria';
    } else if (customerData.address.trim().length < 5) {
      newErrors.address = 'La dirección debe ser más específica (ej: Av. Diego Portales 1150)';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Geocodificación específica para Puerto Montt, Los Lagos, Chile
  const geocodeAddress = async (address, city = 'Puerto Montt') => {
    try {
      // Intentar múltiples variaciones de búsqueda para mejor precisión
      const searchVariations = [
        `${address}, ${city}, Los Lagos, Chile`,
        `${address}, ${city}, Chile`,
        `${address}, Puerto Montt`,
        `${address}, Chile`
      ];
      
      let bestResult = null;
      
      // Probar cada variación hasta encontrar resultados
      for (const searchQuery of searchVariations) {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&countrycodes=cl&addressdetails=1`
          );
          const data = await response.json();
          
          if (data && data.length > 0) {
            // Filtrar resultados que estén en Chile y preferiblemente en Puerto Montt
            const chileanResults = data.filter(result => {
              const address = result.address || {};
              return address.country === 'Chile' || 
                     address.country_code === 'cl' ||
                     result.display_name.includes('Chile');
            });
            
            if (chileanResults.length > 0) {
              // Preferir resultados que mencionen Puerto Montt o Los Lagos
              const localResults = chileanResults.filter(result => {
                const displayName = result.display_name.toLowerCase();
                return displayName.includes('puerto montt') || 
                       displayName.includes('los lagos') ||
                       displayName.includes('región de los lagos');
              });
              
              bestResult = localResults.length > 0 ? localResults[0] : chileanResults[0];
              break; // Salir del bucle si encontramos resultados
            }
          }
        } catch (error) {
          console.log(`Error con búsqueda: ${searchQuery}`, error);
          continue; // Intentar con la siguiente variación
        }
      }
      
      if (bestResult) {
        const lat = parseFloat(bestResult.lat);
        const lng = parseFloat(bestResult.lon);
        
        // Validar que las coordenadas estén en Chile (aproximadamente)
        if (lat >= -56 && lat <= -17 && lng >= -109 && lng <= -66) {
          return {
            lat: lat,
            lng: lng,
            display_name: bestResult.display_name,
            formatted_address: `${address}, ${city}, Los Lagos, Chile`
          };
        }
      }
      
      throw new Error(`No se pudo encontrar la dirección "${address}" en ${city}`);
      
    } catch (error) {
      console.error('Error en geocodificación:', error);
      throw new Error(`Error al buscar la dirección en ${city}. Intente con una dirección más específica como "Nombre de calle + número"`);
    }
  };

  // Inicializar mapa
  const initializeMap = (lat, lng) => {
    if (!mapRef.current) return;

    // Si ya existe un mapa, lo removemos
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    // Crear nuevo mapa
    const map = window.L.map(mapRef.current).setView([lat, lng], 16);
    
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Crear marcador draggable
    const marker = window.L.marker([lat, lng], { draggable: true }).addTo(map);
    
    marker.on('dragend', function(e) {
      const position = e.target.getLatLng();
      setCoordinates(prev => ({
        ...prev,
        lat: position.lat,
        lng: position.lng
      }));
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;
  };

  // Cargar Leaflet dinámicamente
  const loadLeaflet = () => {
    return new Promise((resolve, reject) => {
      if (window.L) {
        resolve();
        return;
      }

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  // Crear URL de Google Maps
  const createMapsUrl = (lat, lng) => {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  };

  // Crear URL del código QR
  const createQrUrl = (lat, lng) => {
    const mapsUrl = createMapsUrl(lat, lng);
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mapsUrl)}`;
  };

  // Manejar envío del formulario
  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      // Geocodificar dirección en Puerto Montt
      const coords = await geocodeAddress(customerData.address, customerData.city);
      setCoordinates(coords);
      
      // Generar URL del QR
      const qrUrl = createQrUrl(coords.lat, coords.lng);
      setQrCode(qrUrl);
      
      // Cargar y mostrar mapa
      await loadLeaflet();
      setIsMapVisible(true);
      
      // Pequeña pausa para que el DOM se actualice
      setTimeout(() => {
        initializeMap(coords.lat, coords.lng);
      }, 100);
      
      // Agregar pedido a la lista
      const newOrder = {
        id: Date.now(),
        ...customerData,
        coordinates: coords,
        mapsUrl: createMapsUrl(coords.lat, coords.lng),
        qrUrl: qrUrl,
        timestamp: new Date().toLocaleString('es-CL')
      };
      
      setOrders(prev => [...prev, newOrder]);
      
    } catch (error) {
      setErrors({ submit: `Error al procesar la dirección en ${customerData.city}. Verifique que la dirección sea correcta.` });
    } finally {
      setIsLoading(false);
    }
  };

  // Manejar cambios en inputs
  const handleInputChange = (field, value) => {
    setCustomerData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Abrir en navegación
  const openInMaps = (url, app = 'google') => {
    if (app === 'waze' && coordinates) {
      window.open(`https://waze.com/ul?ll=${coordinates.lat},${coordinates.lng}&navigate=yes`, '_blank');
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">🍣 Sushi Delivery Puerto Montt</h1>
          <p className="text-gray-600">Sistema de gestión de entregas con geolocalización para Puerto Montt y Los Lagos</p>
          <div className="mt-2 text-sm text-blue-600 bg-blue-50 rounded-full px-4 py-2 inline-block">
            📍 Servicio especializado para la Región de Los Lagos, Chile
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Formulario */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
              <User className="text-red-500" />
              Datos del Cliente
            </h2>
            
            <div className="space-y-4">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <User size={16} className="inline mr-1" />
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={customerData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Ingrese el nombre completo"
                />
                {errors.name && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Phone size={16} className="inline mr-1" />
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={customerData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                    errors.phone ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="+56 9 1234 5678"
                />
                {errors.phone && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {errors.phone}
                  </p>
                )}
              </div>

              {/* Dirección */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Home size={16} className="inline mr-1" />
                  Dirección en Puerto Montt
                </label>
                <input
                  type="text"
                  value={customerData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                    errors.address ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Ej: Av. Diego Portales 1150, sector Centro"
                />
                {errors.address && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {errors.address}
                  </p>
                )}
              </div>

              {/* Ciudad */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MapPin size={16} className="inline mr-1" />
                  Ciudad
                </label>
                <select
                  value={customerData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white"
                >
                  <option value="Puerto Montt">Puerto Montt</option>
                  <option value="Puerto Varas">Puerto Varas</option>
                  <option value="Osorno">Osorno</option>
                  <option value="Frutillar">Frutillar</option>
                  <option value="Llanquihue">Llanquihue</option>
                  <option value="Ancud">Ancud</option>
                  <option value="Castro">Castro</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  🏙️ Servicio optimizado para Puerto Montt y alrededores
                </p>
              </div>

              {/* Referencias */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MessageSquare size={16} className="inline mr-1" />
                  Referencias (Opcional)
                </label>
                <textarea
                  value={customerData.references}
                  onChange={(e) => handleInputChange('references', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Ej: Casa frente al semáforo, casa amarilla con reja negra..."
                  rows="3"
                />
              </div>

              {/* Error general */}
              {errors.submit && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-600 text-sm flex items-center gap-1">
                    <AlertCircle size={16} />
                    {errors.submit}
                  </p>
                </div>
              )}

              {/* Botón submit */}
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    <MapPin size={18} />
                    Generar Ubicación y QR
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Mapa y QR */}
          <div className="space-y-6">
            {/* Mapa */}
            {isMapVisible && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <MapPin className="text-green-500" />
                  Ubicación en Mapa
                </h3>
                <div 
                  ref={mapRef} 
                  className="h-64 w-full rounded-lg border"
                  style={{ minHeight: '250px' }}
                />
                <p className="text-sm text-gray-600 mt-2">
                  💡 Puedes arrastrar el marcador para ajustar la ubicación exacta
                </p>
              </div>
            )}

            {/* Código QR */}
            {qrCode && coordinates && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <QrCode className="text-blue-500" />
                  Código QR para Repartidor
                </h3>
                
                <div className="text-center">
                  <img 
                    src={qrCode} 
                    alt="QR Code" 
                    className="mx-auto mb-4 border rounded-lg shadow-sm"
                  />
                  
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        const mapsUrl = createMapsUrl(coordinates.lat, coordinates.lng);
                        openInMaps(mapsUrl);
                      }}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
                    >
                      <Navigation size={16} />
                      Abrir en Google Maps
                    </button>
                    
                    <button
                      onClick={() => openInMaps('', 'waze')}
                      className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-medium py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
                    >
                      <Navigation size={16} />
                      Abrir en Waze
                    </button>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <strong>Coordenadas:</strong> {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Lista de pedidos */}
        {orders.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <CheckCircle className="text-green-500" />
              Pedidos Procesados ({orders.length})
            </h3>
            
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p><strong>Cliente:</strong> {order.name}</p>
                      <p><strong>Teléfono:</strong> {order.phone}</p>
                      <p><strong>Ciudad:</strong> {order.city}</p>
                      <p><strong>Fecha:</strong> {order.timestamp}</p>
                    </div>
                    <div>
                      <p><strong>Dirección:</strong> {order.address}</p>
                      {order.references && (
                        <p><strong>Referencias:</strong> {order.references}</p>
                      )}
                    </div>
                    <div className="text-center">
                      <img 
                        src={order.qrUrl} 
                        alt="QR" 
                        className="w-16 h-16 mx-auto mb-2"
                      />
                      <button
                        onClick={() => openInMaps(order.mapsUrl)}
                        className="text-blue-500 hover:text-blue-700 text-sm"
                      >
                        Ver en Maps
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;