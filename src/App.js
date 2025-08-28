import React, { useState, useRef, useEffect } from 'react';
import { MapPin, User, Phone, Home, MessageSquare, QrCode, Navigation, AlertCircle, CheckCircle, ShoppingCart, Plus, Minus, Star, Clock, Package, Bell, Eye } from 'lucide-react';

// Utilidades
const formatCLP = (value) => new Intl.NumberFormat('es-CL').format(value);

const App = () => {
  const [userRole, setUserRole] = useState('cashier'); // 'cashier', 'cook', 'delivery'
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
  const [cart, setCart] = useState([]);
  const [activeTab, setActiveTab] = useState('promotions');
  const [notifications, setNotifications] = useState([]);
  
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // Estados de pedidos: 'pending', 'cooking', 'ready', 'delivered'
  const orderStatuses = {
    pending: { label: 'Pendiente', color: 'yellow', icon: Clock },
    cooking: { label: 'En Cocina', color: 'orange', icon: Package },
    ready: { label: 'Listo para Delivery', color: 'green', icon: Bell },
    delivered: { label: 'Entregado', color: 'blue', icon: CheckCircle }
  };

  // Tailwind (evitar clases dinámicas que se pierden al build)
  const statusPillClass = {
    pending: 'bg-yellow-100 text-yellow-800',
    cooking: 'bg-orange-100 text-orange-800',
    ready: 'bg-green-100 text-green-800',
    delivered: 'bg-blue-100 text-blue-800',
  };

  // Promociones
  const promotions = [
    {
      id: 1,
      name: "Promo Familiar",
      description: "40 piezas variadas + 2 bebidas + salsa extra",
      items: ["20 Makis Salmón", "10 Uramakis California", "10 Nigiris variados", "2 Bebidas 350ml", "Salsa Teriyaki"],
      originalPrice: 18900,
      discountPrice: 14900,
      discount: 21,
      image: "🍣",
      popular: true,
      cookingTime: 25
    },
    {
      id: 2,
      name: "Combo Ejecutivo",
      description: "Perfecto para almuerzo o cena individual",
      items: ["10 Makis Philadelphia", "6 Uramakis Ebi", "4 Nigiris Salmón", "1 Miso Soup", "Wasabi y Jengibre"],
      originalPrice: 8500,
      discountPrice: 6900,
      discount: 19,
      image: "🥢",
      popular: false,
      cookingTime: 15
    },
    {
      id: 3,
      name: "Mega Promo Puerto Montt",
      description: "La promoción más grande para compartir",
      items: ["30 Makis variados", "20 Uramakis especiales", "15 Nigiris premium", "3 Temakis", "4 Bebidas", "Postres Mochi (4 unidades)"],
      originalPrice: 28900,
      discountPrice: 22900,
      discount: 21,
      image: "🏮",
      popular: true,
      cookingTime: 35
    },
    {
      id: 4,
      name: "Vegetariano Deluxe",
      description: "Opciones frescas sin pescado ni mariscos",
      items: ["15 Makis Palta", "10 Uramakis Vegetales", "8 Inari", "Ensalada Wakame", "Salsa Soya"],
      originalPrice: 7900,
      discountPrice: 5900,
      discount: 25,
      image: "🥒",
      popular: false,
      cookingTime: 12
    },
    {
      id: 5,
      name: "Especial Salmón",
      description: "Para los amantes del salmón fresco",
      items: ["20 Makis Salmón", "12 Uramakis Philadelphia", "8 Nigiris Salmón", "4 Sashimis Salmón", "Salsa Especial"],
      originalPrice: 15900,
      discountPrice: 12900,
      discount: 19,
      image: "🐟",
      popular: true,
      cookingTime: 20
    },
    {
      id: 6,
      name: "Mariscos del Sur",
      description: "Sabores del mar de Los Lagos",
      items: ["15 Uramakis Camarón", "10 Makis Pulpo", "8 Nigiris Mariscos", "6 Gyozas Camarón", "Salsa Anguila"],
      originalPrice: 17900,
      discountPrice: 13900,
      discount: 22,
      image: "🦐",
      popular: false,
      cookingTime: 30
    }
  ];

  // Persistencia simple (opcional)
  useEffect(() => {
    const saved = localStorage.getItem('sushi_orders');
    if (saved) setOrders(JSON.parse(saved));
  }, []);
  useEffect(() => {
    localStorage.setItem('sushi_orders', JSON.stringify(orders));
  }, [orders]);

  // Notificaciones automáticas
  useEffect(() => {
    if (userRole === 'cook') {
      const pendingOrders = orders.filter(order => order.status === 'pending');
      if (pendingOrders.length > 0) {
        setNotifications(pendingOrders.map(order => ({
          id: order.id,
          message: `Nuevo pedido para ${order.name} - ${order.cart.length} item(s)`,
          type: 'new-order'
        })));
      } else {
        setNotifications([]);
      }
    } else if (userRole === 'delivery') {
      const readyOrders = orders.filter(order => order.status === 'ready');
      if (readyOrders.length > 0) {
        setNotifications(readyOrders.map(order => ({
          id: order.id,
          message: `Pedido listo para entrega - ${order.name}`,
          type: 'ready-delivery'
        })));
      } else {
        setNotifications([]);
      }
    } else {
      setNotifications([]);
    }
  }, [orders, userRole]);

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
    } else if (!/^\+?56\s?9\s?[\d\s-]{7,9}$/.test(customerData.phone.trim())) {
      newErrors.phone = 'Formato de teléfono inválido (ej: +56 9 1234 5678)';
    }
    
    if (!customerData.address.trim()) {
      newErrors.address = 'La dirección es obligatoria';
    } else if (customerData.address.trim().length < 5) {
      newErrors.address = 'La dirección debe ser más específica (ej: Av. Diego Portales 1150)';
    }

    if (cart.length === 0) {
      newErrors.cart = 'Debe agregar al menos una promoción al pedido';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Geocodificación
  const geocodeAddress = async (address, city = 'Puerto Montt') => {
    try {
      const searchVariations = [
        `${address}, ${city}, Los Lagos, Chile`,
        `${address}, ${city}, Chile`,
        `${address}, Puerto Montt`,
        `${address}, Chile`
      ];
      
      let bestResult = null;
      
      for (const searchQuery of searchVariations) {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&countrycodes=cl&addressdetails=1`,
            { headers: { 'Accept-Language': 'es-CL' } }
          );
          const data = await response.json();
          
          if (data && data.length > 0) {
            const chileanResults = data.filter(result => {
              const address = result.address || {};
              return address.country === 'Chile' || 
                     address.country_code === 'cl' ||
                     (result.display_name || '').includes('Chile');
            });
            
            if (chileanResults.length > 0) {
              const localResults = chileanResults.filter(result => {
                const displayName = (result.display_name || '').toLowerCase();
                return displayName.includes('puerto montt') || 
                       displayName.includes('los lagos') ||
                       displayName.includes('región de los lagos');
              });
              
              bestResult = localResults.length > 0 ? localResults[0] : chileanResults[0];
              break;
            }
          }
        } catch (error) {
          console.log(`Error con búsqueda: ${searchQuery}`, error);
          continue;
        }
      }
      
      if (bestResult) {
        const lat = parseFloat(bestResult.lat);
        const lng = parseFloat(bestResult.lon);
        
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
      throw new Error(`Error al buscar la dirección en ${city}. Intente con una dirección más específica`);
    }
  };

  // Inicializar mapa
  const initializeMap = (lat, lng) => {
    if (!mapRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    const map = window.L.map(mapRef.current).setView([lat, lng], 16);
    
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    const marker = window.L.marker([lat, lng], { draggable: userRole === 'cashier' }).addTo(map);
    
    if (userRole === 'cashier') {
      marker.on('dragend', function(e) {
        const position = e.target.getLatLng();
        setCoordinates(prev => ({
          ...prev,
          lat: position.lat,
          lng: position.lng
        }));
      });
    }

    mapInstanceRef.current = map;
    markerRef.current = marker;
  };

  // Cargar Leaflet
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

  // URLs y QR
  const createMapsUrl = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

  const createQrUrl = (lat, lng) => {
    const mapsUrl = createMapsUrl(lat, lng);
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mapsUrl)}`;
  };

  // Carrito (solo cajero)
  const addToCart = (promotion) => {
    if (userRole !== 'cashier') return;
    
    const existingItem = cart.find(item => item.id === promotion.id);
    if (existingItem) {
      setCart(cart.map(item => 
        item.id === promotion.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { ...promotion, quantity: 1 }]);
    }
  };

  const removeFromCart = (promotionId) => {
    if (userRole !== 'cashier') return;
    setCart(cart.filter(item => item.id !== promotionId));
  };

  const updateQuantity = (promotionId, newQuantity) => {
    if (userRole !== 'cashier') return;
    
    if (newQuantity === 0) {
      removeFromCart(promotionId);
    } else {
      setCart(cart.map(item => 
        item.id === promotionId 
          ? { ...item, quantity: newQuantity }
          : item
      ));
    }
  };

  const getCartTotal = () => cart.reduce((total, item) => total + (item.discountPrice * item.quantity), 0);
  const getCartItemCount = () => cart.reduce((total, item) => total + item.quantity, 0);
  const getEstimatedCookingTime = () => cart.reduce((maxTime, item) => Math.max(maxTime, item.cookingTime), 0);

  // Crear pedido (cajero)
  const handleCreateOrder = async () => {
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      const coords = await geocodeAddress(customerData.address, customerData.city);
      
      const qrUrl = createQrUrl(coords.lat, coords.lng);
      
      const newOrder = {
        id: Date.now(),
        ...customerData,
        cart: [...cart],
        total: getCartTotal(),
        coordinates: coords,
        mapsUrl: createMapsUrl(coords.lat, coords.lng),
        qrUrl: qrUrl,
        status: 'pending',
        timestamp: new Date().toLocaleString('es-CL'),
        estimatedTime: getEstimatedCookingTime(),
        createdBy: 'Cajero'
      };
      
      setOrders(prev => [...prev, newOrder]);
      
      // Limpiar formulario y carrito
      setCart([]);
      setCustomerData({
        name: '',
        phone: '',
        address: '',
        city: 'Puerto Montt',
        references: ''
      });
      setErrors({});
      
      alert(`✅ Pedido creado exitosamente para ${newOrder.name}!\n🕐 Tiempo estimado: ${newOrder.estimatedTime} minutos`);
      
    } catch (error) {
      setErrors({ submit: `Error al procesar la dirección en ${customerData.city}. Verifique que la dirección sea correcta.` });
    } finally {
      setIsLoading(false);
    }
  };

  // Cambiar estado del pedido
  const updateOrderStatus = (orderId, newStatus) => {
    setOrders(prev => prev.map(order => 
      order.id === orderId 
        ? { ...order, status: newStatus, lastUpdated: new Date().toLocaleString('es-CL') }
        : order
    ));

    // Limpiar notificación
    setNotifications(prev => prev.filter(notif => notif.id !== orderId));
  };

  // Ver detalles (delivery)
  const viewOrderDetails = (order) => {
    setCoordinates(order.coordinates);
    setQrCode(order.qrUrl);
    setIsMapVisible(true);
    
    loadLeaflet().then(() => {
      setTimeout(() => {
        initializeMap(order.coordinates.lat, order.coordinates.lng);
      }, 100);
    });
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

  // Filtrar pedidos según el rol
  const getFilteredOrders = () => {
    switch (userRole) {
      case 'cook':
        return orders.filter(order => ['pending', 'cooking'].includes(order.status));
      case 'delivery':
        return orders.filter(order => ['ready', 'delivered'].includes(order.status));
      default:
        return orders;
    }
  };

  const getRoleTitle = () => {
    switch (userRole) {
      case 'cashier': return '🏪 Panel de Cajero/Vendedor';
      case 'cook': return '👨‍🍳 Panel de Cocinero';
      case 'delivery': return '🛵 Panel de Delivery';
      default: return 'Panel de Usuario';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">🍣 Sushi Delivery Puerto Montt</h1>
          <p className="text-gray-600">Sistema de gestión de entregas con roles diferenciados</p>
          <div className="mt-2 text-sm text-blue-600 bg-blue-50 rounded-full px-4 py-2 inline-block">
            📍 Servicio especializado para la Región de Los Lagos, Chile
          </div>
        </div>

        {/* Selector de Rol */}
        <div className="mb-6 bg-white rounded-lg shadow-lg p-4">
          <h3 className="text-lg font-semibold mb-3 text-center">Seleccionar Rol de Usuario</h3>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => {
                setUserRole('cashier');
                setActiveTab('promotions');
                setIsMapVisible(false);
                setQrCode('');
              }}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                userRole === 'cashier' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              🏪 Cajero/Vendedor
            </button>
            <button
              onClick={() => {
                setUserRole('cook');
                setActiveTab('orders');
                setIsMapVisible(false);
                setQrCode('');
              }}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                userRole === 'cook' 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              👨‍🍳 Cocinero
            </button>
            <button
              onClick={() => {
                setUserRole('delivery');
                setActiveTab('orders');
                setIsMapVisible(false);
                setQrCode('');
              }}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                userRole === 'delivery' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              🛵 Delivery
            </button>
          </div>
        </div>

        {/* Título del rol actual */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">{getRoleTitle()}</h2>
        </div>

        {/* Notificaciones */}
        {notifications.length > 0 && (
          <div className="mb-6">
            {notifications.map((notif) => (
              <div key={notif.id} className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-2">
                <div className="flex items-center">
                  <Bell className="text-yellow-500 mr-2" size={20} />
                  <p className="text-yellow-700 font-medium">{notif.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Navegación por pestañas (Cajero) */}
        {userRole === 'cashier' && (
          <div className="mb-6">
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={() => setActiveTab('promotions')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  activeTab === 'promotions' 
                    ? 'bg-red-500 text-white' 
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                🍣 Promociones
              </button>
              <button
                onClick={() => setActiveTab('customer')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  activeTab === 'customer' 
                    ? 'bg-red-500 text-white' 
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                👤 Datos del Cliente
              </button>
              {cart.length > 0 && (
                <button
                  onClick={() => setActiveTab('cart')}
                  className={`px-4 py-2 rounded-lg font-medium transition relative ${
                    activeTab === 'cart' 
                      ? 'bg-green-500 text-white' 
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  🛒 Carrito ({getCartItemCount()})
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {getCartItemCount()}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* CAJERO - Promociones */}
        {userRole === 'cashier' && activeTab === 'promotions' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {promotions.map((promo) => (
              <div key={promo.id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                {promo.popular && (
                  <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-center py-1">
                    <span className="text-sm font-semibold flex items-center justify-center gap-1">
                      <Star size={14} fill="white" />
                      MÁS POPULAR
                    </span>
                  </div>
                )}
                
                <div className="p-6">
                  <div className="text-center mb-4">
                    <span className="text-4xl">{promo.image}</span>
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{promo.name}</h3>
                  <p className="text-gray-600 text-sm mb-4">{promo.description}</p>
                  
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-700 mb-2">Incluye:</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {promo.items.map((item, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <span className="text-green-500">✓</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-gray-400 line-through text-sm">
                        ${formatCLP(promo.originalPrice)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-red-600">
                          ${formatCLP(promo.discountPrice)}
                        </span>
                        <span className="bg-red-100 text-red-600 px-2 py-1 rounded-full text-xs font-semibold">
                          -{promo.discount}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3 text-sm text-gray-600 flex items-center gap-1">
                    <Clock size={14} />
                    Tiempo de preparación: {promo.cookingTime} min
                  </div>
                  
                  <button
                    onClick={() => addToCart(promo)}
                    className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    Agregar al Carrito
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CAJERO - Datos del Cliente */}
        {userRole === 'cashier' && activeTab === 'customer' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
                <User className="text-red-500" />
                Datos del Cliente
              </h2>
              
              <div className="space-y-4">
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Home size={16} className="inline mr-1" />
                    Dirección
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
                </div>

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

                {/* Errores */}
                {errors.submit && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-600 text-sm flex items-center gap-1">
                      <AlertCircle size={16} />
                      {errors.submit}
                    </p>
                  </div>
                )}

                {errors.cart && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-600 text-sm flex items-center gap-1">
                      <AlertCircle size={16} />
                      {errors.cart}
                    </p>
                  </div>
                )}

                {/* Resumen del carrito */}
                {cart.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-800 mb-2">Resumen del Pedido:</h4>
                    <ul className="text-sm text-green-700 space-y-1">
                      {cart.map(item => (
                        <li key={item.id}>
                          {item.quantity}x {item.name} - ${formatCLP(item.discountPrice * item.quantity)}
                        </li>
                      ))}
                    </ul>
                    <div className="border-t border-green-300 mt-2 pt-2">
                      <p className="font-bold text-green-800">
                        Total: ${formatCLP(getCartTotal())}
                      </p>
                      <p className="text-sm text-green-600">
                        Tiempo estimado de cocina: {getEstimatedCookingTime()} minutos
                      </p>
                    </div>
                  </div>
                )}

                {/* Botón crear pedido */}
                <button
                  onClick={handleCreateOrder}
                  disabled={isLoading}
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Package size={18} />
                      Crear Pedido y Enviar a Cocina
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CAJERO - Carrito */}
        {userRole === 'cashier' && activeTab === 'cart' && cart.length > 0 && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
                <ShoppingCart className="text-green-500" />
                Carrito de Compras
              </h2>
              
              <div className="space-y-4">
                {cart.map((item) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{item.image}</span>
                        <div>
                          <h4 className="font-semibold text-gray-800">{item.name}</h4>
                          <p className="text-sm text-gray-600">{item.description}</p>
                          <p className="text-xs text-orange-600">⏱️ {item.cookingTime} min</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="font-semibold text-lg w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-sm text-gray-500">${formatCLP(item.discountPrice)} c/u</p>
                        <p className="font-bold text-lg text-red-600">
                          ${formatCLP(item.discountPrice * item.quantity)}
                        </p>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-500 hover:text-red-700 text-sm mt-1"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="border-t border-gray-200 pt-4 mt-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-semibold text-gray-800">Total del Pedido:</span>
                  <span className="text-2xl font-bold text-red-600">
                    ${formatCLP(getCartTotal())}
                  </span>
                </div>
                
                <div className="text-center space-y-2">
                  <div className="text-sm text-gray-600 flex items-center justify-center gap-2">
                    <Clock size={16} />
                    Tiempo estimado de preparación: {getEstimatedCookingTime()} minutos
                  </div>
                  <button
                    onClick={() => setActiveTab('customer')}
                    className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-6 rounded-lg transition duration-200"
                  >
                    Continuar con Datos del Cliente
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* COCINERO - Lista de pedidos */}
        {userRole === 'cook' && (
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
                <Package className="text-orange-500" />
                Pedidos en Cocina
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {getFilteredOrders().length === 0 ? (
                  <div className="col-span-2 text-center py-8 text-gray-500">
                    <Package size={48} className="mx-auto mb-4 text-gray-300" />
                    <p>No hay pedidos pendientes en este momento</p>
                  </div>
                ) : (
                  getFilteredOrders().map((order) => {
                    const status = orderStatuses[order.status];
                    const StatusIcon = status.icon;
                    
                    return (
                      <div key={order.id} className="border-2 border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="text-lg font-bold text-gray-800">Pedido #{order.id.toString().slice(-4)}</h3>
                            <p className="text-gray-600">{order.name}</p>
                            <p className="text-sm text-gray-500">{order.timestamp}</p>
                          </div>
                          <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${statusPillClass[order.status]}`}>
                            <StatusIcon size={14} />
                            {status.label}
                          </div>
                        </div>
                        
                        <div className="mb-4">
                          <h4 className="font-semibold text-gray-700 mb-2">Pedido:</h4>
                          <ul className="text-sm text-gray-600 space-y-1">
                            {order.cart.map((item, index) => (
                              <li key={index} className="flex justify-between">
                                <span>{item.quantity}x {item.name}</span>
                                <span className="text-orange-600">⏱️ {item.cookingTime}min</span>
                              </li>
                            ))}
                          </ul>
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="text-sm text-orange-600 font-medium">
                              ⏱️ Tiempo máximo estimado: {order.estimatedTime} minutos
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          {order.status === 'pending' && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'cooking')}
                              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
                            >
                              <Package size={16} />
                              Comenzar a Cocinar
                            </button>
                          )}
                          {order.status === 'cooking' && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'ready')}
                              className="flex-1 bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
                            >
                              <Bell size={16} />
                              Marcar como Listo
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* DELIVERY - Lista de pedidos */}
        {userRole === 'delivery' && (
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
                <Package className="text-green-500" />
                Pedidos para Delivery
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {getFilteredOrders().length === 0 ? (
                  <div className="col-span-2 text-center py-8 text-gray-500">
                    <Package size={48} className="mx-auto mb-4 text-gray-300" />
                    <p>No hay pedidos listos para entregar</p>
                  </div>
                ) : (
                  getFilteredOrders().map((order) => {
                    const status = orderStatuses[order.status];
                    const StatusIcon = status.icon;
                    
                    return (
                      <div key={order.id} className="border-2 border-green-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="text-lg font-bold text-gray-800">Pedido #{order.id.toString().slice(-4)}</h3>
                            <p className="text-gray-600 font-semibold">{order.name}</p>
                            <p className="text-sm text-gray-500">{order.phone}</p>
                            <p className="text-sm text-gray-500">{order.timestamp}</p>
                          </div>
                          <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${statusPillClass[order.status]}`}>
                            <StatusIcon size={14} />
                            {status.label}
                          </div>
                        </div>
                        
                        <div className="mb-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-semibold text-gray-700 mb-2">Dirección:</h4>
                              <p className="text-sm text-gray-600">{order.address}</p>
                              <p className="text-sm text-gray-600">{order.city}</p>
                              {order.references && (
                                <p className="text-sm text-blue-600 mt-1">
                                  <strong>Ref:</strong> {order.references}
                                </p>
                              )}
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-700 mb-2">Pedido:</h4>
                              <ul className="text-sm text-gray-600 space-y-1">
                                {order.cart.map((item, index) => (
                                  <li key={index}>
                                    {item.quantity}x {item.name}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                            <span className="font-bold text-green-600 text-lg">
                              Total: ${formatCLP(order.total)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => viewOrderDetails(order)}
                            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
                          >
                            <Eye size={16} />
                            Ver Ubicación
                          </button>
                          {order.status === 'ready' && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'delivered')}
                              className="flex-1 bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
                            >
                              <CheckCircle size={16} />
                              Marcar Entregado
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mapa y QR - Solo para delivery */}
        {userRole === 'delivery' && isMapVisible && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Mapa */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <MapPin className="text-green-500" />
                Ubicación del Cliente
              </h3>
              <div 
                ref={mapRef} 
                className="h-64 w-full rounded-lg border"
                style={{ minHeight: '250px' }}
              />
              <p className="text-sm text-gray-600 mt-2">
                📍 Ubicación exacta del cliente
              </p>
            </div>

            {/* Código QR y navegación */}
            {qrCode && coordinates && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <QrCode className="text-blue-500" />
                  Navegación Rápida
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
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
                    >
                      <Navigation size={16} />
                      Abrir en Google Maps
                    </button>
                    
                    <button
                      onClick={() => openInMaps('', 'waze')}
                      className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-medium py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
                    >
                      <Navigation size={16} />
                      Abrir en Waze
                    </button>
                    
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">
                        <strong>Coordenadas:</strong> {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Historial completo de pedidos - Solo para cajero */}
        {userRole === 'cashier' && orders.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <CheckCircle className="text-blue-500" />
              Historial de Pedidos ({orders.length})
            </h3>
            
            <div className="space-y-4">
              {orders.slice().reverse().map((order) => {
                const status = orderStatuses[order.status];
                const StatusIcon = status.icon;
                
                return (
                  <div key={order.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                      {/* Datos del cliente */}
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-1">Cliente</h4>
                        <p className="text-sm">{order.name}</p>
                        <p className="text-xs text-gray-500">{order.phone}</p>
                        <p className="text-xs text-gray-500">#{order.id.toString().slice(-4)}</p>
                      </div>
                      
                      {/* Dirección */}
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-1">Dirección</h4>
                        <p className="text-sm">{order.address}</p>
                        <p className="text-xs text-gray-500">{order.city}</p>
                      </div>
                      
                      {/* Pedido */}
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-1">Pedido</h4>
                        <ul className="text-xs text-gray-600">
                          {order.cart.map((item, index) => (
                            <li key={index}>{item.quantity}x {item.name}</li>
                          ))}
                        </ul>
                      </div>
                      
                      {/* Estado y total */}
                      <div>
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusPillClass[order.status]} mb-2`}>
                          <StatusIcon size={12} />
                          {status.label}
                        </div>
                        <p className="font-bold text-red-600 text-sm">
                          ${formatCLP(order.total)}
                        </p>
                        <p className="text-xs text-gray-500">{order.timestamp}</p>
                      </div>
                      
                      {/* QR miniatura */}
                      <div className="text-center">
                        <img 
                          src={order.qrUrl} 
                          alt="QR" 
                          className="w-12 h-12 mx-auto"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
