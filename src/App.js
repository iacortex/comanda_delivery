import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  MapPin,
  User,
  Phone,
  Home,
  Landmark,
  Hash,
  Navigation,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  ShoppingCart,
  Plus,
  Minus,
  Star,
  Clock,
  Package,
  Bell,
  CreditCard,
  DollarSign,
  Wallet,
  Search,
} from "lucide-react";

/* ===================== Utils ===================== */
const formatCLP = (value) => new Intl.NumberFormat("es-CL").format(value);
const formatKm = (m) => `${(m / 1000).toFixed(1)} km`;
const formatDur = (s) => {
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
};
const pad = (n) => String(n).padStart(2, "0");

/* Origen fijo: Sushikoi (tus coords) */
const ORIGIN = {
  lat: -41.46619826299714,
  lng: -72.99901571534275,
  name: "Sushikoi — Av. Capitán Ávalos 6130, Puerto Montt, Chile",
};

const gmapsDir = (dLat, dLng) =>
  `https://www.google.com/maps/dir/${ORIGIN.lat},${ORIGIN.lng}/${dLat},${dLng}`;
const wazeUrl = (dLat, dLng) =>
  `https://waze.com/ul?ll=${dLat},${dLng}&navigate=yes`;

const PAYMENT_METHODS = [
  { value: "debito", label: "Débito" },
  { value: "credito", label: "Crédito" },
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "otro", label: "Otro" },
];

/* Debounce simple */
const useDebounced = (value, delay = 600) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};

/* Ticker 1s para contadores */
const useTicker = () => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
};

/* ===================== Leaflet loader ===================== */
const loadLeaflet = () =>
  new Promise((resolve, reject) => {
    if (window.L) return resolve();
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

/* ===================== Geocoder mejorado (respeta numeración) ===================== */
/**
 * Devuelve { lat, lng, precision: 'exact'|'road'|'fallback', matchedNumber: boolean }
 * con búsqueda estructurada y restricciones a Puerto Montt.
 */
const geocodeSmart = async ({ street, number, sector, city }) => {
  const cityName = city || "Puerto Montt";
  const streetTrim = (street || "").trim();
  const numberTrim = (number || "").trim();

  if (!streetTrim) return null;

  // Viewbox aprox Puerto Montt
  const viewbox = "-73.2,-41.7,-72.7,-41.3";

  const candidates = [];

  // 1) estructurado con "número + calle"
  if (numberTrim) {
    const url1 = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&countrycodes=cl&bounded=1&viewbox=${viewbox}&street=${encodeURIComponent(
      `${numberTrim} ${streetTrim}`
    )}&city=${encodeURIComponent(cityName)}&country=Chile&dedupe=1&extratags=1`;
    candidates.push(url1);

    // 1b) variante con sector
    if (sector && sector.trim()) {
      const url1b = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&countrycodes=cl&bounded=1&viewbox=${viewbox}&street=${encodeURIComponent(
        `${numberTrim} ${streetTrim}`
      )}&city=${encodeURIComponent(cityName)}&county=${encodeURIComponent(
        sector
      )}&country=Chile&dedupe=1&extratags=1`;
      candidates.push(url1b);
    }

    // 1c) alterno: sólo calle (luego filtramos house_number exacto si viene)
    const url1c = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&countrycodes=cl&bounded=1&viewbox=${viewbox}&street=${encodeURIComponent(
      streetTrim
    )}&city=${encodeURIComponent(cityName)}&country=Chile&dedupe=1&extratags=1`;
    candidates.push(url1c);
  }

  // 2) libre con número
  const freeText = `${streetTrim} ${numberTrim ? numberTrim : ""}, ${
    sector ? sector + ", " : ""
  }${cityName}, Los Lagos, Chile`;
  const url2 = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&countrycodes=cl&bounded=1&viewbox=${viewbox}&q=${encodeURIComponent(
    freeText
  )}&dedupe=1&extratags=1`;
  candidates.push(url2);

  // 3) sólo calle + ciudad
  const url3 = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&countrycodes=cl&bounded=1&viewbox=${viewbox}&q=${encodeURIComponent(
    `${streetTrim}, ${cityName}, Chile`
  )}&dedupe=1&extratags=1`;
  candidates.push(url3);

  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: { "Accept-Language": "es-CL" } });
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) continue;

      const pick = (rec, precision, matchedNumber = false) => {
        const lat = parseFloat(rec.lat),
          lng = parseFloat(rec.lon);
        if (isFinite(lat) && isFinite(lng))
          return { lat, lng, precision, matchedNumber };
        return null;
      };

      if (numberTrim) {
        // match exacto por house_number
        const exact = data.find((r) => {
          const hn = r?.address?.house_number || r?.address?.housenumber;
          return hn && String(hn).trim() === numberTrim;
        });
        if (exact) {
          const ex = pick(exact, "exact", true);
          if (ex) return ex;
        }
      }

      // priorizar misma calle
      const sameRoad = data.find((r) => {
        const road = (r?.address?.road || "").toLowerCase();
        return road.includes(streetTrim.toLowerCase());
      });
      if (sameRoad) {
        const sr = pick(sameRoad, "road", false);
        if (sr) return sr;
      }

      // fallback: primero del set
      const fb = pick(data[0], "fallback", false);
      if (fb) return fb;
    } catch {
      /* seguimos */
    }
  }
  return null;
};

/* ===================== OSRM routing ===================== */
const fetchRoute = async (dLat, dLng) => {
  const url = `https://router.project-osrm.org/route/v1/driving/${ORIGIN.lng},${ORIGIN.lat};${dLng},${dLat}?overview=full&geometries=geojson&alternatives=false&steps=false&annotations=false&radiuses=100;100`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data?.routes?.[0]) return null;
  const r = data.routes[0];
  const points = r.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  return { points, distance: r.distance, duration: r.duration };
};

/* ===================== Tarjeta de Delivery ===================== */
const DeliveryOrderCard = ({
  order,
  statusPillClass,
  orderStatuses,
  onDelivered,
  onConfirmPayment,
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!order.coordinates) return;
      await loadLeaflet();

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (!mapRef.current || !mounted) return;

      const { lat, lng } = order.coordinates;
      const map = window.L.map(mapRef.current).setView([lat, lng], 15);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      window.L.marker([ORIGIN.lat, ORIGIN.lng], { title: ORIGIN.name }).addTo(
        map
      );
      window.L.marker([lat, lng]).addTo(map);

      try {
        const route = await fetchRoute(lat, lng);
        if (route?.points?.length) {
          window.L.polyline(route.points, {
            color: "blue",
            weight: 4,
            opacity: 0.85,
          }).addTo(map);
          const bounds = window.L.latLngBounds(route.points);
          bounds.extend([ORIGIN.lat, ORIGIN.lng]);
          bounds.extend([lat, lng]);
          map.fitBounds(bounds, { padding: [40, 40] });
        } else {
          const latlngs = [
            [ORIGIN.lat, ORIGIN.lng],
            [lat, lng],
          ];
          window.L.polyline(latlngs, {
            color: "blue",
            weight: 3,
            opacity: 0.7,
          }).addTo(map);
          map.fitBounds(latlngs, { padding: [40, 40] });
        }
      } catch {
        const latlngs = [
          [ORIGIN.lat, ORIGIN.lng],
          [lat, lng],
        ];
        window.L.polyline(latlngs, {
          color: "blue",
          weight: 3,
          opacity: 0.7,
        }).addTo(map);
        map.fitBounds(latlngs, { padding: [40, 40] });
      }

      mapInstanceRef.current = map;
    })();
    return () => {
      mounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [order.coordinates, order.id]);

  const StatusIcon = orderStatuses[order.status].icon;
  const unpaid = order.paymentStatus === "due";

  return (
    <div className="border-2 border-green-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-lg font-bold text-gray-800">
            Pedido #{order.id.toString().slice(-4)}
          </h3>
          <p className="text-gray-600 font-semibold">{order.name}</p>
          <p className="text-sm text-gray-500">{order.phone}</p>
          <p className="text-sm text-gray-500">{order.timestamp}</p>
        </div>
        <div
          className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
            statusPillClass[order.status]
          }`}
        >
          <StatusIcon size={14} /> {orderStatuses[order.status].label}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-semibold text-gray-700 mb-2">Dirección:</h4>
          <p className="text-sm text-gray-600">{order.address}</p>
          <p className="text-sm text-gray-600">{order.city}</p>
          {order.references && (
            <p className="text-sm text-blue-600 mt-1">
              <strong>Ref:</strong> {order.references}
            </p>
          )}
          {order.geocodePrecision && order.geocodePrecision !== "exact" && (
            <p className="text-xs mt-2 px-2 py-1 rounded bg-amber-50 text-amber-800 inline-flex items-center gap-1">
              <AlertCircle size={12} /> Punto aproximado (
              {order.geocodePrecision})
            </p>
          )}
        </div>
        <div>
          <h4 className="font-semibold text-gray-700 mb-2">Pedido:</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            {order.cart.map((it, i) => (
              <li key={i}>
                {it.quantity}x {it.name}
              </li>
            ))}
          </ul>

          <div className="mt-3 text-sm">
            <p className="font-semibold text-gray-700 mb-1">Pago</p>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-xs ${
                  unpaid
                    ? "bg-red-100 text-red-700"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {unpaid ? "Por pagar" : "Pagado"}
              </span>
              <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 capitalize">
                {unpaid
                  ? `Pagará: ${order.dueMethod}`
                  : `Método: ${order.paymentMethod}`}
              </span>
              {unpaid && (
                <button
                  onClick={onConfirmPayment}
                  className="ml-auto bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 rounded text-xs flex items-center gap-1"
                >
                  <CheckCircle size={12} /> Confirmar pago
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold text-green-600 text-lg">
          Total: ${formatCLP(order.total)}
        </span>
        {order.routeMeta && (
          <span className="text-sm text-gray-600">
            🛣️ {formatKm(order.routeMeta.distance)} • ⏱️{" "}
            {formatDur(order.routeMeta.duration)}
          </span>
        )}
      </div>

      <div ref={mapRef} className="h-64 w-full rounded-lg border my-4" />

      {/* Navegación rápida – QR Waze */}
      {order.coordinates && (
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <p className="text-xs text-gray-500 mb-2">
            Inicio: <strong>{ORIGIN.name}</strong>
          </p>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
              order.wazeUrl ||
                wazeUrl(order.coordinates.lat, order.coordinates.lng)
            )}`}
            alt="QR Waze"
            className="mx-auto mb-4 border rounded-lg shadow-sm"
          />
          <button
            onClick={() =>
              window.open(
                gmapsDir(order.coordinates.lat, order.coordinates.lng),
                "_blank"
              )
            }
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg mb-2 flex items-center justify-center gap-2"
          >
            <Navigation size={16} /> Abrir en Google Maps
          </button>
          <button
            onClick={() =>
              window.open(
                wazeUrl(order.coordinates.lat, order.coordinates.lng),
                "_blank"
              )
            }
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2"
          >
            <Navigation size={16} /> Abrir en Waze
          </button>
        </div>
      )}

      {order.status === "ready" && (
        <button
          onClick={onDelivered}
          disabled={order.paymentStatus === "due"}
          className={`mt-4 w-full ${
            order.paymentStatus === "due"
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-green-500 hover:bg-green-600"
          } text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2`}
        >
          <CheckCircle size={16} /> Marcar Entregado
        </button>
      )}
    </div>
  );
};

/* ===================== App ===================== */
const App = () => {
  useTicker();

  const [userRole, setUserRole] = useState("cashier"); // 'cashier', 'cook', 'delivery'
  const [showDashboard, setShowDashboard] = useState(false);

  /* ===== Datos del cliente ===== */
  const [customerMode, setCustomerMode] = useState("new"); // 'new' | 'existing'
  const [customerData, setCustomerData] = useState({
    name: "",
    phone: "",
    street: "",
    number: "",
    sector: "",
    city: "Puerto Montt",
    references: "",
    paymentMethod: "debito",
    paymentStatus: "paid", // 'paid' | 'due'
    dueMethod: "efectivo",
  });

  // DB local de clientes
  const [customers, setCustomers] = useState([]);
  const [customerQuery, setCustomerQuery] = useState("");

  // Estado general
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [activeTab, setActiveTab] = useState("promotions"); // para cajero
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  /* ===== Vista previa / selección de ubicación ===== */
  const searchKey = `${customerData.street}|${customerData.number}|${customerData.sector}|${customerData.city}`;
  const debouncedKey = useDebounced(searchKey, 700);
  const [geocodedCoords, setGeocodedCoords] = useState(null); // {lat,lng,precision,matchedNumber}
  const [selectedCoords, setSelectedCoords] = useState(null);
  const addrMapRef = useRef(null);
  const addrMapInstance = useRef(null);

  /* ===== Estados de pedido ===== */
  const orderStatuses = {
    pending: { label: "Pendiente", icon: Clock },
    cooking: { label: "En Cocina", icon: Package },
    ready: { label: "Listo para Delivery", icon: Bell },
    delivered: { label: "Entregado", icon: CheckCircle },
  };
  const statusPillClass = {
    pending: "bg-yellow-100 text-yellow-800",
    cooking: "bg-orange-100 text-orange-800",
    ready: "bg-green-100 text-green-800",
    delivered: "bg-blue-100 text-blue-800",
  };

  /* ===== Promociones ===== */
  const promotions = [
    {
      id: 1,
      name: "Promo Familiar",
      description: "40 piezas variadas + 2 bebidas + salsa extra",
      items: [
        "20 Makis Salmón",
        "10 Uramakis California",
        "10 Nigiris variados",
        "2 Bebidas 350ml",
        "Salsa Teriyaki",
      ],
      originalPrice: 18900,
      discountPrice: 14900,
      discount: 21,
      image: "🍣",
      popular: true,
      cookingTime: 25,
    },
    {
      id: 2,
      name: "Combo Ejecutivo",
      description: "Perfecto para almuerzo o cena individual",
      items: [
        "10 Makis Philadelphia",
        "6 Uramakis Ebi",
        "4 Nigiris Salmón",
        "1 Miso Soup",
        "Wasabi y Jengibre",
      ],
      originalPrice: 8500,
      discountPrice: 6900,
      discount: 19,
      image: "🥢",
      popular: false,
      cookingTime: 15,
    },
    {
      id: 3,
      name: "Mega Promo Puerto Montt",
      description: "La promoción más grande para compartir",
      items: [
        "30 Makis variados",
        "20 Uramakis especiales",
        "15 Nigiris premium",
        "3 Temakis",
        "4 Bebidas",
        "Postres Mochi (4 unidades)",
      ],
      originalPrice: 28900,
      discountPrice: 22900,
      discount: 21,
      image: "🏮",
      popular: true,
      cookingTime: 35,
    },
    {
      id: 4,
      name: "Vegetariano Deluxe",
      description: "Opciones frescas sin pescado ni mariscos",
      items: [
        "15 Makis Palta",
        "10 Uramakis Vegetales",
        "8 Inari",
        "Ensalada Wakame",
        "Salsa Soya",
      ],
      originalPrice: 7900,
      discountPrice: 5900,
      discount: 25,
      image: "🥒",
      popular: false,
      cookingTime: 12,
    },
    {
      id: 5,
      name: "Especial Salmón",
      description: "Para los amantes del salmón fresco",
      items: [
        "20 Makis Salmón",
        "12 Uramakis Philadelphia",
        "8 Nigiris Salmón",
        "4 Sashimis Salmón",
        "Salsa Especial",
      ],
      originalPrice: 15900,
      discountPrice: 12900,
      discount: 19,
      image: "🐟",
      popular: true,
      cookingTime: 20,
    },
    {
      id: 6,
      name: "Mariscos del Sur",
      description: "Sabores del mar de Los Lagos",
      items: [
        "15 Uramakis Camarón",
        "10 Makis Pulpo",
        "8 Nigiris Mariscos",
        "6 Gyozas Camarón",
        "Salsa Anguila",
      ],
      originalPrice: 17900,
      discountPrice: 13900,
      discount: 22,
      image: "🦐",
      popular: false,
      cookingTime: 30,
    },
  ];

  /* ===================== Persistencia ===================== */
  useEffect(() => {
    const saved = localStorage.getItem("sushi_orders");
    if (saved) setOrders(JSON.parse(saved));
    const sc = localStorage.getItem("sushi_customers");
    if (sc) setCustomers(JSON.parse(sc));
  }, []);
  useEffect(() => {
    localStorage.setItem("sushi_orders", JSON.stringify(orders));
  }, [orders]);
  useEffect(() => {
    localStorage.setItem("sushi_customers", JSON.stringify(customers));
  }, [customers]);

  /* ===================== Preview: geocodificar + mapa draggable ===================== */
  useEffect(() => {
    let cancel = false;
    (async () => {
      const [street, number, sector, city] = searchKey.split("|");
      if (!street || street.trim().length < 2) {
        setGeocodedCoords(null);
        setSelectedCoords(null);
        if (addrMapInstance.current) {
          addrMapInstance.current.remove();
          addrMapInstance.current = null;
        }
        return;
      }
      try {
        const found = await geocodeSmart({ street, number, sector, city });
        if (cancel) return;
        setGeocodedCoords(found);
        setSelectedCoords(found ? { lat: found.lat, lng: found.lng } : null);
      } catch {
        if (!cancel) {
          setGeocodedCoords(null);
          setSelectedCoords(null);
        }
      }
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedKey]);

  useEffect(() => {
    (async () => {
      if (!selectedCoords) return;
      await loadLeaflet();

      if (addrMapInstance.current) addrMapInstance.current.remove();
      const map = window.L.map(addrMapRef.current).setView(
        [selectedCoords.lat, selectedCoords.lng],
        17
      );
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      // origen fijo
      window.L.marker([ORIGIN.lat, ORIGIN.lng], { title: ORIGIN.name }).addTo(
        map
      );

      // marcador arrastrable (destino)
      const marker = window.L.marker([selectedCoords.lat, selectedCoords.lng], {
        draggable: true,
      }).addTo(map);
      marker.on("dragend", async (e) => {
        const { lat, lng } = e.target.getLatLng();
        setSelectedCoords({ lat, lng });
      });

      // dibujar ruta (si está disponible)
      try {
        const route = await fetchRoute(selectedCoords.lat, selectedCoords.lng);
        if (route?.points?.length) {
          window.L.polyline(route.points, {
            color: "blue",
            weight: 4,
            opacity: 0.85,
          }).addTo(map);
          const bounds = window.L.latLngBounds(route.points);
          bounds.extend([ORIGIN.lat, ORIGIN.lng]);
          bounds.extend([selectedCoords.lat, selectedCoords.lng]);
          map.fitBounds(bounds, { padding: [30, 30] });
        }
      } catch {
        /* noop */
      }

      addrMapInstance.current = map;
    })();
  }, [selectedCoords]);

  /* ===================== Validaciones ===================== */
  const validateForm = () => {
    const e = {};
    if (!customerData.name.trim()) e.name = "El nombre es obligatorio";
    else if (customerData.name.trim().length < 2)
      e.name = "El nombre debe tener al menos 2 caracteres";

    if (!customerData.phone.trim()) e.phone = "El teléfono es obligatorio";
    else if (!/^\+?56\s?9\s?[\d\s-]{7,9}$/.test(customerData.phone.trim()))
      e.phone = "Formato inválido (ej: +56 9 1234 5678)";

    if (!customerData.street.trim()) e.street = "La calle es obligatoria";
    if (!customerData.number.trim()) e.number = "El número es obligatorio";

    if (cart.length === 0) e.cart = "Debe agregar al menos una promoción";

    if (!selectedCoords)
      e.address = "Ubique el pin en el mapa para confirmar la ubicación exacta";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ===================== Carrito ===================== */
  const addToCart = (p) => {
    if (userRole !== "cashier") return;
    const ex = cart.find((i) => i.id === p.id);
    if (ex)
      setCart(
        cart.map((i) =>
          i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      );
    else setCart([...cart, { ...p, quantity: 1 }]);
  };
  const removeFromCart = (id) => setCart(cart.filter((i) => i.id !== id));
  const updateQuantity = (id, q) =>
    q <= 0
      ? removeFromCart(id)
      : setCart(cart.map((i) => (i.id === id ? { ...i, quantity: q } : i)));
  const getCartTotal = () =>
    cart.reduce((t, i) => t + i.discountPrice * i.quantity, 0);
  const getCartItemCount = () => cart.reduce((t, i) => t + i.quantity, 0);
  const getEstimatedCookingTime = () =>
    cart.reduce((m, i) => Math.max(m, i.cookingTime), 0);

  /* ===================== Clientes: búsqueda y selección ===================== */
  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers.slice(0, 6);
    return customers
      .filter(
        (c) =>
          (c.name && c.name.toLowerCase().includes(q)) ||
          (c.phone &&
            c.phone.replace(/\s|-/g, "").includes(q.replace(/\s|-/g, "")))
      )
      .slice(0, 10);
  }, [customerQuery, customers]);

  const selectCustomer = (c) => {
    setCustomerData({
      name: c.name || "",
      phone: c.phone || "",
      street: c.street || "",
      number: c.number || "",
      sector: c.sector || "",
      city: c.city || "Puerto Montt",
      references: c.references || "",
      paymentMethod: "debito",
      paymentStatus: "paid",
      dueMethod: "efectivo",
    });
    if (c.coordinates) {
      setSelectedCoords({ ...c.coordinates });
      setGeocodedCoords({
        ...c.coordinates,
        precision: "exact",
        matchedNumber: true,
      });
    }
    setCustomerMode("new"); // deja listo el formulario para crear pedido
    setActiveTab("customer");
  };

  /* ===================== Crear pedido ===================== */
  const handleCreateOrder = async () => {
    if (!validateForm()) return;
    setIsLoading(true);
    try {
      const addrStr = `${customerData.street} ${customerData.number}${
        customerData.sector ? `, ${customerData.sector}` : ""
      }`;
      const coords = selectedCoords;
      const route = await fetchRoute(coords.lat, coords.lng);

      const newOrder = {
        id: Date.now(),
        name: customerData.name,
        phone: customerData.phone,
        address: addrStr,
        city: customerData.city,
        references: customerData.references,
        cart: [...cart],
        total: getCartTotal(),
        coordinates: coords,
        mapsUrl: gmapsDir(coords.lat, coords.lng),
        wazeUrl: wazeUrl(coords.lat, coords.lng),
        status: "pending",
        timestamp: new Date().toLocaleString("es-CL"),
        estimatedTime: getEstimatedCookingTime(),
        routeMeta: route
          ? { distance: route.distance, duration: route.duration }
          : null,
        createdBy: "Cajero",
        geocodePrecision: geocodedCoords?.precision || "unknown",
        paymentMethod: customerData.paymentMethod,
        paymentStatus: customerData.paymentStatus, // 'paid' | 'due'
        dueMethod: customerData.dueMethod,
        packUntil: null, // se setea al pasar a 'ready'
        packed: false,
      };

      // Guardar/Actualizar cliente
      setCustomers((prev) => {
        const idx = prev.findIndex(
          (c) =>
            (c.phone || "").replace(/\s|-/g, "") ===
            (newOrder.phone || "").replace(/\s|-/g, "")
        );
        const record = {
          name: newOrder.name,
          phone: newOrder.phone,
          street: customerData.street,
          number: customerData.number,
          sector: customerData.sector,
          city: customerData.city,
          references: customerData.references,
          coordinates: coords,
        };
        if (idx >= 0) {
          const cp = prev.slice();
          cp[idx] = { ...cp[idx], ...record };
          return cp;
        }
        return [...prev, record];
      });

      setOrders((prev) => [...prev, newOrder]);
      setCart([]);
      setCustomerData({
        name: "",
        phone: "",
        street: "",
        number: "",
        sector: "",
        city: "Puerto Montt",
        references: "",
        paymentMethod: "debito",
        paymentStatus: "paid",
        dueMethod: "efectivo",
      });
      setGeocodedCoords(null);
      setSelectedCoords(null);
      setErrors({});
      alert(
        `✅ Pedido creado para ${newOrder.name}.\n🕐 Estimado cocina: ${newOrder.estimatedTime} min`
      );
      setActiveTab("promotions");
    } catch {
      setErrors({ submit: "Ocurrió un problema al crear el pedido." });
    } finally {
      setIsLoading(false);
    }
  };

  /* ===================== Cambiar estado ===================== */
  const updateOrderStatus = (orderId, newStatus) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        if (newStatus === "ready" && !o.packUntil) {
          return {
            ...o,
            status: "ready",
            packUntil: Date.now() + 90_000,
            packed: false,
          };
        }
        return { ...o, status: newStatus };
      })
    );
  };

  // Confirmación de pago en delivery
  const confirmPayment = (orderId) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, paymentStatus: "paid", paidAt: new Date().toISOString() }
          : o
      )
    );
  };

  // Auto marcar packed cuando termina 1:30
  useEffect(() => {
    const id = setInterval(() => {
      setOrders((prev) =>
        prev.map((o) => {
          if (
            o.status === "ready" &&
            o.packUntil &&
            !o.packed &&
            Date.now() >= o.packUntil
          ) {
            return { ...o, packed: true };
          }
          return o;
        })
      );
    }, 1000);
    return () => clearInterval(id);
  }, []);

  /* ===================== Helpers UI ===================== */
  const getFilteredOrders = () => {
    switch (userRole) {
      case "cook":
        return orders.filter((o) =>
          ["pending", "cooking", "ready"].includes(o.status)
        );
      case "delivery":
        return orders.filter((o) => ["ready", "delivered"].includes(o.status));
      default:
        return orders;
    }
  };
  const getRoleTitle = () =>
    ({
      cashier: "🏪 Panel de Cajero/Vendedor",
      cook: "👨‍🍳 Panel de Cocinero",
      delivery: "🛵 Panel de Delivery",
    }[userRole] || "Panel");

  /* ===================== Dashboard data ===================== */
  const dashboard = useMemo(() => {
    const total = orders.reduce((s, o) => s + o.total, 0);
    const byStatus = orders.reduce((m, o) => {
      m[o.status] = (m[o.status] || 0) + 1;
      return m;
    }, {});
    const due = orders.filter((o) => o.paymentStatus === "due").length;
    const delivered = orders.filter((o) => o.status === "delivered");
    const topClients = Object.values(
      orders.reduce((m, o) => {
        const k = o.phone || o.name;
        m[k] = m[k] || { name: o.name, phone: o.phone, total: 0, count: 0 };
        m[k].total += o.total;
        m[k].count++;
        return m;
      }, {})
    )
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    return {
      total,
      byStatus,
      due,
      deliveredCount: delivered.length,
      topClients,
    };
  }, [orders]);

  /* ===================== Render ===================== */
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🍣 Sushi Delivery Puerto Montt
          </h1>
          <p className="text-gray-600">
            Sistema de gestión con roles, geocodificación exacta y pagos
          </p>
          <div className="mt-2 text-sm text-blue-600 bg-blue-50 rounded-full px-4 py-2 inline-block">
            📍 Origen: <b>{ORIGIN.name}</b>
          </div>
        </div>

        {/* Selector de rol + Dashboard */}
        <div className="mb-4 bg-white rounded-lg shadow-lg p-4 flex flex-wrap items-center gap-2 justify-center">
          <button
            onClick={() => {
              setUserRole("cashier");
              setShowDashboard(false);
              setActiveTab("promotions");
            }}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              userRole === "cashier" && !showDashboard
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            🏪 Cajero
          </button>
          <button
            onClick={() => {
              setUserRole("cook");
              setShowDashboard(false);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              userRole === "cook" && !showDashboard
                ? "bg-orange-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            👨‍🍳 Cocina
          </button>
          <button
            onClick={() => {
              setUserRole("delivery");
              setShowDashboard(false);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              userRole === "delivery" && !showDashboard
                ? "bg-green-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            🛵 Delivery
          </button>
          <span className="mx-2">|</span>
          <button
            onClick={() => setShowDashboard(true)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              showDashboard
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            📊 Dashboard
          </button>
        </div>

        {/* Título */}
        {!showDashboard && (
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              {getRoleTitle()}
            </h2>
          </div>
        )}

        {/* ===================== DASHBOARD ===================== */}
        {showDashboard && (
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg p-4 shadow border">
                <p className="text-sm text-gray-500">Ventas totales</p>
                <p className="text-2xl font-bold text-emerald-600">
                  ${formatCLP(dashboard.total)}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow border">
                <p className="text-sm text-gray-500">Pendientes</p>
                <p className="text-2xl font-bold text-gray-800">
                  {dashboard.byStatus.pending || 0}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow border">
                <p className="text-sm text-gray-500">Listos/Delivery</p>
                <p className="text-2xl font-bold text-gray-800">
                  {dashboard.byStatus.ready || 0}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow border">
                <p className="text-sm text-gray-500">Por cobrar</p>
                <p className="text-2xl font-bold text-red-600">
                  {dashboard.due}
                </p>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow border">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Top clientes
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600">
                      <th className="py-2">Cliente</th>
                      <th className="py-2">Teléfono</th>
                      <th className="py-2">Pedidos</th>
                      <th className="py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.topClients.map((c, i) => (
                      <tr key={i} className="border-t">
                        <td className="py-2">{c.name}</td>
                        <td className="py-2">{c.phone}</td>
                        <td className="py-2">{c.count}</td>
                        <td className="py-2 font-semibold">
                          ${formatCLP(c.total)}
                        </td>
                      </tr>
                    ))}
                    {dashboard.topClients.length === 0 && (
                      <tr>
                        <td className="py-3 text-gray-500" colSpan={4}>
                          Sin datos aún
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================== CAJERO – Tabs ===================== */}
        {!showDashboard && userRole === "cashier" && (
          <div className="mb-6">
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={() => setActiveTab("promotions")}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  activeTab === "promotions"
                    ? "bg-red-500 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                }`}
              >
                🍣 Promociones
              </button>
              <button
                onClick={() => setActiveTab("customer")}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  activeTab === "customer"
                    ? "bg-red-500 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                }`}
              >
                👤 Datos del Cliente
              </button>
              {cart.length > 0 && (
                <button
                  onClick={() => setActiveTab("cart")}
                  className={`px-4 py-2 rounded-lg font-medium transition relative ${
                    activeTab === "cart"
                      ? "bg-green-500 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-100"
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

        {/* ===================== CAJERO – Promociones ===================== */}
        {!showDashboard &&
          userRole === "cashier" &&
          activeTab === "promotions" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {promotions.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
                >
                  {p.popular && (
                    <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-center py-1">
                      <span className="text-sm font-semibold flex items-center justify-center gap-1">
                        <Star size={14} fill="white" /> MÁS POPULAR
                      </span>
                    </div>
                  )}
                  <div className="p-6">
                    <div className="text-center mb-4">
                      <span className="text-4xl">{p.image}</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                      {p.name}
                    </h3>
                    <p className="text-gray-600 text-sm mb-4">
                      {p.description}
                    </p>
                    <div className="mb-4">
                      <h4 className="font-semibold text-gray-700 mb-2">
                        Incluye:
                      </h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {p.items.map((it, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="text-green-500">✓</span>
                            {it}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-gray-400 line-through text-sm">
                          ${formatCLP(p.originalPrice)}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-red-600">
                            ${formatCLP(p.discountPrice)}
                          </span>
                          <span className="bg-red-100 text-red-600 px-2 py-1 rounded-full text-xs font-semibold">
                            -{p.discount}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mb-3 text-sm text-gray-600 flex items-center gap-1">
                      <Clock size={14} />
                      Tiempo de preparación: {p.cookingTime} min
                    </div>
                    <button
                      onClick={() => addToCart(p)}
                      className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
                    >
                      <Plus size={16} /> Agregar al Carrito
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        {/* ===================== CAJERO – Datos del Cliente ===================== */}
        {!showDashboard &&
          userRole === "cashier" &&
          activeTab === "customer" && (
            <div className="max-w-5xl mx-auto">
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
                    <User className="text-red-500" /> Datos del Cliente
                  </h2>
                  <div className="ml-auto bg-gray-100 rounded-lg p-1 flex">
                    <button
                      onClick={() => setCustomerMode("new")}
                      className={`px-3 py-1 text-sm rounded ${
                        customerMode === "new"
                          ? "bg-red-500 text-white"
                          : "text-gray-700"
                      }`}
                    >
                      Nuevo
                    </button>
                    <button
                      onClick={() => setCustomerMode("existing")}
                      className={`px-3 py-1 text-sm rounded ${
                        customerMode === "existing"
                          ? "bg-red-500 text-white"
                          : "text-gray-700"
                      }`}
                    >
                      Registrado
                    </button>
                  </div>
                </div>

                {/* EXISTING */}
                {customerMode === "existing" && (
                  <div className="mb-6 border rounded-lg p-4 bg-gray-50">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Search size={16} className="inline mr-1" /> Buscar por
                      nombre o teléfono
                    </label>
                    <input
                      type="text"
                      value={customerQuery}
                      onChange={(e) => setCustomerQuery(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent border-gray-300"
                      placeholder="Ej: Juan / +56 9 1234 5678"
                    />
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {filteredCustomers.map((c, i) => (
                        <div key={i} className="border rounded-lg p-3 bg-white">
                          <div className="flex justify-between">
                            <div>
                              <p className="font-semibold text-gray-800">
                                {c.name}
                              </p>
                              <p className="text-sm text-gray-600">{c.phone}</p>
                              <p className="text-xs text-gray-500">
                                {c.street} {c.number}
                                {c.sector ? `, ${c.sector}` : ""}
                              </p>
                            </div>
                            <button
                              onClick={() => selectCustomer(c)}
                              className="h-8 px-3 rounded bg-blue-500 hover:bg-blue-600 text-white text-sm"
                            >
                              Usar
                            </button>
                          </div>
                        </div>
                      ))}
                      {filteredCustomers.length === 0 && (
                        <p className="text-sm text-gray-500">
                          Sin resultados. Cambia el criterio o crea cliente
                          nuevo.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* NEW / FORM */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <User size={16} className="inline mr-1" /> Nombre
                    </label>
                    <input
                      type="text"
                      value={customerData.name}
                      onChange={(e) =>
                        setCustomerData((v) => ({ ...v, name: e.target.value }))
                      }
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                        errors.name ? "border-red-500" : "border-gray-300"
                      }`}
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
                      <Phone size={16} className="inline mr-1" /> Teléfono
                    </label>
                    <input
                      type="tel"
                      value={customerData.phone}
                      onChange={(e) =>
                        setCustomerData((v) => ({
                          ...v,
                          phone: e.target.value,
                        }))
                      }
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                        errors.phone ? "border-red-500" : "border-gray-300"
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
                      <Landmark size={16} className="inline mr-1" /> Calle
                    </label>
                    <input
                      type="text"
                      value={customerData.street}
                      onChange={(e) =>
                        setCustomerData((v) => ({
                          ...v,
                          street: e.target.value,
                        }))
                      }
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                        errors.street ? "border-red-500" : "border-gray-300"
                      }`}
                      placeholder="Ej: Playa Guabil"
                    />
                    {errors.street && (
                      <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle size={12} />
                        {errors.street}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Hash size={16} className="inline mr-1" /> Número
                    </label>
                    <input
                      type="text"
                      value={customerData.number}
                      onChange={(e) =>
                        setCustomerData((v) => ({
                          ...v,
                          number: e.target.value,
                        }))
                      }
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                        errors.number ? "border-red-500" : "border-gray-300"
                      }`}
                      placeholder="Ej: 6191"
                    />
                    {errors.number && (
                      <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle size={12} />
                        {errors.number}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Home size={16} className="inline mr-1" /> Población /
                      Sector (opcional)
                    </label>
                    <input
                      type="text"
                      value={customerData.sector}
                      onChange={(e) =>
                        setCustomerData((v) => ({
                          ...v,
                          sector: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent border-gray-300"
                      placeholder="Ej: Mirasol, Puerto Sur, etc."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <MapPin size={16} className="inline mr-1" /> Ciudad
                    </label>
                    <select
                      value={customerData.city}
                      onChange={(e) =>
                        setCustomerData((v) => ({ ...v, city: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 bg-white"
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
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <MessageSquare size={16} className="inline mr-1" />{" "}
                    Referencias (Opcional)
                  </label>
                  <textarea
                    value={customerData.references}
                    onChange={(e) =>
                      setCustomerData((v) => ({
                        ...v,
                        references: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    placeholder="Ej: Casa amarilla con reja negra, frente a semáforo…"
                    rows="3"
                  />
                </div>

                {/* Pago */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <CreditCard size={16} /> Método de pago
                    </label>
                    <select
                      value={customerData.paymentMethod}
                      onChange={(e) =>
                        setCustomerData((v) => ({
                          ...v,
                          paymentMethod: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 bg-white capitalize"
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option
                          key={m.value}
                          value={m.value}
                          className="capitalize"
                        >
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <DollarSign size={16} /> Estado
                    </label>
                    <select
                      value={customerData.paymentStatus}
                      onChange={(e) =>
                        setCustomerData((v) => ({
                          ...v,
                          paymentStatus: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 bg-white"
                    >
                      <option value="paid">Pagado</option>
                      <option value="due">Por pagar</option>
                    </select>
                  </div>
                  {customerData.paymentStatus === "due" && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                        <Wallet size={16} /> Medio al recibir
                      </label>
                      <select
                        value={customerData.dueMethod}
                        onChange={(e) =>
                          setCustomerData((v) => ({
                            ...v,
                            dueMethod: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 bg-white capitalize"
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Mapa + avisos de precisión */}
                {(geocodedCoords || selectedCoords) && (
                  <div className="mt-4 bg-white border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-gray-700 mb-2">
                        Ubicación exacta (mueve el pin si es necesario)
                      </h4>
                      {customerData.number &&
                        geocodedCoords &&
                        geocodedCoords.precision !== "exact" && (
                          <span className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-800 flex items-center gap-1">
                            <AlertCircle size={12} /> No se encontró la
                            numeración exacta. Ajusta el pin.
                          </span>
                        )}
                    </div>
                    <div
                      ref={addrMapRef}
                      className="h-64 w-full rounded-lg border"
                    />
                    <div className="text-xs text-gray-600 mt-2">
                      Origen: <b>{ORIGIN.name}</b>
                      {selectedCoords && (
                        <>
                          {" "}
                          — Selección:{" "}
                          <b>
                            {selectedCoords.lat.toFixed(6)},{" "}
                            {selectedCoords.lng.toFixed(6)}
                          </b>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Errores */}
                {errors.address && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-sm flex items-center gap-2">
                    <AlertCircle size={16} /> {errors.address}
                  </div>
                )}
                {errors.submit && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-center gap-2">
                    <AlertCircle size={16} /> {errors.submit}
                  </div>
                )}
                {errors.cart && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-center gap-2">
                    <AlertCircle size={16} /> {errors.cart}
                  </div>
                )}

                {/* Resumen carrito */}
                {cart.length > 0 && (
                  <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-800 mb-2">
                      Resumen del Pedido:
                    </h4>
                    <ul className="text-sm text-green-700 space-y-1">
                      {cart.map((i) => (
                        <li key={i.id}>
                          {i.quantity}x {i.name} - $
                          {formatCLP(i.discountPrice * i.quantity)}
                        </li>
                      ))}
                    </ul>
                    <div className="border-t border-green-300 mt-2 pt-2">
                      <p className="font-bold text-green-800">
                        Total: ${formatCLP(getCartTotal())}
                      </p>
                      <p className="text-sm text-green-600">
                        Tiempo estimado de cocina: {getEstimatedCookingTime()}{" "}
                        min
                      </p>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleCreateOrder}
                  disabled={isLoading}
                  className="mt-4 w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
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
          )}

        {/* ===================== CAJERO – Carrito ===================== */}
        {!showDashboard &&
          userRole === "cashier" &&
          activeTab === "cart" &&
          cart.length > 0 && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
                  <ShoppingCart className="text-green-500" /> Carrito de Compras
                </h2>
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{item.image}</span>
                          <div>
                            <h4 className="font-semibold text-gray-800">
                              {item.name}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {item.description}
                            </p>
                            <p className="text-xs text-orange-600">
                              ⏱️ {item.cookingTime} min
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() =>
                              updateQuantity(item.id, item.quantity - 1)
                            }
                            className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="font-semibold text-lg w-8 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateQuantity(item.id, item.quantity + 1)
                            }
                            className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">
                            ${formatCLP(item.discountPrice)} c/u
                          </p>
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
                    <span className="text-lg font-semibold text-gray-800">
                      Total del Pedido:
                    </span>
                    <span className="text-2xl font-bold text-red-600">
                      ${formatCLP(getCartTotal())}
                    </span>
                  </div>
                  <div className="text-center space-y-2">
                    <div className="text-sm text-gray-600 flex items-center justify-center gap-2">
                      <Clock size={16} />
                      Tiempo estimado de preparación:{" "}
                      {getEstimatedCookingTime()} min
                    </div>
                    <button
                      onClick={() => setActiveTab("customer")}
                      className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-6 rounded-lg transition"
                    >
                      Continuar con Datos del Cliente
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* ===================== COCINA – Lista (con cronómetro 1:30) ===================== */}
        {!showDashboard && userRole === "cook" && (
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
                <Package className="text-orange-500" /> Pedidos en Cocina
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {getFilteredOrders().filter((o) =>
                  ["pending", "cooking", "ready"].includes(o.status)
                ).length === 0 ? (
                  <div className="col-span-2 text-center py-8 text-gray-500">
                    <Package size={48} className="mx-auto mb-4 text-gray-300" />
                    <p>No hay pedidos en este momento</p>
                  </div>
                ) : (
                  getFilteredOrders()
                    .filter((o) =>
                      ["pending", "cooking", "ready"].includes(o.status)
                    )
                    .map((order) => {
                      const status = orderStatuses[order.status];
                      const StatusIcon = status.icon;

                      let packingText = null;
                      if (order.status === "ready" && order.packUntil) {
                        const secs = Math.max(
                          0,
                          Math.ceil((order.packUntil - Date.now()) / 1000)
                        );
                        const mm = Math.floor(secs / 60),
                          ss = secs % 60;
                        packingText =
                          secs > 0
                            ? `Empaque: ${pad(mm)}:${pad(ss)}`
                            : "Empaque finalizado";
                      }

                      return (
                        <div
                          key={order.id}
                          className="border-2 border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="text-lg font-bold text-gray-800">
                                Pedido #{order.id.toString().slice(-4)}
                              </h3>
                              <p className="text-gray-600">{order.name}</p>
                              <p className="text-sm text-gray-500">
                                {order.timestamp}
                              </p>
                            </div>
                            <div
                              className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                                statusPillClass[order.status]
                              }`}
                            >
                              <StatusIcon size={14} /> {status.label}
                            </div>
                          </div>
                          <div className="mb-4">
                            <h4 className="font-semibold text-gray-700 mb-2">
                              Pedido:
                            </h4>
                            <ul className="text-sm text-gray-600 space-y-1">
                              {order.cart.map((it, i) => (
                                <li key={i} className="flex justify-between">
                                  <span>
                                    {it.quantity}x {it.name}
                                  </span>
                                  <span className="text-orange-600">
                                    ⏱️ {it.cookingTime}min
                                  </span>
                                </li>
                              ))}
                            </ul>
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <p className="text-sm text-orange-600 font-medium">
                                ⏱️ Máximo estimado: {order.estimatedTime} min
                              </p>
                              {packingText && (
                                <p
                                  className={`text-sm font-semibold mt-1 ${
                                    packingText.includes("finalizado")
                                      ? "text-green-600"
                                      : "text-amber-700"
                                  }`}
                                >
                                  {packingText}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {order.status === "pending" && (
                              <button
                                onClick={() =>
                                  updateOrderStatus(order.id, "cooking")
                                }
                                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
                              >
                                <Package size={16} /> Comenzar a Cocinar
                              </button>
                            )}
                            {order.status === "cooking" && (
                              <button
                                onClick={() =>
                                  updateOrderStatus(order.id, "ready")
                                }
                                className="flex-1 bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
                              >
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

        {/* ===================== DELIVERY – Activos vs Finalizados ===================== */}
        {!showDashboard && userRole === "delivery" && (
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Activos */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
                <Package className="text-green-500" /> Pedidos para Delivery
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {getFilteredOrders().filter((o) => o.status === "ready")
                  .length === 0 ? (
                  <div className="col-span-2 text-center py-8 text-gray-500">
                    <Package size={48} className="mx-auto mb-4 text-gray-300" />
                    <p>No hay pedidos listos para entregar</p>
                  </div>
                ) : (
                  getFilteredOrders()
                    .filter((o) => o.status === "ready")
                    .map((order) => (
                      <DeliveryOrderCard
                        key={order.id}
                        order={order}
                        orderStatuses={orderStatuses}
                        statusPillClass={statusPillClass}
                        onConfirmPayment={() => confirmPayment(order.id)}
                        onDelivered={() =>
                          updateOrderStatus(order.id, "delivered")
                        }
                      />
                    ))
                )}
              </div>
            </div>

            {/* Finalizados */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <CheckCircle className="text-blue-500" /> Pedidos Finalizados
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {getFilteredOrders().filter((o) => o.status === "delivered")
                  .length === 0 ? (
                  <p className="text-gray-500">
                    Aún no hay pedidos finalizados.
                  </p>
                ) : (
                  getFilteredOrders()
                    .filter((o) => o.status === "delivered")
                    .map((order) => (
                      <div key={order.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-800">
                              #{order.id.toString().slice(-4)} — {order.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {order.address}
                            </p>
                          </div>
                          <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
                            Entregado
                          </span>
                        </div>
                        <div className="mt-2 text-sm">
                          <span className="text-gray-700">Pago: </span>
                          <span className="font-medium">
                            {order.paymentStatus === "paid"
                              ? "Pagado"
                              : "Por pagar"}
                          </span>
                          {order.paymentStatus === "paid" && order.paidAt && (
                            <span className="ml-2 text-xs text-gray-500">
                              ({new Date(order.paidAt).toLocaleString("es-CL")})
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================== Historial (para cajero) ===================== */}
        {!showDashboard && userRole === "cashier" && orders.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <CheckCircle className="text-blue-500" /> Historial de Pedidos (
              {orders.length})
            </h3>
            <div className="space-y-4">
              {orders
                .slice()
                .reverse()
                .map((order) => {
                  const status = orderStatuses[order.status];
                  const StatusIcon = status.icon;
                  return (
                    <div
                      key={order.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                        <div>
                          <h4 className="font-semibold text-gray-800 mb-1">
                            Cliente
                          </h4>
                          <p className="text-sm">{order.name}</p>
                          <p className="text-xs text-gray-500">{order.phone}</p>
                          <p className="text-xs text-gray-500">
                            #{order.id.toString().slice(-4)}
                          </p>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-800 mb-1">
                            Dirección
                          </h4>
                          <p className="text-sm">{order.address}</p>
                          <p className="text-xs text-gray-500">{order.city}</p>
                          {order.geocodePrecision &&
                            order.geocodePrecision !== "exact" && (
                              <p className="text-xs text-amber-700 mt-1">
                                Punto aprox. ({order.geocodePrecision})
                              </p>
                            )}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-800 mb-1">
                            Pedido
                          </h4>
                          <ul className="text-xs text-gray-600">
                            {order.cart.map((it, i) => (
                              <li key={i}>
                                {it.quantity}x {it.name}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <div
                            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                              statusPillClass[order.status]
                            } mb-2`}
                          >
                            <StatusIcon size={12} /> {status.label}
                          </div>
                          <p className="font-bold text-red-600 text-sm">
                            ${formatCLP(order.total)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {order.timestamp}
                          </p>
                          <div className="mt-1 text-xs">
                            <span
                              className={`px-2 py-0.5 rounded ${
                                order.paymentStatus === "paid"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {order.paymentStatus === "paid"
                                ? "Pagado"
                                : "Por pagar"}
                            </span>
                          </div>
                        </div>
                        <div className="text-center">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(
                              order.wazeUrl ||
                                wazeUrl(
                                  order.coordinates?.lat ?? 0,
                                  order.coordinates?.lng ?? 0
                                )
                            )}`}
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
