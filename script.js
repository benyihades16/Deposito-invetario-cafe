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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const inventoryRef = ref(db, 'inventario');
const historyRef = ref(db, 'historial');

let inventario = [];
let historialMovimientos = [];
let listaBarraActual = [];

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

// --- MODAL PIN ADMIN ---
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
  const stockDepInput = document.getElementById('prodStockDep');
  const stockCafInput = document.getElementById('prodStockCaf');

  const nombre = nombreInput.value.trim();
  const stockDep = parseInt(stockDepInput.value) || 0;
  const stockCaf = parseInt(stockCafInput.value) || 0;

  if (!nombre) {
    alert("Ingresa el nombre del producto.");
    return;
  }

  const nuevoProd = {
    id: Date.now(),
    nombre: nombre,
    stockDeposito: stockDep,
    stockCafeteria: stockCaf
  };

  inventario.push(nuevoProd);
  set(inventoryRef, inventario);

  nombreInput.value = '';
  stockDepInput.value = 0;
  stockCafInput.value = 0;

  alert(`✅ "${nombre}" agregado correctamente.`);
  irASeccion('tab-stock');
}

window.eliminarProducto = function(id, nombre) {
  if (sessionStorage.getItem('usuarioLogueado') !== 'Administrador') return;

  if (confirm(`🗑️ ¿Eliminar permanentemente "${nombre}" del inventario?`)) {
    inventario = inventario.filter(p => p.id !== id);
    set(inventoryRef, inventario);
  }
};

// --- OPERACIONES: TRASPASO, INGRESOS Y VENTAS BARRA ---

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

function ejecutarTraspaso() {
  const select = document.getElementById('selectProductoTraspaso');
  const cantInput = document.getElementById('cantTraspaso');

  const idProd = parseInt(select.value);
  const cantidad = parseInt(cantInput.value) || 0;

  if (!idProd || cantidad <= 0) return;

  const prod = inventario.find(p => p.id === idProd);
  if (!prod) return;

  if (cantidad > prod.stockDeposito) {
    alert(`Stock insuficiente en Depósito. Solo quedan ${prod.stockDeposito} unids.`);
    return;
  }

  prod.stockDeposito -= cantidad;
  prod.stockCafeteria += cantidad;

  set(inventoryRef, inventario);
  registrarMovimientoEnTurno('TRASPASO', [{ nombre: prod.nombre, cantidad: cantidad }], 'Depósito ➔ Cafetería');

  alert(`✅ Traspaso exitoso: ${cantidad} unids de "${prod.nombre}" movidos a Cafetería/Vitrina.`);
  cantInput.value = 1;
  irASeccion('tab-stock');
}

function confirmarIngresoStock() {
  const selectDestino = document.getElementById('selectDestinoIngreso');
  const selectProd = document.getElementById('selectProductoIngreso');
  const cantInput = document.getElementById('cantIngreso');

  const idProd = parseInt(selectProd.value);
  const cantidad = parseInt(cantInput.value) || 0;
  const destino = selectDestino.value;

  if (!idProd || cantidad <= 0) return;

  const prod = inventario.find(p => p.id === idProd);
  if (prod) {
    if (destino === 'deposito') prod.stockDeposito += cantidad;
    else prod.stockCafeteria += cantidad;

    set(inventoryRef, inventario);
    registrarMovimientoEnTurno('INGRESO', [{ nombre: prod.nombre, cantidad: cantidad }], destino === 'deposito' ? 'Ingreso Depósito' : 'Ingreso Cafetería');

    alert(`✅ Ingreso registrado en ${destino.toUpperCase()}: +${cantidad} unids a "${prod.nombre}".`);
    cantInput.value = 1;
    irASeccion('tab-stock');
  }
}

function agregarABarra() {
  const select = document.getElementById('selectProductoBarra');
  const cantInput = document.getElementById('cantBarra');

  const idProd = parseInt(select.value);
  const cantidad = parseInt(cantInput.value) || 1;

  if (!idProd || cantidad <= 0) return;

  const prod = inventario.find(p => p.id === idProd);
  if (!prod) return;

  if (cantidad > prod.stockCafeteria) {
    alert(`Stock insuficiente en Cafetería de "${prod.nombre}". Solo quedan ${prod.stockCafeteria} unids.`);
    return;
  }

  const existente = listaBarraActual.find(it => it.id === idProd);
  if (existente) {
    if ((existente.cantidad + cantidad) > prod.stockCafeteria) {
      alert(`La cantidad supera el stock disponible en Cafetería (${prod.stockCafeteria}).`);
      return;
    }
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

function confirmarConsumoBarra() {
  if (listaBarraActual.length === 0) return;

  listaBarraActual.forEach(itemBarra => {
    const prod = inventario.find(p => p.id === itemBarra.id);
    if (prod) {
      prod.stockCafeteria = Math.max(0, prod.stockCafeteria - itemBarra.cantidad);
    }
  });

  set(inventoryRef, inventario);
  registrarMovimientoEnTurno('VENTA_BARRA', listaBarraActual, 'Ventas Cafetería');

  listaBarraActual = [];
  alert(`✅ Consumo registrado correctamente.`);
  irASeccion('tab-stock');
}

// --- ANULACIÓN Y ELIMINACIÓN DE REGISTROS ---

window.eliminarRegistroHistorial = function(key, idRegistro) {
  const reg = historialMovimientos.find(m => m.id === idRegistro || m._firebaseKey === key);
  if (!reg) return;

  if (!confirm(`⚠️ ¿Anular este registro de ${reg.tipo}?\nEl stock afectado se devolverá automáticamente.`)) return;

  reg.items.forEach(item => {
    const prod = inventario.find(p => p.nombre === item.nombre);
    if (prod) {
      if (reg.tipo === 'VENTA_BARRA') {
        prod.stockCafeteria += item.cantidad;
      } else if (reg.tipo === 'TRASPASO') {
        prod.stockDeposito += item.cantidad;
        prod.stockCafeteria = Math.max(0, prod.stockCafeteria - item.cantidad);
      } else if (reg.tipo === 'INGRESO') {
        if (reg.origen === 'Ingreso Cafetería') prod.stockCafeteria = Math.max(0, prod.stockCafeteria - item.cantidad);
        else prod.stockDeposito = Math.max(0, prod.stockDeposito - item.cantidad);
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
  if (confirm("⚠️ ¿Poner en 0 el stock de Depósito y Cafetería para todos los productos?")) {
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
  renderSelectores();
  renderListaBarra();
  renderHistorial();
}

function renderInventario() {
  const ordenados = ordenarInventario(inventario);
  const esAdmin = sessionStorage.getItem('usuarioLogueado') === 'Administrador';

  // 1. RENDERIZAR TABLA DEPÓSITO
  const tbodyDep = document.getElementById('tablaDeposito');
  if (tbodyDep) {
    tbodyDep.innerHTML = '';
    ordenados.forEach(prod => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';
      tr.innerHTML = `
        <td class="py-3 px-2 font-semibold text-slate-800">${prod.nombre}</td>
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

  // 2. RENDERIZAR TABLA CAFETERÍA / VITRINA
  const tbodyCaf = document.getElementById('tablaCafeteria');
  if (tbodyCaf) {
    tbodyCaf.innerHTML = '';
    ordenados.forEach(prod => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';
      tr.innerHTML = `
        <td class="py-3 px-2 font-semibold text-slate-800">${prod.nombre}</td>
        <td class="py-3 px-2 text-center text-sky-700 font-mono font-bold">${prod.stockCafeteria}</td>
      `;
      tbodyCaf.appendChild(tr);
    });
  }

  // 3. RENDERIZAR NUEVA TABLA INVENTARIO TOTAL
  const tbodyTot = document.getElementById('tablaTotal');
  if (tbodyTot) {
    tbodyTot.innerHTML = '';
    ordenados.forEach(prod => {
      const total = prod.stockDeposito + prod.stockCafeteria;
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';
      tr.innerHTML = `
        <td class="py-3 px-2 font-semibold text-slate-800">${prod.nombre}</td>
        <td class="py-3 px-2 text-center text-slate-500 font-mono">${prod.stockDeposito}</td>
        <td class="py-3 px-2 text-center text-sky-600 font-mono">${prod.stockCafeteria}</td>
        <td class="py-3 px-2 text-right font-extrabold text-slate-900 font-mono">${total}</td>
      `;
      tbodyTot.appendChild(tr);
    });
  }

  // Contadores Header
  const elTotalProd = document.getElementById('statTotalProductos');
  if (elTotalProd) elTotalProd.textContent = inventario.length;

  const elTotalPases = document.getElementById('statTotalPases');
  if (elTotalPases) {
    const hoyStr = getFechaHoy();
    const movsHoy = historialMovimientos.filter(m => m.fechaCorta === hoyStr);
    elTotalPases.textContent = movsHoy.length;
  }
}

function renderSelectores() {
  const selTraspaso = document.getElementById('selectProductoTraspaso');
  const selBarra = document.getElementById('selectProductoBarra');
  const selIngreso = document.getElementById('selectProductoIngreso');

  if (!selTraspaso || !selBarra || !selIngreso) return;

  selTraspaso.innerHTML = '';
  selBarra.innerHTML = '';
  selIngreso.innerHTML = '';

  const ordenados = ordenarInventario(inventario);

  ordenados.forEach(prod => {
    const optT = document.createElement('option');
    optT.value = prod.id;
    optT.textContent = `${prod.nombre} (Depósito: ${prod.stockDeposito})`;
    if (prod.stockDeposito <= 0) optT.disabled = true;
    selTraspaso.appendChild(optT);

    const optB = document.createElement('option');
    optB.value = prod.id;
    optB.textContent = `${prod.nombre} (Cafetería: ${prod.stockCafeteria})`;
    if (prod.stockCafeteria <= 0) optB.disabled = true;
    selBarra.appendChild(optB);

    const optI = document.createElement('option');
    optI.value = prod.id;
    optI.textContent = prod.nombre;
    selIngreso.appendChild(optI);
  });
}

function renderListaBarra() {
  const lista = document.getElementById('listaBarraActual');
  const btnConf = document.getElementById('btnConfirmarBarra');
  const resCount = document.getElementById('resumenBarraCount');

  if (!lista) return;
  lista.innerHTML = '';

  if (listaBarraActual.length === 0) {
    lista.innerHTML = `<p class="text-xs text-slate-500 italic py-2">Ningún producto agregado aún.</p>`;
    if (btnConf) btnConf.disabled = true;
    if (resCount) resCount.textContent = '0 ítems';
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
}

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

  Object.keys(gruposPorDia).forEach(fechaDia => {
    const movsDelDia = gruposPorDia[fechaDia];

    const diaHeader = document.createElement('div');
    diaHeader.className = 'sticky top-12 bg-slate-200/90 backdrop-blur px-3 py-1 rounded-lg text-xs font-bold text-slate-700 my-2 flex justify-between items-center border border-slate-300 z-10';
    diaHeader.innerHTML = `
      <span>📅 Día: ${fechaDia}</span>
      <span class="text-[10px] bg-slate-300 px-2 py-0.5 rounded-full text-slate-700 font-semibold">${movsDelDia.length} turno(s)</span>
    `;
    contenedor.appendChild(diaHeader);

    movsDelDia.forEach(reg => {
      const card = document.createElement('div');
      card.className = 'bg-white border border-slate-200 rounded-xl p-3 space-y-2 shadow-sm text-xs';

      const itemsHTML = reg.items.map(it => `
        <div class="flex justify-between items-center py-1 border-b border-slate-100 last:border-0">
          <span>${it.nombre} ${it.hora ? `<span class="text-[10px] text-slate-400">(${it.hora})</span>` : ''}</span>
          <span class="font-bold ${reg.tipo === 'INGRESO' ? 'text-emerald-600' : 'text-sky-600'}">${reg.tipo === 'INGRESO' ? '+' : '-'}${it.cantidad}</span>
        </div>
      `).join('');

      card.innerHTML = `
        <div class="flex justify-between items-center border-b border-slate-100 pb-1.5">
          <div class="flex items-center gap-1.5">
            <span class="font-bold px-2 py-0.5 rounded text-[10px] ${reg.tipo === 'INGRESO' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}">
              ${reg.tipo}
            </span>
            <span class="font-bold text-slate-700">👤 ${reg.usuario}</span>
          </div>
          <button onclick="eliminarRegistroHistorial('${reg._firebaseKey}', ${reg.id})" class="text-rose-500 hover:text-rose-700 font-semibold text-[11px]">🗑️ Anular</button>
        </div>
        <div class="space-y-0.5 bg-slate-50 p-2 rounded-lg">${itemsHTML}</div>
        <div class="text-[10px] text-slate-400 text-right font-mono">${reg.fecha} (${reg.origen || 'General'})</div>
      `;
      contenedor.appendChild(card);
    });
  });
}

// Inicialización robusta compatible con ES Modules (corrección del evento DOMContentLoaded)
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
    'tab-historial': 'Historial de Movimientos'
  };

  radioTabs.forEach(radio => {
    radio.addEventListener('change', function() {
      if (this.checked && tituloEl) {
        tituloEl.textContent = titulosMap[this.id] || 'Control de Depósito';
        renderTodo();
      }
    });
  });

  document.getElementById('btnGuardarNuevoProd')?.addEventListener('click', guardarProductoNuevo);
  document.getElementById('btnEjecutarTraspaso')?.addEventListener('click', ejecutarTraspaso);
  document.getElementById('btnGuardarIngreso')?.addEventListener('click', confirmarIngresoStock);
  document.getElementById('btnAgregarABarra')?.addEventListener('click', agregarABarra);
  document.getElementById('btnConfirmarBarra')?.addEventListener('click', confirmarConsumoBarra);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarApp);
} else {
  iniciarApp();
}
