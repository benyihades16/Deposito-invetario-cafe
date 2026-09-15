import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, set, push, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAivVsjrsxrvzaqANN9FMBNRNVX4puHo3c",
  authDomain: "control-deposito26.firebaseapp.com",
  databaseURL: "https://control-deposito26-default-rtdb.firebaseio.com",
  projectId: "control-deposito26",
  storageBucket: "control-deposito26.firebasestorage.app",
  messagingSenderId: "519063082916",
  appId: "1:519063082916:web:1ee0b77a08dea6a1e7d331",
  measurementId: "G-XM7N3YRZJ3"
};

const ADMIN_PIN = "1234";
const GRAMOS_POR_CAFE = 18; // 18g por cada bebida de café estándar

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const inventoryRef = ref(db, 'inventario');
const historyRef = ref(db, 'historial');

let inventario = [];
let historialMovimientos = [];
let listaBarraActual = [];
let listaTraspasoActual = [];
let listaIngresoActual = [];
let listaBajaActual = [];

// Helper para formato de fecha único y estándar (DD/MM/YYYY)
function getFechaHoy() {
  const d = new Date();
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = d.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

// FUNCIÓN DE ORDENAMIENTO: Leches primero, luego A-Z
function ordenarInventario(lista) {
  return [...lista].sort((a, b) => {
    const aEsLeche = a.nombre.toLowerCase().includes('leche');
    const bEsLeche = b.nombre.toLowerCase().includes('leche');

    if (aEsLeche && !bEsLeche) return -1;
    if (!aEsLeche && bEsLeche) return 1;

    return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
  });
}

// Escuchar cambios de inventario en vivo
onValue(inventoryRef, (snapshot) => {
  const data = snapshot.val();
  if (data) {
    const rawList = Array.isArray(data) ? data : Object.values(data);
    inventario = rawList.map(item => ({
      id: item.id || Date.now(),
      nombre: item.nombre || 'Insumo',
      tipo: item.tipo || 'producto',
      stockDeposito: item.stockDeposito !== undefined ? item.stockDeposito : (item.stock || 0),
      stockCafeteria: item.stockCafeteria !== undefined ? item.stockCafeteria : 0
    }));
  } else {
    inventario = [];
  }
  renderTodo();
});

// Escuchar cambios de historial en vivo
onValue(historyRef, (snapshot) => {
  const data = snapshot.val();
  if (data) {
    historialMovimientos = Object.keys(data).map(key => ({
      _firebaseKey: key,
      ...data[key]
    })).sort((a, b) => b.id - a.id);
  } else {
    historialMovimientos = [];
  }
  renderTodo();
});

// --- GESTIÓN DE PERFILES Y SESIÓN ---

function verificarSesion() {
  const usuarioLogueado = sessionStorage.getItem('usuarioLogueado');
  if (!usuarioLogueado) {
    mostrarPantallaPerfiles();
  } else {
    removerPantallaPerfiles();
    actualizarBadgeUsuario(usuarioLogueado);
    aplicarPermisosPerfil(usuarioLogueado);
  }
}

function aplicarPermisosPerfil(nombreUsuario) {
  const tabNuevoProd = document.getElementById('tab-nuevo_prod');
  const thAdminAcciones = document.querySelectorAll('.thAdminAcciones');

  if (tabNuevoProd) {
    const labelTab = document.querySelector('label[for="tab-nuevo_prod"]');
    if (labelTab) labelTab.style.display = (nombreUsuario === 'Administrador') ? '' : 'none';

    if (nombreUsuario !== 'Administrador' && tabNuevoProd.checked) {
      irASeccion('tab-stock');
    }
  }

  thAdminAcciones.forEach(el => {
    if (nombreUsuario === 'Administrador') el.classList.remove('hidden');
    else el.classList.add('hidden');
  });

  renderPanelMantenimiento(nombreUsuario);
}

function mostrarPantallaPerfiles() {
  if (document.getElementById('pantallaPerfiles')) return;

  const modal = document.createElement('div');
  modal.id = 'pantallaPerfiles';
  modal.className = 'fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-6 text-white';
  modal.innerHTML = `
    <div class="max-w-md w-full text-center space-y-6">
      <div class="space-y-2">
        <h1 class="text-3xl font-extrabold tracking-tight text-slate-100">Control de Depósito</h1>
        <p class="text-sm text-slate-400">¿Quién va a usar el sistema hoy?</p>
      </div>

      <div class="grid grid-cols-2 gap-4 pt-2">
        <button onclick="seleccionarPerfil('Administrador', true)" class="group flex flex-col items-center p-4 bg-slate-900 border-2 border-slate-800 hover:border-amber-500 rounded-2xl transition transform hover:scale-105 shadow-lg">
          <div class="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center text-3xl mb-2 group-hover:bg-amber-500/20 transition">👑</div>
          <span class="font-bold text-sm text-slate-200">Administrador</span>
          <span class="text-[10px] text-amber-400 font-semibold mt-1 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800/50">🔒 Pide PIN</span>
        </button>

        <button onclick="seleccionarPerfil('Usuario 1', false)" class="group flex flex-col items-center p-4 bg-slate-900 border-2 border-slate-800 hover:border-sky-500 rounded-2xl transition transform hover:scale-105 shadow-lg">
          <div class="w-16 h-16 bg-sky-500/10 border border-sky-500/30 rounded-full flex items-center justify-center text-3xl mb-2 group-hover:bg-sky-500/20 transition">👷‍♂️</div>
          <span class="font-bold text-sm text-slate-200">Usuario 1</span>
          <span class="text-[10px] text-sky-400 font-semibold mt-1 bg-sky-950/60 px-2 py-0.5 rounded-full border border-sky-800/50">Acceso Libre</span>
        </button>

        <button onclick="seleccionarPerfil('Usuario 2', false)" class="group flex flex-col items-center p-4 bg-slate-900 border-2 border-slate-800 hover:border-emerald-500 rounded-2xl transition transform hover:scale-105 shadow-lg">
          <div class="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center text-3xl mb-2 group-hover:bg-emerald-500/20 transition">👷‍♀️</div>
          <span class="font-bold text-sm text-slate-200">Usuario 2</span>
          <span class="text-[10px] text-emerald-400 font-semibold mt-1 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/50">Acceso Libre</span>
        </button>

        <button onclick="seleccionarPerfil('Usuario 3', false)" class="group flex flex-col items-center p-4 bg-slate-900 border-2 border-slate-800 hover:border-purple-500 rounded-2xl transition transform hover:scale-105 shadow-lg">
          <div class="w-16 h-16 bg-purple-500/10 border border-purple-500/30 rounded-full flex items-center justify-center text-3xl mb-2 group-hover:bg-purple-500/20 transition">🧑‍🔧</div>
          <span class="font-bold text-sm text-slate-200">Usuario 3</span>
          <span class="text-[10px] text-purple-400 font-semibold mt-1 bg-purple-950/60 px-2 py-0.5 rounded-full border border-purple-800/50">Acceso Libre</span>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

window.seleccionarPerfil = function(nombreUsuario, requierePin) {
  if (requierePin) {
    mostrarModalPin();
    return;
  }
  iniciarSesionUsuario(nombreUsuario);
};

function mostrarModalPin() {
  if (document.getElementById('modalPinAdmin')) return;

  const modalPin = document.createElement('div');
  modalPin.id = 'modalPinAdmin';
  modalPin.className = 'fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4';
  modalPin.innerHTML = `
    <div class="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-xs w-full text-center space-y-4 shadow-2xl">
      <div class="w-12 h-12 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center text-2xl mx-auto">👑</div>
      <div>
        <h3 class="text-base font-bold text-slate-100">Acceso Administrador</h3>
        <p class="text-xs text-slate-400 mt-1">Ingresa el PIN de seguridad</p>
      </div>

      <div class="relative">
        <input type="password" id="inputPinAdmin" autofocus class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-center text-xl font-mono tracking-widest text-amber-400 focus:outline-none focus:border-amber-500" placeholder="••••" maxlength="10">
        <button type="button" onclick="toggleVisibilidadPin()" class="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 text-sm">👁️</button>
      </div>

      <p id="msgErrorPin" class="text-xs text-rose-400 font-semibold hidden">❌ PIN incorrecto</p>

      <div class="flex gap-2 pt-2">
        <button onclick="cerrarModalPin()" class="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded-xl text-xs transition">Cancelar</button>
        <button onclick="validarPinAdmin()" class="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2 rounded-xl text-xs transition shadow-md">Ingresar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modalPin);

  const inputPin = document.getElementById('inputPinAdmin');
  if (inputPin) {
    inputPin.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') validarPinAdmin();
    });
  }
}

window.toggleVisibilidadPin = function() {
  const inputPin = document.getElementById('inputPinAdmin');
  if (inputPin) {
    inputPin.type = inputPin.type === 'password' ? 'text' : 'password';
  }
};

window.cerrarModalPin = function() {
  const modalPin = document.getElementById('modalPinAdmin');
  if (modalPin) modalPin.remove();
};

window.validarPinAdmin = function() {
  const inputPin = document.getElementById('inputPinAdmin');
  const msgError = document.getElementById('msgErrorPin');
  if (!inputPin) return;

  if (inputPin.value === ADMIN_PIN) {
    cerrarModalPin();
    iniciarSesionUsuario('Administrador');
  } else {
    if (msgError) msgError.classList.remove('hidden');
    inputPin.value = '';
    inputPin.focus();
  }
};

function iniciarSesionUsuario(nombreUsuario) {
  sessionStorage.setItem('usuarioLogueado', nombreUsuario);
  removerPantallaPerfiles();
  actualizarBadgeUsuario(nombreUsuario);
  aplicarPermisosPerfil(nombreUsuario);
  renderTodo();
}

function removerPantallaPerfiles() {
  const modal = document.getElementById('pantallaPerfiles');
  if (modal) modal.remove();
}

function actualizarBadgeUsuario(nombre) {
  const container = document.getElementById('usuarioHeaderBadge');
  if (!container) return;

  container.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="text-[11px] font-bold text-slate-200 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
        👤 ${nombre}
      </span>
      <button onclick="cerrarSesion()" title="Cerrar sesión" class="text-xs bg-rose-600/80 hover:bg-rose-600 text-white font-bold p-1 rounded-lg transition">
        🚪
      </button>
    </div>
  `;
}

window.cerrarSesion = function() {
  if (confirm("¿Deseas cerrar la sesión activa?")) {
    sessionStorage.removeItem('usuarioLogueado');
    listaBarraActual = [];
    listaTraspasoActual = [];
    listaIngresoActual = [];
    listaBajaActual = [];
    mostrarPantallaPerfiles();
  }
};

function irASeccion(tabId) {
  const radio = document.getElementById(tabId);
  if (radio) {
    radio.checked = true;
    radio.dispatchEvent(new Event('change'));
  }
}

// --- ACCIONES DE PRODUCTOS Y STOCK ---

function guardarProductoNuevo() {
  if (sessionStorage.getItem('usuarioLogueado') !== 'Administrador') return;

  const nombreInput = document.getElementById('prodNombre');
  const tipoInput = document.getElementById('prodTipo');
  const stockDepInput = document.getElementById('prodStockDep');
  const stockCafInput = document.getElementById('prodStockCaf');

  const nombre = nombreInput.value.trim();
  const tipo = tipoInput ? tipoInput.value : 'producto';
  const stockDep = parseInt(stockDepInput.value) || 0;
  const stockCaf = parseInt(stockCafInput.value) || 0;

  if (!nombre) {
    alert("Ingresa el nombre del ítem.");
    return;
  }

  const nuevoProd = {
    id: Date.now(),
    nombre: nombre,
    tipo: tipo,
    stockDeposito: stockDep,
    stockCafeteria: tipo === 'insumo' ? 0 : stockCaf
  };

  inventario.push(nuevoProd);
  set(inventoryRef, inventario);

  nombreInput.value = '';
  if (tipoInput) tipoInput.value = 'producto';
  stockDepInput.value = 0;
  stockCafInput.value = 0;

  alert(`✅ "${nombre}" agregado correctamente.`);
  irASeccion(tipo === 'insumo' ? 'tab-insumos' : 'tab-stock');
}

window.eliminarProducto = function(id, nombre) {
  if (sessionStorage.getItem('usuarioLogueado') !== 'Administrador') return;

  if (confirm(`🗑️ ¿Eliminar permanentemente "${nombre}" del inventario?`)) {
    inventario = inventario.filter(p => p.id !== id);
    set(inventoryRef, inventario);
  }
};

// --- OPERACIONES DE TURNO Y REGISTRO EN HISTORIAL ---

function registrarMovimientoEnTurno(tipo, itemsNuevos, origen) {
  const usuario = sessionStorage.getItem('usuarioLogueado') || 'Usuario';
  const ahora = new Date();
  const fechaCorta = getFechaHoy();
  const horaStr = ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const regExistente = historialMovimientos.find(m => 
    m.fechaCorta === fechaCorta && 
    m.usuario === usuario && 
    m.tipo === tipo
  );

  if (regExistente) {
    const itemsActuales = [...regExistente.items];

    itemsNuevos.forEach(nuevo => {
      const index = itemsActuales.findIndex(it => it.nombre === nuevo.nombre);
      if (index >= 0) {
        itemsActuales[index].cantidad += nuevo.cantidad;
        itemsActuales[index].hora = horaStr;
      } else {
        itemsActuales.push({ nombre: nuevo.nombre, cantidad: nuevo.cantidad, hora: horaStr });
      }
    });

    const regActualizado = {
      id: regExistente.id,
      tipo: tipo,
      usuario: usuario,
      fechaCorta: fechaCorta,
      fecha: `${fechaCorta} (Último: ${horaStr})`,
      origen: origen || 'General',
      items: itemsActuales
    };

    set(ref(db, `historial/${regExistente._firebaseKey}`), regActualizado);
  } else {
    const nuevoRegistro = {
      id: Date.now(),
      tipo: tipo,
      usuario: usuario,
      fechaCorta: fechaCorta,
      fecha: `${fechaCorta} - ${horaStr}`,
      origen: origen || 'General',
      items: itemsNuevos.map(it => ({ ...it, hora: horaStr }))
    };

    push(historyRef, nuevoRegistro);
  }
}

// --- TRASPASOS MÚLTIPLES ---
function agregarATraspaso() {
  const select = document.getElementById('selectProductoTraspaso');
  const cantInput = document.getElementById('cantTraspaso');

  const idProd = parseInt(select.value);
  const cantidad = parseInt(cantInput.value) || 1;

  if (!idProd || cantidad <= 0) return;

  const prod = inventario.find(p => p.id === idProd);
  if (!prod) return;

  const existenteEnLista = listaTraspasoActual.find(it => it.id === idProd);
  const cantidadYaAgregada = existenteEnLista ? existenteEnLista.cantidad : 0;

  if ((cantidadYaAgregada + cantidad) > prod.stockDeposito) {
    alert(`Stock insuficiente en Depósito de "${prod.nombre}". Solo quedan ${prod.stockDeposito} unids.`);
    return;
  }

  if (existenteEnLista) {
    existenteEnLista.cantidad += cantidad;
  } else {
    listaTraspasoActual.push({ id: prod.id, nombre: prod.nombre, cantidad: cantidad });
  }

  cantInput.value = 1;
  renderListaTraspaso();
}

window.quitarDeTraspaso = function(idx) {
  listaTraspasoActual.splice(idx, 1);
  renderListaTraspaso();
};

function confirmarTraspasoMultiple() {
  if (listaTraspasoActual.length === 0) return;

  for (let item of listaTraspasoActual) {
    const prod = inventario.find(p => p.id === item.id);
    if (!prod || prod.stockDeposito < item.cantidad) {
      alert(`Stock insuficiente para "${item.nombre}". Verifique el depósito.`);
      return;
    }
  }

  listaTraspasoActual.forEach(itemTraspaso => {
    const prod = inventario.find(p => p.id === itemTraspaso.id);
    if (prod) {
      prod.stockDeposito = Math.max(0, prod.stockDeposito - itemTraspaso.cantidad);
      if (prod.tipo !== 'insumo') {
        prod.stockCafeteria += itemTraspaso.cantidad;
      }
    }
  });

  set(inventoryRef, inventario);
  registrarMovimientoEnTurno('TRASPASO', listaTraspasoActual, 'Depósito ➔ Cafetería');

  listaTraspasoActual = [];
  alert(`✅ Traspaso múltiple registrado correctamente.`);
  irASeccion('tab-stock');
}

// --- INGRESO DE MERCADERÍA MÚLTIPLE ---
function agregarAIngreso() {
  const selectDestino = document.getElementById('selectDestinoIngreso');
  const selectProd = document.getElementById('selectProductoIngreso');
  const cantInput = document.getElementById('cantIngreso');

  const idProd = parseInt(selectProd.value);
  const cantidad = parseInt(cantInput.value) || 0;
  const destino = selectDestino.value;

  if (!idProd || cantidad <= 0) return;

  const prod = inventario.find(p => p.id === idProd);
  if (!prod) return;

  const existente = listaIngresoActual.find(it => it.id === idProd && it.destino === destino);
  if (existente) {
    existente.cantidad += cantidad;
  } else {
    listaIngresoActual.push({
      id: prod.id,
      nombre: prod.nombre,
      cantidad: cantidad,
      destino: destino,
      origenTexto: destino === 'deposito' ? 'Ingreso Depósito' : 'Ingreso Cafetería'
    });
  }

  cantInput.value = 1;
  renderListaIngreso();
}

window.quitarDeIngreso = function(idx) {
  listaIngresoActual.splice(idx, 1);
  renderListaIngreso();
};

function confirmarIngresoStockMultiple() {
  if (listaIngresoActual.length === 0) return;

  listaIngresoActual.forEach(item => {
    const prod = inventario.find(p => p.id === item.id);
    if (prod) {
      if (item.destino === 'deposito') prod.stockDeposito += item.cantidad;
      else prod.stockCafeteria += item.cantidad;
    }
  });

  set(inventoryRef, inventario);

  const grupos = {};
  listaIngresoActual.forEach(it => {
    if (!grupos[it.origenTexto]) grupos[it.origenTexto] = [];
    grupos[it.origenTexto].push({ nombre: it.nombre, cantidad: it.cantidad });
  });

  Object.keys(grupos).forEach(origen => {
    registrarMovimientoEnTurno('INGRESO', grupos[origen], origen);
  });

  listaIngresoActual = [];
  alert(`✅ Ingresos múltiples guardados correctamente.`);
  renderListaIngreso();
  irASeccion('tab-stock');
}

// --- BAJAS, VENCIMIENTOS Y CORTESÍAS ---
function agregarABaja() {
  const selectUbicacion = document.getElementById('selectUbicacionBaja');
  const selectProd = document.getElementById('selectProductoBaja');
  const cantInput = document.getElementById('cantBaja');
  const motivoInput = document.getElementById('selectMotivoBaja');

  const idProd = parseInt(selectProd.value);
  const cantidad = parseInt(cantInput.value) || 0;
  const ubicacion = selectUbicacion.value;
  const motivo = motivoInput.value;

  if (!idProd || cantidad <= 0) return;

  const prod = inventario.find(p => p.id === idProd);
  if (!prod) return;

  const stockDisponible = ubicacion === 'cafeteria' ? prod.stockCafeteria : prod.stockDeposito;
  if (cantidad > stockDisponible) {
    alert(`Stock insuficiente en ${ubicacion === 'cafeteria' ? 'Cafetería' : 'Depósito'}. Stock actual: ${stockDisponible}`);
    return;
  }

  const existente = listaBajaActual.find(it => it.id === idProd && it.ubicacion === ubicacion && it.motivo === motivo);
  if (existente) {
    existente.cantidad += cantidad;
  } else {
    listaBajaActual.push({
      id: prod.id,
      nombre: prod.nombre,
      cantidad: cantidad,
      ubicacion: ubicacion,
      motivo: motivo,
      origenTexto: `Baja/Cortesía (${motivo} - ${ubicacion === 'cafeteria' ? 'Cafetería' : 'Depósito'})`
    });
  }

  cantInput.value = 1;
  renderListaBaja();
}

window.quitarDeBaja = function(idx) {
  listaBajaActual.splice(idx, 1);
  renderListaBaja();
};

function confirmarBajasMultiple() {
  if (listaBajaActual.length === 0) return;

  listaBajaActual.forEach(item => {
    const prod = inventario.find(p => p.id === item.id);
    if (prod) {
      if (item.ubicacion === 'cafeteria') {
        prod.stockCafeteria = Math.max(0, prod.stockCafeteria - item.cantidad);
      } else {
        prod.stockDeposito = Math.max(0, prod.stockDeposito - item.cantidad);
      }
    }
  });

  set(inventoryRef, inventario);

  const grupos = {};
  listaBajaActual.forEach(it => {
    if (!grupos[it.origenTexto]) grupos[it.origenTexto] = [];
    grupos[it.origenTexto].push({ nombre: it.nombre, cantidad: it.cantidad });
  });

  Object.keys(grupos).forEach(origen => {
    registrarMovimientoEnTurno('BAJA_CORTESIA', grupos[origen], origen);
  });

  listaBajaActual = [];
  alert(`✅ Salidas por baja/cortesía registradas correctamente (sin afectar caja).`);
  renderListaBaja();
  irASeccion('tab-stock');
}

// --- VENTAS & BARRA CON CÁLCULO AUTOMÁTICO DE CAFÉ ---
function agregarABarra() {
  const select = document.getElementById('selectProductoBarra');
  const cantInput = document.getElementById('cantBarra');

  const idProd = parseInt(select.value);
  const cantidad = parseInt(cantInput.value) || 1;

  if (!idProd || cantidad <= 0) return;

  const prod = inventario.find(p => p.id === idProd);
  if (!prod) return;

  const existente = listaBarraActual.find(it => it.id === idProd);
  const cantidadYaAgregada = existente ? existente.cantidad : 0;

  if ((cantidadYaAgregada + cantidad) > prod.stockCafeteria) {
    alert(`La cantidad supera el stock disponible en Cafetería (${prod.stockCafeteria}).`);
    return;
  }

  if (existente) {
    existente.cantidad += cantidad;
  } else {
    listaBarraActual.push({ id: prod.id, nombre: prod.nombre, cantidad: cantidad });
  }

  cantInput.value = 1;
  renderListaBarra();
}

window.quitarDeBarra = function(idx) {
  listaBarraActual.splice(idx, 1);
  renderListaBarra();
};

function calcularGramosCafeConsumidos() {
  let tazasCafe = 0;
  listaBarraActual.forEach(item => {
    const nombreLower = item.nombre.toLowerCase();
    if (nombreLower.includes('cafe') || nombreLower.includes('café') || nombreLower.includes('espresso') || 
        nombreLower.includes('latte') || nombreLower.includes('cappuccino') || nombreLower.includes('mocaccino') || 
        nombreLower.includes('cortado') || nombreLower.includes('americano') || nombreLower.includes('macchiato')) {
      tazasCafe += item.cantidad;
    }
  });
  return tazasCafe * GRAMOS_POR_CAFE;
}

function confirmarConsumoBarra() {
  if (listaBarraActual.length === 0) return;

  listaBarraActual.forEach(itemBarra => {
    const prod = inventario.find(p => p.id === itemBarra.id);
    if (prod) {
      prod.stockCafeteria = Math.max(0, prod.stockCafeteria - itemBarra.cantidad);
    }
  });

  const gramosTotales = calcularGramosCafeConsumidos();
  if (gramosTotales > 0) {
    const insumoCafe = inventario.find(p => p.tipo === 'insumo' && (p.nombre.toLowerCase().includes('café') || p.nombre.toLowerCase().includes('cafe') || p.nombre.toLowerCase().includes('grano')));
    if (insumoCafe) {
      insumoCafe.stockDeposito = Math.max(0, insumoCafe.stockDeposito - gramosTotales);
    }
  }

  set(inventoryRef, inventario);
  registrarMovimientoEnTurno('VENTA_BARRA', listaBarraActual, gramosTotales > 0 ? `Ventas Cafetería (-${gramosTotales}g de Café)` : 'Ventas Cafetería');

  listaBarraActual = [];
  renderListaBarra();
  alert(`✅ Consumo registrado correctamente.${gramosTotales > 0 ? ` Se descontaron ${gramosTotales}g de café en grano del depósito.` : ''}`);
  irASeccion('tab-stock');
}

// --- GESTIÓN DE INSOMAS (DEPÓSITO PURO) ---
window.pasarInsumo = function(idInsumo) {
  const prod = inventario.find(p => p.id === idInsumo);
  if (!prod) return;

  const cantidadStr = prompt(`¿Cuántas unidades/gramos de "${prod.nombre}" deseas pasar desde el depósito? (Stock actual: ${prod.stockDeposito})`, "1");
  if (!cantidadStr) return;
  const cantidad = parseInt(cantidadStr);

  if (isNaN(cantidad) || cantidad <= 0) {
    alert("Cantidad inválida.");
    return;
  }

  if (cantidad > prod.stockDeposito) {
    alert("No hay suficiente stock en el depósito.");
    return;
  }

  prod.stockDeposito -= cantidad;
  set(inventoryRef, inventario);
  registrarMovimientoEnTurno('TRASPASO_INSUMO', [{ nombre: prod.nombre, cantidad: cantidad }], 'Depósito Insumos');

  alert(`✅ Se pasaron ${cantidad} de "${prod.nombre}". Quedan ${prod.stockDeposito} en depósito.`);
};

// --- ANULACIÓN POR ÍTEM O TICKET COMPLETO ---

window.eliminarItemHistorial = function(key, idRegistro, nombreItem) {
  const reg = historialMovimientos.find(m => m.id === idRegistro || m._firebaseKey === key);
  if (!reg) return;

  const usuarioActual = sessionStorage.getItem('usuarioLogueado');
  const esAdmin = usuarioActual === 'Administrador';
  const esCreador = reg.usuario === usuarioActual;

  if (!esAdmin && !esCreador) {
    alert("⛔ No tienes permisos para modificar este registro.");
    return;
  }

  if (!confirm(`⚠️ ¿Deseas eliminar únicamente el producto "${nombreItem}" de este ticket?\nEl stock de este producto se reajustará automáticamente.`)) return;

  // Revertir stock del ítem específico
  const itemAfec = reg.items.find(it => it.nombre === nombreItem);
  if (itemAfec) {
    const prod = inventario.find(p => p.nombre === nombreItem);
    if (prod) {
      if (reg.tipo === 'VENTA_BARRA' || reg.tipo.includes('VENTA')) {
        prod.stockCafeteria += itemAfec.cantidad;
      } else if (reg.tipo === 'TRASPASO') {
        prod.stockDeposito += itemAfec.cantidad;
        prod.stockCafeteria = Math.max(0, prod.stockCafeteria - itemAfec.cantidad);
      } else if (reg.tipo === 'TRASPASO_INSUMO') {
        prod.stockDeposito += itemAfec.cantidad;
      } else if (reg.tipo === 'INGRESO') {
        if (reg.origen && reg.origen.includes('Cafetería')) prod.stockCafeteria = Math.max(0, prod.stockCafeteria - itemAfec.cantidad);
        else prod.stockDeposito = Math.max(0, prod.stockDeposito - itemAfec.cantidad);
      } else if (reg.tipo === 'BAJA_CORTESIA') {
        if (reg.origen && reg.origen.includes('Cafetería')) prod.stockCafeteria += itemAfec.cantidad;
        else prod.stockDeposito += itemAfec.cantidad;
      }
    }
  }

  // Filtrar el ítem fuera de la lista
  const nuevosItems = reg.items.filter(it => it.nombre !== nombreItem);

  if (nuevosItems.length === 0) {
    // Si no quedan ítems, se borra el registro completo
    remove(ref(db, `historial/${key || reg._firebaseKey}`));
  } else {
    // Actualizar registro con los ítems restantes
    const regActualizado = { ...reg, items: nuevosItems };
    delete regActualizado._firebaseKey;
    set(ref(db, `historial/${key || reg._firebaseKey}`), regActualizado);
  }

  set(inventoryRef, inventario);
  alert("✅ Ítem eliminado y stock reajustado.");
};

window.eliminarRegistroHistorial = function(key, idRegistro) {
  const reg = historialMovimientos.find(m => m.id === idRegistro || m._firebaseKey === key);
  if (!reg) return;

  const usuarioActual = sessionStorage.getItem('usuarioLogueado');
  const esAdmin = usuarioActual === 'Administrador';
  const esCreador = reg.usuario === usuarioActual;

  if (!esAdmin && !esCreador) {
    alert("⛔ No tienes permisos para anular este registro.");
    return;
  }

  if (!confirm(`⚠️ ¿Anular TODO el registro de ${reg.tipo} (Creado por: ${reg.usuario})?\nEl stock afectado se devolverá automáticamente.`)) return;

  reg.items.forEach(item => {
    const prod = inventario.find(p => p.nombre === item.nombre);
    if (prod) {
      if (reg.tipo === 'VENTA_BARRA' || reg.tipo.includes('VENTA')) {
        prod.stockCafeteria += item.cantidad;
      } else if (reg.tipo === 'TRASPASO') {
        prod.stockDeposito += item.cantidad;
        prod.stockCafeteria = Math.max(0, prod.stockCafeteria - item.cantidad);
      } else if (reg.tipo === 'TRASPASO_INSUMO') {
        prod.stockDeposito += item.cantidad;
      } else if (reg.tipo === 'INGRESO') {
        if (reg.origen && reg.origen.includes('Cafetería')) prod.stockCafeteria = Math.max(0, prod.stockCafeteria - item.cantidad);
        else prod.stockDeposito = Math.max(0, prod.stockDeposito - item.cantidad);
      } else if (reg.tipo === 'BAJA_CORTESIA') {
        if (reg.origen && reg.origen.includes('Cafetería')) prod.stockCafeteria += item.cantidad;
        else prod.stockDeposito += item.cantidad;
      }
    }
  });

  set(inventoryRef, inventario);
  remove(ref(db, `historial/${key || reg._firebaseKey}`));
  alert("✅ Registro anulado y stock reajustado.");
};

// --- MANTENIMIENTO ADMIN ---

function renderPanelMantenimiento(nombreUsuario) {
  let panel = document.getElementById('panelMantenimientoAdmin');

  if (nombreUsuario !== 'Administrador') {
    if (panel) panel.remove();
    return;
  }

  const tabContent = document.getElementById('content-nuevo_prod');
  if (!tabContent) return;

  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'panelMantenimientoAdmin';
    panel.className = 'bg-slate-900 border border-slate-800 rounded-2xl p-4 mt-4 text-white space-y-3 shadow-xl';
    tabContent.appendChild(panel);
  }

  panel.innerHTML = `
    <div class="flex items-center gap-2 border-b border-slate-800 pb-2">
      <span class="text-lg">⚙️</span>
      <h3 class="text-xs font-bold text-amber-400 uppercase tracking-wider">Mantenimiento de Datos</h3>
    </div>

    <div class="space-y-2 text-xs">
      <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col gap-2">
        <label class="font-semibold text-slate-300">Borrar Historial por Antigüedad:</label>
        <div class="flex gap-2">
          <select id="selectBorradoTiempo" class="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2 py-1 flex-1">
            <option value="todo">⚠️ BORRAR TODO EL HISTORIAL</option>
            <option value="7">Más antiguo a 7 días</option>
            <option value="30">Más antiguo a 30 días</option>
          </select>
          <button onclick="ejecutarBorradoHistorial()" class="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1 rounded-lg transition">Ejecutar</button>
        </div>
      </div>

      <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
        <span class="font-semibold text-slate-300">Reiniciar Todo el Stock a 0</span>
        <button onclick="reiniciarStockTodo()" class="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-1 rounded-lg transition">Reiniciar</button>
      </div>
    </div>
  `;
}

window.ejecutarBorradoHistorial = function() {
  const select = document.getElementById('selectBorradoTiempo');
  if (!select) return;
  const opcion = select.value;

  if (opcion === 'todo') {
    if (confirm("⚠️ ¿Confirmas borrar TODO el historial permanentemente?\nEl contador de movimientos de hoy volverá a 0.")) {
      remove(historyRef).then(() => {
        historialMovimientos = [];
        renderTodo();
        alert("✅ Historial borrado por completo.");
      }).catch(err => alert("Error: " + err.message));
    }
  } else {
    const dias = parseInt(opcion);
    const limiteMs = Date.now() - (dias * 24 * 60 * 60 * 1000);
    const filtrado = {};
    let quedoAlgo = false;

    historialMovimientos.forEach(reg => {
      const regTime = reg.id || Date.now();
      if (regTime >= limiteMs) {
        const { _firebaseKey, ...cleanReg } = reg;
        filtrado[_firebaseKey] = cleanReg;
        quedoAlgo = true;
      }
    });

    if (quedoAlgo) {
      set(historyRef, filtrado).then(() => {
        alert(`✅ Se conservaron únicamente los movimientos de los últimos ${dias} días.`);
      });
    } else {
      remove(historyRef).then(() => {
        historialMovimientos = [];
        renderTodo();
        alert("✅ Historial borrado (no quedaban registros en ese periodo).");
      });
    }
  }
};

window.reiniciarStockTodo = function() {
  if (confirm("⚠️ ¿Poner en 0 el stock de Depósito y Cafetería para todos los ítems?")) {
    inventario.forEach(p => { p.stockDeposito = 0; p.stockCafeteria = 0; });
    set(inventoryRef, inventario).then(() => {
      renderTodo();
      alert("✅ Todo el stock fue reiniciado a 0.");
    });
  }
};

// --- RENDERIZADO GENERAL Y FILTRADO ---

function renderTodo() {
  renderInventario();
  renderInsumos();
  renderSelectores();
  renderListaBarra();
  renderListaTraspaso();
  renderListaIngreso();
  renderListaBaja();
  renderCierreTurno();
  renderReporteExcel();
  renderHistorial();
}

function renderInventario() {
  const productosVisibles = inventario.filter(p => p.tipo !== 'insumo');
  const ordenados = ordenarInventario(productosVisibles);
  const esAdmin = sessionStorage.getItem('usuarioLogueado') === 'Administrador';

  const tbodyCaf = document.getElementById('tablaCafeteria');
  if (tbodyCaf) {
    tbodyCaf.innerHTML = '';
    const hoyStr = getFechaHoy();
    
    ordenados.forEach(prod => {
      let ventasHoy = 0;
      let entradasHoy = 0;

      historialMovimientos.forEach(m => {
        if (m.fechaCorta === hoyStr && m.items) {
          m.items.forEach(it => {
            if (it.nombre === prod.nombre) {
              if (m.tipo === 'VENTA_BARRA' || m.tipo.includes('VENTA')) {
                ventasHoy += it.cantidad;
              } else if (m.tipo === 'TRASPASO') {
                entradasHoy += it.cantidad;
              } else if (m.tipo === 'INGRESO' && m.origen && m.origen.includes('Cafetería')) {
                entradasHoy += it.cantidad;
              } else if (m.tipo === 'BAJA_CORTESIA' && m.origen && m.origen.includes('Cafetería')) {
                ventasHoy += it.cantidad; // Las bajas restan stock igual que ventas en vitrina
              }
            }
          });
        }
      });

      const stockActual = prod.stockCafeteria;
      const stockAnterior = Math.max(0, stockActual - entradasHoy + ventasHoy);

      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';
      tr.innerHTML = `
        <td class="py-3 px-2 font-semibold text-slate-800">${prod.nombre}</td>
        <td class="py-3 px-2 text-center text-slate-600 font-mono">${stockAnterior}</td>
        <td class="py-3 px-2 text-center text-sky-700 font-mono font-bold">${stockActual}</td>
        <td class="py-3 px-2 text-center text-emerald-600 font-mono font-bold">${ventasHoy > 0 ? `${ventasHoy}` : '0'}</td>
      `;
      tbodyCaf.appendChild(tr);
    });
  }

  const tbodyDep = document.getElementById('tablaDeposito');
  if (tbodyDep) {
    tbodyDep.innerHTML = '';
    ordenarInventario(inventario).forEach(prod => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';
      tr.innerHTML = `
        <td class="py-3 px-2 font-semibold text-slate-800">
          ${prod.nombre} 
          ${prod.tipo === 'insumo' ? '<span class="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded ml-1">Insumo</span>' : ''}
        </td>
        <td class="py-3 px-2 text-center text-slate-700 font-mono font-bold">${prod.stockDeposito}</td>
        ${esAdmin ? `
          <td class="py-3 px-2 text-center thAdminAcciones">
            <button onclick="eliminarProducto(${prod.id}, '${prod.nombre}')" class="text-rose-500 hover:text-rose-700 bg-rose-50 p-1 rounded transition">🗑️</button>
          </td>
        ` : ''}
      `;
      tbodyDep.appendChild(tr);
    });
  }

  const tbodyTot = document.getElementById('tablaTotal');
  if (tbodyTot) {
    tbodyTot.innerHTML = '';
    ordenarInventario(inventario).forEach(prod => {
      const total = prod.stockDeposito + prod.stockCafeteria;
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';
      tr.innerHTML = `
        <td class="py-3 px-2 font-semibold text-slate-800">${prod.nombre} ${prod.tipo === 'insumo' ? '<span class="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Insumo</span>' : ''}</td>
        <td class="py-3 px-2 text-center text-slate-500 font-mono">${prod.stockDeposito}</td>
        <td class="py-3 px-2 text-center text-sky-600 font-mono">${prod.stockCafeteria}</td>
        <td class="py-3 px-2 text-right font-extrabold text-slate-900 font-mono">${total}</td>
      `;
      tbodyTot.appendChild(tr);
    });
  }

  const elTotalProd = document.getElementById('statTotalProductos');
  if (elTotalProd) elTotalProd.textContent = inventario.length;

  const elTotalPases = document.getElementById('statTotalPases');
  if (elTotalPases) {
    const hoyStr = getFechaHoy();
    const movsHoy = historialMovimientos.filter(m => m.fechaCorta === hoyStr);
    elTotalPases.textContent = movsHoy.length;
  }
}

function renderInsumos() {
  const tbodyIns = document.getElementById('tablaInsumos');
  if (!tbodyIns) return;

  const insumos = ordenarInventario(inventario.filter(p => p.tipo === 'insumo'));
  const esAdmin = sessionStorage.getItem('usuarioLogueado') === 'Administrador';

  tbodyIns.innerHTML = '';
  if (insumos.length === 0) {
    tbodyIns.innerHTML = `<tr><td colspan="3" class="text-center text-slate-400 py-4 text-xs italic">No hay insumos registrados.</td></tr>`;
    return;
  }

  insumos.forEach(ins => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';
    tr.innerHTML = `
      <td class="py-3 px-3 font-semibold text-slate-800">${ins.nombre}</td>
      <td class="py-3 px-3 text-center text-slate-700 font-mono font-bold">${ins.stockDeposito}</td>
      <td class="py-3 px-3 text-right flex justify-end gap-2">
        <button onclick="pasarInsumo(${ins.id})" class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-2.5 py-1 rounded font-medium transition">🔄 Pasar</button>
        ${esAdmin ? `<button onclick="eliminarProducto(${ins.id}, '${ins.nombre}')" class="text-rose-500 hover:text-rose-700 bg-rose-50 p-1 rounded transition">🗑️</button>` : ''}
      </td>
    `;
    tbodyIns.appendChild(tr);
  });
}

function renderSelectores() {
  const selTraspaso = document.getElementById('selectProductoTraspaso');
  const selBarra = document.getElementById('selectProductoBarra');
  const selIngreso = document.getElementById('selectProductoIngreso');
  const selBaja = document.getElementById('selectProductoBaja');

  if (!selTraspaso || !selBarra || !selIngreso || !selBaja) return;

  selTraspaso.innerHTML = '';
  selBarra.innerHTML = '';
  selIngreso.innerHTML = '';
  selBaja.innerHTML = '';

  const productosVisibles = ordenarInventario(inventario.filter(p => p.tipo !== 'insumo'));
  const todosOrdenados = ordenarInventario(inventario);

  todosOrdenados.forEach(prod => {
    const optT = document.createElement('option');
    optT.value = prod.id;
    optT.textContent = `${prod.nombre} (Depósito: ${prod.stockDeposito}) ${prod.tipo === 'insumo' ? '[Insumo]' : ''}`;
    if (prod.stockDeposito <= 0) optT.disabled = true;
    selTraspaso.appendChild(optT);
  });

  productosVisibles.forEach(prod => {
    const optB = document.createElement('option');
    optB.value = prod.id;
    optB.textContent = `${prod.nombre} (Cafetería: ${prod.stockCafeteria})`;
    if (prod.stockCafeteria <= 0) optB.disabled = true;
    selBarra.appendChild(optB);
  });

  todosOrdenados.forEach(prod => {
    const optI = document.createElement('option');
    optI.value = prod.id;
    optI.textContent = `${prod.nombre} ${prod.tipo === 'insumo' ? '[Insumo]' : ''}`;
    selIngreso.appendChild(optI);
  });

  todosOrdenados.forEach(prod => {
    const optJ = document.createElement('option');
    optJ.value = prod.id;
    optJ.textContent = `${prod.nombre} (Dep: ${prod.stockDeposito} | Caf: ${prod.stockCafeteria})`;
    selBaja.appendChild(optJ);
  });
}

function renderListaBarra() {
  const lista = document.getElementById('listaBarraActual');
  const btnConf = document.getElementById('btnConfirmarBarra');
  const resCount = document.getElementById('resumenBarraCount');
  const infoCafe = document.getElementById('infoCafeDescontado');
  const spanGramos = document.getElementById('gramosCafeCalculados');

  if (!lista) return;
  lista.innerHTML = '';

  if (listaBarraActual.length === 0) {
    lista.innerHTML = `<p class="text-xs text-slate-500 italic py-2">Ningún producto agregado aún.</p>`;
    if (btnConf) btnConf.disabled = true;
    if (resCount) resCount.textContent = '0 ítems';
    if (infoCafe) infoCafe.classList.add('hidden');
    return;
  }

  if (btnConf) btnConf.disabled = false;
  let totalUnidades = 0;

  listaBarraActual.forEach((item, idx) => {
    totalUnidades += item.cantidad;
    const div = document.createElement('div');
    div.className = 'flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-xs';
    div.innerHTML = `
      <span class="text-slate-200">${item.nombre}</span>
      <div class="flex items-center gap-2">
        <span class="bg-sky-950 text-sky-300 font-bold px-2 py-0.5 rounded border border-sky-800">-${item.cantidad}</span>
        <button type="button" onclick="quitarDeBarra(${idx})" class="text-slate-500 hover:text-rose-400 font-bold px-1">✕</button>
      </div>
    `;
    lista.appendChild(div);
  });

  if (resCount) resCount.textContent = `${listaBarraActual.length} tipo(s) | Total: ${totalUnidades}`;

  const gramosCalculados = calcularGramosCafeConsumidos();
  if (gramosCalculados > 0 && infoCafe && spanGramos) {
    spanGramos.textContent = `${gramosCalculados}g`;
    infoCafe.classList.remove('hidden');
  } else if (infoCafe) {
    infoCafe.classList.add('hidden');
  }
}

function renderListaTraspaso() {
  const lista = document.getElementById('listaTraspasoActual');
  const btnConf = document.getElementById('btnConfirmarTraspaso');
  const resCount = document.getElementById('resumenTraspasoCount');

  if (!lista) return;
  lista.innerHTML = '';

  if (listaTraspasoActual.length === 0) {
    lista.innerHTML = `<p class="text-xs text-slate-500 italic py-2">Ningún producto agregado aún.</p>`;
    if (btnConf) btnConf.disabled = true;
    if (resCount) resCount.textContent = '0 ítems';
    return;
  }

  if (btnConf) btnConf.disabled = false;
  let totalUnidades = 0;

  listaTraspasoActual.forEach((item, idx) => {
    totalUnidades += item.cantidad;
    const div = document.createElement('div');
    div.className = 'flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-xs';
    div.innerHTML = `
      <span class="text-slate-200">${item.nombre}</span>
      <div class="flex items-center gap-2">
        <span class="bg-indigo-950 text-indigo-300 font-bold px-2 py-0.5 rounded border border-indigo-800">+${item.cantidad} en Vitrina</span>
        <button type="button" onclick="quitarDeTraspaso(${idx})" class="text-slate-500 hover:text-rose-400 font-bold px-1">✕</button>
      </div>
    `;
    lista.appendChild(div);
  });

  if (resCount) resCount.textContent = `${listaTraspasoActual.length} tipo(s) | Total: ${totalUnidades}`;
}

function renderListaIngreso() {
  const lista = document.getElementById('listaIngresoActual');
  const btnConf = document.getElementById('btnGuardarIngreso');
  const resCount = document.getElementById('resumenIngresoCount');

  if (!lista) return;
  lista.innerHTML = '';

  if (listaIngresoActual.length === 0) {
    lista.innerHTML = `<p class="text-xs text-slate-400 italic py-2">Ningún ítem agregado para ingreso aún.</p>`;
    if (btnConf) btnConf.disabled = true;
    if (resCount) resCount.textContent = '0 ítems';
    return;
  }

  if (btnConf) btnConf.disabled = false;
  let totalUnidades = 0;

  listaIngresoActual.forEach((item, idx) => {
    totalUnidades += item.cantidad;
    const div = document.createElement('div');
    div.className = 'flex justify-between items-center bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs';
    div.innerHTML = `
      <span class="text-slate-800 font-medium">${item.nombre} <span class="text-[10px] text-slate-500">(${item.destino})</span></span>
      <div class="flex items-center gap-2">
        <span class="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200">+${item.cantidad}</span>
        <button type="button" onclick="quitarDeIngreso(${idx})" class="text-slate-400 hover:text-rose-600 font-bold px-1">✕</button>
      </div>
    `;
    lista.appendChild(div);
  });

  if (resCount) resCount.textContent = `${listaIngresoActual.length} tipo(s) | Total: ${totalUnidades}`;
}

function renderListaBaja() {
  const lista = document.getElementById('listaBajaActual');
  const btnConf = document.getElementById('btnGuardarBajas');
  const resCount = document.getElementById('resumenBajaCount');

  if (!lista) return;
  lista.innerHTML = '';

  if (listaBajaActual.length === 0) {
    lista.innerHTML = `<p class="text-xs text-slate-400 italic py-2">Ningún ítem agregado para baja/cortesía.</p>`;
    if (btnConf) btnConf.disabled = true;
    if (resCount) resCount.textContent = '0 ítems';
    return;
  }

  if (btnConf) btnConf.disabled = false;
  let totalUnidades = 0;

  listaBajaActual.forEach((item, idx) => {
    totalUnidades += item.cantidad;
    const div = document.createElement('div');
    div.className = 'flex justify-between items-center bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs';
    div.innerHTML = `
      <span class="text-slate-800 font-medium">${item.nombre} <span class="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded border border-rose-200">${item.motivo}</span></span>
      <div class="flex items-center gap-2">
        <span class="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded border border-rose-200">-${item.cantidad} (${item.ubicacion})</span>
        <button type="button" onclick="quitarDeBaja(${idx})" class="text-slate-400 hover:text-rose-600 font-bold px-1">✕</button>
      </div>
    `;
    lista.appendChild(div);
  });

  if (resCount) resCount.textContent = `${listaBajaActual.length} tipo(s) | Total: ${totalUnidades}`;
}

// --- PLANILLA DE CIERRE DE TURNO (PARA WHATSAPP) ---
function renderCierreTurno() {
  const container = document.getElementById('tablaCierreTurno');
  if (!container) return;

  const productosVisibles = ordenarInventario(inventario.filter(p => p.tipo !== 'insumo'));
  container.innerHTML = '';

  productosVisibles.forEach(prod => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';
    tr.innerHTML = `
      <td class="py-2.5 px-2 font-medium text-slate-800">${prod.nombre}</td>
      <td class="py-2.5 px-2 text-center text-sky-700 font-mono font-bold">${prod.stockCafeteria}</td>
      <td class="py-2.5 px-2 text-center text-slate-600 font-mono">${prod.stockDeposito}</td>
    `;
    container.appendChild(tr);
  });
}

window.copiarReporteWhatsApp = function() {
  const selectTurno = document.getElementById('selectTurnoReporte');
  const turnoNombre = selectTurno ? selectTurno.value : 'Turno General';
  const fechaHoy = getFechaHoy();
  const usuario = sessionStorage.getItem('usuarioLogueado') || 'Operador';

  let texto = `📋 *CIERRE DE INVENTARIO - CAFETERÍA* 📋\n`;
  texto += `📅 Fecha: ${fechaHoy}\n`;
  texto += `⏰ Turno: ${turnoNombre}\n`;
  texto += `👤 Responsable: ${usuario}\n`;
  texto += `----------------------------------------\n`;
  texto += `*STOCK DEJADO EN VITRINA/CAFETERÍA:*\n`;

  const productosVisibles = ordenarInventario(inventario.filter(p => p.tipo !== 'insumo'));
  productosVisibles.forEach(prod => {
    texto += `• ${prod.nombre}: *${prod.stockCafeteria} unids*\n`;
  });

  texto += `----------------------------------------\n`;
  texto += `_Reporte generado automáticamente desde el Sistema de Depósito_`;

  navigator.clipboard.writeText(texto).then(() => {
    alert("✅ ¡Reporte copiado al portapapeles!\nYa puedes pegarlo directamente en el chat de WhatsApp.");
  }).catch(err => {
    alert("No se pudo copiar automáticamente: " + err);
  });
};

// --- REPORTE HISTÓRICO Y EXPORTACIÓN A EXCEL (CSV) ---
function renderReporteExcel() {
  const tbody = document.getElementById('tablaReporteExcel');
  if (!tbody) return;

  const inputDesde = document.getElementById('filtroFechaDesde');
  const inputHasta = document.getElementById('filtroFechaHasta');

  // Valores por defecto fecha de hoy
  const hoyIso = new Date().toISOString().split('T')[0];
  if (inputDesde && !inputDesde.value) inputDesde.value = hoyIso;
  if (inputHasta && !inputHasta.value) inputHasta.value = hoyIso;

  const desdeVal = inputDesde ? inputDesde.value : hoyIso;
  const hastaVal = inputHasta ? inputHasta.value : hoyIso;

  // Filtrar movimientos en el rango de fechas
  const movsFiltrados = historialMovimientos.filter(m => {
    // Convertir DD/MM/YYYY a YYYY-MM-DD para comparar
    const partes = (m.fechaCorta || '').split('/');
    if (partes.length !== 3) return false;
    const isoFecha = `${partes[2]}-${partes[1]}-${partes[0]}`;
    return isoFecha >= desdeVal && isoFecha <= hastaVal;
  });

  tbody.innerHTML = '';
  if (movsFiltrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-slate-400 py-4 text-xs italic">No hay movimientos en este rango de fechas.</td></tr>`;
    return;
  }

  movsFiltrados.forEach(reg => {
    const itemsResumen = reg.items ? reg.items.map(it => `${it.nombre} (${it.cantidad})`).join(', ') : '';
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition border-b border-slate-100 text-xs';
    tr.innerHTML = `
      <td class="py-2.5 px-3 font-mono text-slate-600">${reg.fechaCorta}</td>
      <td class="py-2.5 px-3 font-semibold text-slate-800">${reg.tipo}</td>
      <td class="py-2.5 px-3 text-slate-700">${itemsResumen}</td>
      <td class="py-2.5 px-3 text-slate-600">${reg.origen || '-'}</td>
      <td class="py-2.5 px-3 text-slate-500 font-bold">${reg.usuario}</td>
    `;
    tbody.appendChild(tr);
  });
}

window.descargarExcelMovimientos = function() {
  const inputDesde = document.getElementById('filtroFechaDesde');
  const inputHasta = document.getElementById('filtroFechaHasta');
  const desdeVal = inputDesde ? inputDesde.value : '';
  const hastaVal = inputHasta ? inputHasta.value : '';

  const movsFiltrados = historialMovimientos.filter(m => {
    const partes = (m.fechaCorta || '').split('/');
    if (partes.length !== 3) return false;
    const isoFecha = `${partes[2]}-${partes[1]}-${partes[0]}`;
    return isoFecha >= desdeVal && isoFecha <= hastaVal;
  });

  if (movsFiltrados.length === 0) {
    alert("No hay datos para exportar en el rango seleccionado.");
    return;
  }

  // Crear contenido CSV compatible con Excel
  let csvContent = "\uFEFFFecha,Tipo Movimiento,Usuario,Origen,Producto,Cantidad\n";

  movsFiltrados.forEach(reg => {
    if (reg.items) {
      reg.items.forEach(it => {
        const fila = `"${reg.fechaCorta}","${reg.tipo}","${reg.usuario}","${reg.origen || ''}","${it.nombre}",${it.cantidad}\n`;
        csvContent += fila;
      });
    }
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Reporte_Inventario_${desdeVal}_al_${hastaVal}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// --- HISTORIAL AGRUPADO POR DÍA CON ELIMINACIÓN POR ÍTEM ---

function renderHistorial() {
  const contenedor = document.getElementById('contenedorHistorial');
  const empty = document.getElementById('emptyHistorial');

  if (!contenedor) return;
  contenedor.innerHTML = '';

  if (historialMovimientos.length === 0) {
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  const gruposPorDia = {};
  historialMovimientos.forEach(reg => {
    const fechaKey = reg.fechaCorta || 'Sin Fecha';
    if (!gruposPorDia[fechaKey]) gruposPorDia[fechaKey] = [];
    gruposPorDia[fechaKey].push(reg);
  });

  const usuarioActual = sessionStorage.getItem('usuarioLogueado');
  const esAdmin = usuarioActual === 'Administrador';

  Object.keys(gruposPorDia).forEach(fechaDia => {
    const movsDelDia = gruposPorDia[fechaDia];

    const diaHeader = document.createElement('div');
    diaHeader.className = 'sticky top-12 bg-slate-200/90 backdrop-blur px-3 py-1 rounded-lg text-xs font-bold text-slate-700 my-2 flex justify-between items-center border border-slate-300 z-10';
    diaHeader.innerHTML = `
      <span>📅 Día: ${fechaDia}</span>
      <span class="text-[10px] bg-slate-300 px-2 py-0.5 rounded-full text-slate-700 font-semibold">${movsDelDia.length} registro(s)</span>
    `;
    contenedor.appendChild(diaHeader);

    movsDelDia.forEach(reg => {
      const card = document.createElement('div');
      card.className = 'bg-white border border-slate-200 rounded-xl p-3 space-y-2 shadow-sm text-xs';

      const esCreador = reg.usuario === usuarioActual;
      const puedeModificar = esAdmin || esCreador;

      const itemsHTML = reg.items ? reg.items.map(it => `
        <div class="flex justify-between items-center py-1 border-b border-slate-100 last:border-0">
          <span>${it.nombre} ${it.hora ? `<span class="text-[10px] text-slate-400">(${it.hora})</span>` : ''}</span>
          <div class="flex items-center gap-2">
            <span class="font-bold ${reg.tipo === 'INGRESO' ? 'text-emerald-600' : 'text-sky-600'}">${reg.tipo === 'INGRESO' ? '+' : '-'}${it.cantidad}</span>
            ${puedeModificar ? `<button onclick="eliminarItemHistorial('${reg._firebaseKey}', ${reg.id}, '${it.nombre}')" title="Borrar solo este ítem" class="text-rose-400 hover:text-rose-600 font-bold px-1 text-[10px]">✕</button>` : ''}
          </div>
        </div>
      `).join('') : '';

      card.innerHTML = `
        <div class="flex justify-between items-center border-b border-slate-100 pb-1.5">
          <div class="flex items-center gap-1.5">
            <span class="font-bold px-2 py-0.5 rounded text-[10px] ${reg.tipo === 'INGRESO' ? 'bg-emerald-100 text-emerald-800' : (reg.tipo === 'BAJA_CORTESIA' ? 'bg-rose-100 text-rose-800' : 'bg-sky-100 text-sky-800')}">
              ${reg.tipo}
            </span>
            <span class="font-bold text-slate-700">👤 ${reg.usuario}</span>
          </div>
          ${puedeModificar ? `<button onclick="eliminarRegistroHistorial('${reg._firebaseKey}', ${reg.id})" class="text-rose-500 hover:text-rose-700 font-semibold text-[11px]">🗑️ Anular Ticket</button>` : `<span class="text-[10px] text-slate-400 italic">Solo lectura</span>`}
        </div>
        <div class="space-y-0.5 bg-slate-50 p-2 rounded-lg">${itemsHTML}</div>
        <div class="text-[10px] text-slate-400 text-right font-mono">${reg.fecha} (${reg.origen || 'General'})</div>
      `;
      contenedor.appendChild(card);
    });
  });
}

// Inicialización de la aplicación y manejo de pestañas
function iniciarApp() {
  verificarSesion();

  const radioTabs = document.querySelectorAll('input[name="seccion"]');
  const tituloEl = document.getElementById('tituloSeccion');

  const titulosMap = {
    'tab-stock': 'Stock Depósito y Vitrina',
    'tab-total': 'Inventario Total Consolidado',
    'tab-transferencia': 'Traspaso (Depósito ➔ Cafetería)',
    'tab-barra': 'Ventas & Barra (Cafetería)',
    'tab-ingreso': 'Ingreso de Mercadería',
    'tab-nuevo_prod': 'Nuevo Producto (Admin)',
    'tab-historial': 'Historial de Movimientos',
    'tab-insumos': 'Insumos y Depósito',
    'tab-bajas': 'Bajas y Cortesías',
    'tab-cierre': 'Cierre de Turno',
    'tab-reportes': 'Reportes y Excel'
  };

  radioTabs.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        if (tituloEl && titulosMap[e.target.id]) {
          tituloEl.textContent = titulosMap[e.target.id];
        }
      }
    });
  });

  // Vincular eventos a botones principales
  document.getElementById('btnGuardarNuevoProd')?.addEventListener('click', guardarProductoNuevo);
  document.getElementById('btnAgregarATraspaso')?.addEventListener('click', agregarATraspaso);
  document.getElementById('btnConfirmarTraspaso')?.addEventListener('click', confirmarTraspasoMultiple);
  document.getElementById('btnAgregarABarra')?.addEventListener('click', agregarABarra);
  document.getElementById('btnConfirmarBarra')?.addEventListener('click', confirmarConsumoBarra);
  document.getElementById('btnAgregarAIngreso')?.addEventListener('click', agregarAIngreso);
  document.getElementById('btnGuardarIngreso')?.addEventListener('click', confirmarIngresoStockMultiple);
  document.getElementById('btnAgregarABaja')?.addEventListener('click', agregarABaja);
  document.getElementById('btnGuardarBajas')?.addEventListener('click', confirmarBajasMultiple);
  document.getElementById('btnCopiarWhatsApp')?.addEventListener('click', copiarReporteWhatsApp);
  document.getElementById('btnDescargarExcel')?.addEventListener('click', descargarExcelMovimientos);
  document.getElementById('filtroFechaDesde')?.addEventListener('change', renderReporteExcel);
  document.getElementById('filtroFechaHasta')?.addEventListener('change', renderReporteExcel);
}

// Ejecutar al cargar la página
window.addEventListener('DOMContentLoaded', iniciarApp);
