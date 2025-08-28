// src/App.js
import React, { useState, useRef, useEffect } from 'react';
import {
  MapPin,
  User,
  Phone,
  Home,
  MessageSquare,
  QrCode,
  Navigation,
  AlertCircle,
  CheckCircle,
  ShoppingCart,
  Plus,
  Minus,
  Star,
  Clock,
  Package,
  Bell
} from 'lucide-react';

/* ===================== Utils ===================== */
const formatCLP = (value) => new Intl.NumberFormat('es-CL').format(value);

// Dirección de origen fija: Sushikoi
const ORIGIN_ADDRESS = 'Av. Capitán Ávalos 6130, Puerto Montt, Chile';
const ORIGIN_FALLBACK = {
  lat: -41.482093,
  lng: -72.940829,
  name: `Sushikoi — ${ORIGIN_ADDRESS}`,
};

// Construye URL de navegación
const buildGoogleDir = (oLat, oLng, dLat, dLng) =>
  `https://www.google.com/maps/dir/${oLat},${oLng}/${dLat},${dLng}`;
const buildWaze = (dLat, dLng) =>
  `https://waze.com/ul?ll=${dLat},${dLng}&navigate=yes`;

// Debounce simple
const useDebounced = (value, delay = 600) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};

/* ===================== App ===================== */
const App = () => {
  const [userRole, setUserRole] = useState('cashier'); // 'cashier', 'cook', 'delivery'

  // Datos del cliente (para crear pedido)
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    address: '',
    city: 'Puerto Montt',
    references: ''
  });

  // Estado general
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [activeTab, setActiveTab] = useState('promotions');
  const [notifications, setNotifications] = useState([]);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // Origen (Sushikoi)
  const [origin, setOrigin] = useState(ORIGIN_FALLBACK);

  // Vista previa al tipear dirección
  const debouncedAddress = useDebounced(`${customerData.address} ${customerData.city}`.trim(), 700);
  const [addrPreview, setAddrPreview] = useState(null); // {lat,lng} | null
  const addrMapRef = useRef(null);
  const addrMapInstance = useRef(null);

  // Mapas por pedido
  const mapRefs = useRef({});        // orderId -> div
  const mapInstances = useRef({});   // orderId -> Leaflet map

  // Estados de pedidos
  const orderStatuses = {
    pending:   { label: 'Pendiente',          icon: Clock },
    cooking:   { label: 'En Cocina',          icon: Package },
    ready:     { label: 'Listo para Delivery',icon: Bell },
    delivered: { label: 'Entregado',          icon: CheckCircle }
  };
  const statusPillClass = {
    pending:   'bg-yellow-100 text-yellow-800',
    cooking:   'bg-orange-100 text-orange-800',
    ready:     'bg-green-100 text-green-800',
    delivered: 'bg-blue-100 text-blue-800',
  };

  // Promociones
  const promotions = [
    { id: 1, name: "Promo Familiar", description: "40 piezas variadas + 2 bebidas + salsa extra", items: ["20 Makis Salmón","10 Uramakis California","10 Nigiris variados","2 Bebidas 350ml","Salsa Teriyaki"], originalPrice: 18900, discountPrice: 14900, discount: 21, image: "🍣", popular: true,  cookingTime: 25 },
    { id: 2, name: "Combo Ejecutivo", description: "Perfecto para almuerzo o cena individual", items: ["10 Makis Philadelphia","6 Uramakis Ebi","4 Nigiris Salmón","1 Miso Soup","Wasabi y Jengibre"], originalPrice: 8500,  discountPrice: 6900,  discount: 19, image: "🥢", popular: false, cookingTime: 15 },
    { id: 3, name: "Mega Promo Puerto Montt", description: "La promoción más grande para compartir", items: ["30 Makis variados","20 Uramakis especiales","15 Nigiris premium","3 Temakis","4 Bebidas","Postres Mochi (4 unidades)"], originalPrice: 28900, discountPrice: 22900, discount: 21, image: "🏮", popular: true,  cookingTime: 35 },
    { id: 4, name: "Vegetariano Deluxe", description: "Opciones frescas sin pescado ni mariscos", items: ["15 Makis Palta","10 Uramakis Vegetales","8 Inari","Ensalada Wakame","Salsa Soya"], originalPrice: 7900,  discountPrice: 5900,  discount: 25, image: "🥒", popular: false, cookingTime: 12 },
    { id: 5, name: "Especial Salmón", description: "Para los amantes del salmón fresco", items: ["20 Makis Salmón","12 Uramakis Philadelphia","8 Nigiris Salmón","4 Sashimis Salmón","Salsa Especial"], originalPrice: 15900, discountPrice: 12900, discount: 19, image: "🐟", popular: true,  cookingTime: 20 },
    { id: 6, name: "Mariscos del Sur", description: "Sabores del mar de Los Lagos", items: ["15 Uramakis Camarón","10 Makis Pulpo","8 Nigiris Mariscos","6 Gyozas Camarón","Salsa Anguila"], originalPrice: 17900, discountPrice: 13900, discount: 22, image: "🦐", popular: false, cookingTime: 30 }
  ];

  /* ===================== Persistencia básica ===================== */
  useEffect(() => {
    const saved = localStorage.getItem('sushi_orders');
    if (saved) setOrders(JSON.parse(saved));
  }, []);
  useEffect(() => {
    localStorage.setItem('sushi_orders', JSON.stringify(orders));
  }, [orders]);

  /* ===================== Carga Leaflet (on-demand) ===================== */
  const loadLeaflet = () =>
    new Promise((resolve, reject) => {
      if (window.L) return resolve();
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

  /* ===================== Geocoding helpers ===================== */
  const geocodeAddress = async (text) => {
    if (!text || text.length < 5) return null;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&limit=1&countrycodes=cl&addressdetails=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'es-CL' } });
    const data = await res.json();
    if (!data || !data[0]) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    // Guardrails Chile
    if (lat < -56 || lat > -17 || lng < -109 || lng > -66) return null;
    return { lat, lng };
  };

  // Resolver coordenadas reales del origen Sushikoi
  useEffect(() => {
    (async () => {
      try {
        const found = await geocodeAddress(ORIGIN_ADDRESS);
        if (found) setOrigin({ ...found, name: `Sushikoi — ${ORIGIN_ADDRESS}` });
      } catch {
        setOrigin(ORIGIN_FALLBACK); // Fallback seguro en tierra
      }
    })();
  }, []);

  // Preview de dirección mientras escribe
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!debouncedAddress) {
        setAddrPreview(null);
        return;
      }
      try {
        const found = await geocodeAddress(debouncedAddress);
        if (!cancelled) setAddrPreview(found);
      } catch {
        if (!cancelled) setAddrPreview(null);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedAddress]);

  /* ===================== OSRM routing ===================== */
  const getRoute = async (oLat, oLng, dLat, dLng) => {
    const url = `https://router.project-osrm.org/route/v1/driving/${oLng},${oLat};${dLng},${dLat}?overview=full&geometries=geojson&steps=false&alternatives=false&annotations=false&radiuses=100;100`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data || !data.routes || !data.routes[0]) return null;
    const r = data.routes[0];
    const pts = r.geometry.coordinates.map(([lng, lat]) => [lat, lng]); // Leaflet [lat,lng]
    return {
      points: pts,
      distance: r.distance, // meters
      duration: r.duration  // seconds
    };
  };

  /* ===================== Map helpers ===================== */
  const initOrderMap = async (order) => {
    if (!order?.coordinates) return;
    await loadLeaflet();
    const mountEl = mapRefs.current[order.id];
    if (!mountEl) return;

    // Destruye mapa previo si existía
    if (mapInstances.current[order.id]) {
      mapInstances.current[order.id].remove();
      mapInstances.current[order.id] = null;
    }

    const dest = order.coordinates;
    const map = window.L.map(mountEl).setView([dest.lat, dest.lng], 15);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Marcadores origen/destino
    window.L.marker([origin.lat, origin.lng], { title: origin.name }).addTo(map);
    window.L.marker([dest.lat, dest.lng], { title: order.address }).addTo(map);

    // Ruta (OSRM)
    try {
      const route = await getRoute(origin.lat, origin.lng, dest.lat, dest.lng);
      if (route && route.points?.length) {
        window.L.polyline(route.points, { color: 'blue', weight: 4, opacity: 0.8 }).addTo(map);
        const bounds = window.L.latLngBounds(route.points);
        bounds.extend([origin.lat, origin.lng]);
        bounds.extend([dest.lat, dest.lng]);
        map.fitBounds(bounds, { padding: [40, 40] });
      } else {
        // Fallback recta
        const latlngs = [[origin.lat, origin.lng], [dest.lat, dest.lng]];
        window.L.polyline(latlngs, { color: 'blue', weight: 3, opacity: 0.7 }).addTo(map);
        map.fitBounds(latlngs, { padding: [40, 40] });
      }
    } catch {
      const latlngs = [[origin.lat, origin.lng], [dest.lat, dest.lng]];
      window.L.polyline(latlngs, { color: 'blue', weight: 3, opacity: 0.7 }).addTo(map);
      map.fitBounds(latlngs, { padding: [40, 40] });
    }

    mapInstances.current[order.id] = map;
  };

  // Renderizar/actualizar mapas de pedidos cuando cambia la lista / rol / origen
  useEffect(() => {
    if (userRole !== 'delivery') return;
    const toRender = orders.filter(o => ['ready', 'delivered'].includes(o.status));
    if (toRender.length === 0) return;
    (async () => {
      for (const order of toRender) {
        await initOrderMap(order);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, userRole, origin]);

  // Mapa de vista previa de dirección
  useEffect(() => {
    (async () => {
      if (!addrPreview) {
        if (addrMapInstance.current) {
          addrMapInstance.current.remove();
          addrMapInstance.current = null;
        }
        return;
      }
      await loadLeaflet();
      // (re)crear
      if (addrMapInstance.current) addrMapInstance.current.remove();
      const map = window.L.map(addrMapRef.current).setView([addrPreview.lat, addrPreview.lng], 15);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map);
      window.L.marker([origin.lat, origin.lng], { title: origin.name }).addTo(map);
      window.L.marker([addrPreview.lat, addrPreview.lng]).addTo(map);

      try {
        const route = await getRoute(origin.lat, origin.lng, addrPreview.lat, addrPreview.lng);
        if (route?.points?.length) {
          window.L.polyline(route.points, { color: 'blue', weight: 4, opacity: 0.8 }).addTo(map);
          const bounds = window.L.latLngBounds(route.points);
          bounds.extend([origin.lat, origin.lng]);
          bounds.extend([addrPreview.lat, addrPreview.lng]);
          map.fitBounds(bounds, { padding: [30, 30] });
        } else {
          const latlngs = [[origin.lat, origin.lng], [addrPreview.lat, addrPreview.lng]];
          window.L.polyline(latlngs, { color: 'blue', weight: 3, opacity: 0.7 }).addTo(map);
          map.fitBounds(latlngs, { padding: [30, 30] });
        }
      } catch {
        const latlngs = [[origin.lat, origin.lng], [addrPreview.lat, addrPreview.lng]];
        window.L.polyline(latlngs, { color: 'blue', weight: 3, opacity: 0.7 }).addTo(map);
        map.fitBounds(latlngs, { padding: [30, 30] });
      }
      addrMapInstance.current = map;
    })();
  }, [addrPreview, origin]);

  /* ===================== Validaciones y helpers ===================== */
  const validateForm = () => {
    const newErrors = {};
    if (!customerData.name.trim()) newErrors.name = 'El nombre es obligatorio';
    else if (customerData.name.trim().length < 2) newErrors.name = 'El nombre debe tener al menos 2 caracteres';

    if (!customerData.phone.trim()) newErrors.phone = 'El teléfono es obligatorio';
    else if (!/^\+?56\s?9\s?[\d\s-]{7,9}$/.test(customerData.phone.trim()))
      newErrors.phone = 'Formato de teléfono inválido (ej: +56 9 1234 5678)';

    if (!customerData.address.trim()) newErrors.address = 'La dirección es obligatoria';
    else if (customerData.address.trim().length < 5) newErrors.address = 'La dirección debe ser más específica';

    if (cart.length === 0) newErrors.cart = 'Debe agregar al menos una promoción al pedido';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getCartTotal = () => cart.reduce((t, i) => t + (i.discountPrice * i.quantity), 0);
  const getCartItemCount = () => cart.reduce((t, i) => t + i.quantity, 0);
  const getEstimatedCookingTime = () => cart.reduce((m, i) => Math.max(m, i.cookingTime), 0);

  /* ===================== Notificaciones ===================== */
  useEffect(() => {
    if (userRole === 'cook') {
      const pend = orders.filter(o => o.status === 'pending');
      setNotifications(pend.map(o => ({ id: o.id, message: `Nuevo pedido para ${o.name} - ${o.cart.length} item(s)` })));
    } else if (userRole === 'delivery') {
      const ready = orders.filter(o => o.status === 'ready');
      setNotifications(ready.map(o => ({ id: o.id, message: `Pedido listo para entrega - ${o.name}` })));
    } else {
      setNotifications([]);
    }
  }, [orders, userRole]);

  /* ===================== Carrito ===================== */
  const addToCart = (p) => {
    if (userRole !== 'cashier') return;
    const ex = cart.find(i => i.id === p.id);
    if (ex) setCart(cart.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i));
    else setCart([...cart, { ...p, quantity: 1 }]);
  };
  const removeFromCart = (id) => setCart(cart.filter(i => i.id !== id));
  const updateQuantity = (id, q) => q <= 0 ? removeFromCart(id) : setCart(cart.map(i => i.id === id ? { ...i, quantity: q } : i));

  /* ===================== Crear pedido ===================== */
  const handleCreateOrder = async () => {
    if (!validateForm()) return;
    setIsLoading(true);
    try {
      const fullAddress = `${customerData.address}, ${customerData.city}, Los Lagos, Chile`;
      const coords = await geocodeAddress(fullAddress);
      if (!coords) throw new Error('No se encontró dirección');

      const newOrder = {
        id: Date.now(),
        ...customerData,
        cart: [...cart],
        total: getCartTotal(),
        coordinates: coords,
        mapsUrl: buildGoogleDir(origin.lat, origin.lng, coords.lat, coords.lng),
        wazeUrl: buildWaze(coords.lat, coords.lng), // QR en Waze
        status: 'pending',
        timestamp: new Date().toLocaleString('es-CL'),
        estimatedTime: getEstimatedCookingTime(),
        createdBy: 'Cajero'
      };

      setOrders(prev => [...prev, newOrder]);
      setCart([]);
      setCustomerData({ name: '', phone: '', address: '', city: 'Puerto Montt', references: '' });
      setErrors({});
      alert(`✅ Pedido creado para ${newOrder.name}.\n🕐 Estimado cocina: ${newOrder.estimatedTime} min`);
    } catch (e) {
      setErrors({ submit: `Error al procesar la dirección en ${customerData.city}. Verifique que la dirección sea correcta.` });
    } finally {
      setIsLoading(false);
    }
  };

  /* ===================== Cambiar estado ===================== */
  const updateOrderStatus = (orderId, newStatus) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
  };

  /* ===================== Helpers UI ===================== */
  const getFilteredOrders = () => {
    switch (userRole) {
      case 'cook':     return orders.filter(o => ['pending', 'cooking'].includes(o.status));
      case 'delivery': return orders.filter(o => ['ready', 'delivered'].includes(o.status));
      default:         return orders;
    }
  };
  const getRoleTitle = () => ({
    cashier:  '🏪 Panel de Cajero/Vendedor',
    cook:     '👨‍🍳 Panel de Cocinero',
    delivery: '🛵 Panel de Delivery',
  }[userRole] || 'Panel');

  /* ===================== UI ===================== */
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
      <div className="container mx-auto px-4 py-8">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">🍣 Sushi Delivery Puerto Montt</h1>
          <p className="text-gray-600">Sistema de gestión de entregas con roles diferenciados</p>
          <div className="mt-2 text-sm text-blue-600 bg-blue-50 rounded-full px-4 py-2 inline-block">
            📍 Origen: <b>{origin.name}</b>
          </div>
        </div>

        {/* Selector de rol */}
        <div className="mb-6 bg-white rounded-lg shadow-lg p-4">
          <h3 className="text-lg font-semibold mb-3 text-center">Seleccionar Rol de Usuario</h3>
          <div className="flex flex-wrap gap-2 justify-center">
            <button onClick={() => { setUserRole('cashier'); setActiveTab('promotions'); }}
                    className={`px-4 py-2 rounded-lg font-medium transition ${userRole === 'cashier' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>🏪 Cajero/Vendedor</button>
            <button onClick={() => { setUserRole('cook'); setActiveTab('orders'); }}
                    className={`px-4 py-2 rounded-lg font-medium transition ${userRole === 'cook' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>👨‍🍳 Cocinero</button>
            <button onClick={() => { setUserRole('delivery'); setActiveTab('orders'); }}
                    className={`px-4 py-2 rounded-lg font-medium transition ${userRole === 'delivery' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>🛵 Delivery</button>
          </div>
        </div>

        {/* Título rol */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">{getRoleTitle()}</h2>
        </div>

        {/* Notificaciones */}
        {notifications.length > 0 && (
          <div className="mb-6">
            {notifications.map((n) => (
              <div key={n.id} className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-2">
                <div className="flex items-center">
                  <Bell className="text-yellow-500 mr-2" size={20} />
                  <p className="text-yellow-700 font-medium">{n.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs cajero */}
        {userRole === 'cashier' && (
          <div className="mb-6">
            <div className="flex flex-wrap gap-2 justify-center">
              <button onClick={() => setActiveTab('promotions')}
                      className={`px-4 py-2 rounded-lg font-medium transition ${activeTab === 'promotions' ? 'bg-red-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>🍣 Promociones</button>
              <button onClick={() => setActiveTab('customer')}
                      className={`px-4 py-2 rounded-lg font-medium transition ${activeTab === 'customer' ? 'bg-red-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>👤 Datos del Cliente</button>
              {cart.length > 0 && (
                <button onClick={() => setActiveTab('cart')}
                        className={`px-4 py-2 rounded-lg font-medium transition relative ${activeTab === 'cart' ? 'bg-green-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
                  🛒 Carrito ({getCartItemCount()})
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {getCartItemCount()}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Cajero - Promociones */}
        {userRole === 'cashier' && activeTab === 'promotions' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {promotions.map((p) => (
              <div key={p.id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                {p.popular && (
                  <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-center py-1">
                    <span className="text-sm font-semibold flex items-center justify-center gap-1">
                      <Star size={14} fill="white" /> MÁS POPULAR
                    </span>
                  </div>
                )}
                <div className="p-6">
                  <div className="text-center mb-4"><span className="text-4xl">{p.image}</span></div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{p.name}</h3>
                  <p className="text-gray-600 text-sm mb-4">{p.description}</p>
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-700 mb-2">Incluye:</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {p.items.map((it, i) => <li key={i} className="flex items-center gap-2"><span className="text-green-500">✓</span>{it}</li>)}
                    </ul>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-gray-400 line-through text-sm">${formatCLP(p.originalPrice)}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-red-600">${formatCLP(p.discountPrice)}</span>
                        <span className="bg-red-100 text-red-600 px-2 py-1 rounded-full text-xs font-semibold">-{p.discount}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="mb-3 text-sm text-gray-600 flex items-center gap-1"><Clock size={14} />Tiempo de preparación: {p.cookingTime} min</div>
                  <button onClick={() => addToCart(p)} className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2">
                    <Plus size={16} /> Agregar al Carrito
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cajero - Datos del cliente */}
        {userRole === 'cashier' && activeTab === 'customer' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
                <User className="text-red-500" /> Datos del Cliente
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <User size={16} className="inline mr-1" /> Nombre Completo
                  </label>
                  <input
                    type="text"
                    value={customerData.name}
                    onChange={(e) => setCustomerData(v => ({ ...v, name: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="Ingrese el nombre completo"
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Phone size={16} className="inline mr-1" /> Teléfono
                  </label>
                  <input
                    type="tel"
                    value={customerData.phone}
                    onChange={(e) => setCustomerData(v => ({ ...v, phone: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent ${errors.phone ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="+56 9 1234 5678"
                  />
                  {errors.phone && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.phone}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Home size={16} className="inline mr-1" /> Dirección
                  </label>
                  <input
                    type="text"
                    value={customerData.address}
                    onChange={(e) => setCustomerData(v => ({ ...v, address: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent ${errors.address ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="Ej: Av. Diego Portales 1150, sector Centro"
                  />
                  {addrPreview && (
                    <p className="text-green-600 text-xs mt-1 flex items-center gap-1">
                      <CheckCircle size={12} /> Dirección encontrada ✓
                    </p>
                  )}
                  {!addrPreview && customerData.address.trim().length >= 5 && (
                    <p className="text-amber-600 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle size={12} /> Buscando dirección...
                    </p>
                  )}
                  {errors.address && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.address}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <MapPin size={16} className="inline mr-1" /> Ciudad
                  </label>
                  <select
                    value={customerData.city}
                    onChange={(e) => setCustomerData(v => ({ ...v, city: e.target.value }))}
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
                    <MessageSquare size={16} className="inline mr-1" /> Referencias (Opcional)
                  </label>
                  <textarea
                    value={customerData.references}
                    onChange={(e) => setCustomerData(v => ({ ...v, references: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Ej: Casa frente al semáforo, casa amarilla con reja negra..."
                    rows="3"
                  />
                </div>

                {/* Preview Map de dirección (si existe) */}
                {addrPreview && (
                  <div className="bg-white border rounded-lg p-3">
                    <h4 className="font-semibold text-gray-700 mb-2">Vista previa de ruta desde Sushikoi</h4>
                    <div ref={addrMapRef} className="h-48 w-full rounded-lg border" />
                    <div className="text-xs text-gray-500 mt-2">
                      Origen: <b>{origin.name}</b>
                    </div>
                  </div>
                )}

                {errors.submit && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-600 text-sm flex items-center gap-1">
                      <AlertCircle size={16} /> {errors.submit}
                    </p>
                  </div>
                )}
                {errors.cart && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-600 text-sm flex items-center gap-1">
                      <AlertCircle size={16} /> {errors.cart}
                    </p>
                  </div>
                )}

                {/* Resumen carrito */}
                {cart.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-800 mb-2">Resumen del Pedido:</h4>
                    <ul className="text-sm text-green-700 space-y-1">
                      {cart.map(i => <li key={i.id}>{i.quantity}x {i.name} - ${formatCLP(i.discountPrice * i.quantity)}</li>)}
                    </ul>
                    <div className="border-t border-green-300 mt-2 pt-2">
                      <p className="font-bold text-green-800">Total: ${formatCLP(getCartTotal())}</p>
                      <p className="text-sm text-green-600">Tiempo estimado de cocina: {getEstimatedCookingTime()} minutos</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleCreateOrder}
                  disabled={isLoading}
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
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

        {/* Cajero - Carrito */}
        {userRole === 'cashier' && activeTab === 'cart' && cart.length > 0 && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
                <ShoppingCart className="text-green-500" /> Carrito de Compras
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
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center"><Minus size={14} /></button>
                        <span className="font-semibold text-lg w-8 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center"><Plus size={14} /></button>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">${formatCLP(item.discountPrice)} c/u</p>
                        <p className="font-bold text-lg text-red-600">${formatCLP(item.discountPrice * item.quantity)}</p>
                        <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-700 text-sm mt-1">Eliminar</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 pt-4 mt-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-semibold text-gray-800">Total del Pedido:</span>
                  <span className="text-2xl font-bold text-red-600">${formatCLP(getCartTotal())}</span>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-sm text-gray-600 flex items-center justify-center gap-2"><Clock size={16} />Tiempo estimado de preparación: {getEstimatedCookingTime()} minutos</div>
                  <button onClick={() => setActiveTab('customer')} className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-6 rounded-lg transition">Continuar con Datos del Cliente</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cocinero - Lista */}
        {userRole === 'cook' && (
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
                <Package className="text-orange-500" /> Pedidos en Cocina
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {getFilteredOrders().length === 0 ? (
                  <div className="col-span-2 text-center py-8 text-gray-500">
                    <Package size={48} className="mx-auto mb-4 text-gray-300" />
                    <p>No hay pedidos pendientes en este momento</p>
                  </div>
                ) : (
                  getFilteredOrders().map(order => {
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
                            <StatusIcon size={14} /> {status.label}
                          </div>
                        </div>
                        <div className="mb-4">
                          <h4 className="font-semibold text-gray-700 mb-2">Pedido:</h4>
                          <ul className="text-sm text-gray-600 space-y-1">
                            {order.cart.map((it, i) => (
                              <li key={i} className="flex justify-between">
                                <span>{it.quantity}x {it.name}</span>
                                <span className="text-orange-600">⏱️ {it.cookingTime}min</span>
                              </li>
                            ))}
                          </ul>
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="text-sm text-orange-600 font-medium">⏱️ Máximo estimado: {order.estimatedTime} minutos</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {order.status === 'pending' && (
                            <button onClick={() => updateOrderStatus(order.id, 'cooking')} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-2">
                              <Package size={16} /> Comenzar a Cocinar
                            </button>
                          )}
                          {order.status === 'cooking' && (
                            <button onClick={() => updateOrderStatus(order.id, 'ready')} className="flex-1 bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-2">
                              <Bell size={16} /> Marcar como Listo
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

        {/* Delivery - Lista con mapa + QR Waze por pedido */}
        {userRole === 'delivery' && (
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
                <Package className="text-green-500" /> Pedidos para Delivery
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {getFilteredOrders().length === 0 ? (
                  <div className="col-span-2 text-center py-8 text-gray-500">
                    <Package size={48} className="mx-auto mb-4 text-gray-300" />
                    <p>No hay pedidos listos para entregar</p>
                  </div>
                ) : (
                  getFilteredOrders().map(order => {
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
                            <StatusIcon size={14} /> {status.label}
                          </div>
                        </div>

                        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-semibold text-gray-700 mb-2">Dirección:</h4>
                            <p className="text-sm text-gray-600">{order.address}</p>
                            <p className="text-sm text-gray-600">{order.city}</p>
                            {order.references && <p className="text-sm text-blue-600 mt-1"><strong>Ref:</strong> {order.references}</p>}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-700 mb-2">Pedido:</h4>
                            <ul className="text-sm text-gray-600 space-y-1">
                              {order.cart.map((it, i) => <li key={i}>{it.quantity}x {it.name}</li>)}
                            </ul>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                          <span className="font-bold text-green-600 text-lg">Total: ${formatCLP(order.total)}</span>
                        </div>

                        {/* Mapa por pedido */}
                        <div ref={(el) => (mapRefs.current[order.id] = el)} className="h-64 w-full rounded-lg border my-4" />

                        {/* Navegación rápida (QR Waze) */}
                        {order.coordinates && (
                          <div className="bg-gray-50 rounded-lg p-4 text-center">
                            <p className="text-xs text-gray-500 mb-2">
                              Inicio de ruta: <strong>{origin.name}</strong>
                            </p>
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(order.wazeUrl || buildWaze(order.coordinates.lat, order.coordinates.lng))}`}
                              alt="QR Waze"
                              className="mx-auto mb-4 border rounded-lg shadow-sm"
                            />
                            <button
                              onClick={() => window.open(buildGoogleDir(origin.lat, origin.lng, order.coordinates.lat, order.coordinates.lng), '_blank')}
                              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg mb-2 flex items-center justify-center gap-2"
                            >
                              <Navigation size={16} /> Abrir en Google Maps
                            </button>
                            <button
                              onClick={() => window.open(buildWaze(order.coordinates.lat, order.coordinates.lng), '_blank')}
                              className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2"
                            >
                              <Navigation size={16} /> Abrir en Waze
                            </button>
                            <p className="text-sm text-gray-600 mt-2">
                              <strong>Coordenadas:</strong> {order.coordinates.lat.toFixed(6)}, {order.coordinates.lng.toFixed(6)}
                            </p>
                          </div>
                        )}

                        {order.status === 'ready' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'delivered')}
                            className="mt-4 w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2"
                          >
                            <CheckCircle size={16} /> Marcar Entregado
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Historial cajero */}
        {userRole === 'cashier' && orders.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <CheckCircle className="text-blue-500" /> Historial de Pedidos ({orders.length})
            </h3>
            <div className="space-y-4">
              {orders.slice().reverse().map(order => {
                const status = orderStatuses[order.status];
                const StatusIcon = status.icon;
                return (
                  <div key={order.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-1">Cliente</h4>
                        <p className="text-sm">{order.name}</p>
                        <p className="text-xs text-gray-500">{order.phone}</p>
                        <p className="text-xs text-gray-500">#{order.id.toString().slice(-4)}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-1">Dirección</h4>
                        <p className="text-sm">{order.address}</p>
                        <p className="text-xs text-gray-500">{order.city}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-1">Pedido</h4>
                        <ul className="text-xs text-gray-600">
                          {order.cart.map((it, i) => <li key={i}>{it.quantity}x {it.name}</li>)}
                        </ul>
                      </div>
                      <div>
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusPillClass[order.status]} mb-2`}>
                          <StatusIcon size={12} /> {status.label}
                        </div>
                        <p className="font-bold text-red-600 text-sm">${formatCLP(order.total)}</p>
                        <p className="text-xs text-gray-500">{order.timestamp}</p>
                      </div>
                      <div className="text-center">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(order.wazeUrl || buildWaze(order.coordinates?.lat ?? 0, order.coordinates?.lng ?? 0))}`}
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
