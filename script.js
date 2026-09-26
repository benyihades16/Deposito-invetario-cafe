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
const GRAMOS_POR_CAFE_DEF = 18; // 18g estándar por defecto

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const inventoryRef = ref(db, 'inventario');
const historyRef = ref(db, 'historial');
const cafeGranoRef = ref(db, 'cafeGrano');

let inventario = [];
let historialMovimientos = [];
let cafeGranoData = { inicial: 1000, actual: 1000 };
let listaTraspasoActual = [];
let listaIngresoActual = [];
let listaBajaActual = [];
let listaTicketBarraActual = [];
let filtroBusquedaBarra = ''; 
let counterMovimiento = 0;

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
      stockCafeteria: item.stockCafeteria !== undefined ? item.stockCafeteria : 0,
      precio: item.precio || 0,
      gramosPorTaza: item.gramosPorTaza !== undefined ? item.gramosPorTaza : GRAMOS_POR_CAFE_DEF
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

// Escuchar cambios de café en grano en vivo
onValue(cafeGranoRef, (snapshot) => {
  const data = snapshot.val();
  if (data) {
    cafeGranoData = data;
  }
  renderControlCafe();
});

// --- GESTIÓN DE PERFILES Y SESIÓN ---

function verificarSesion() {
  const usuarioLogueado = sessionStorage.getItem('usuarioLogueado');
  const modalLogin = document.getElementById('loginModal');
  
  if (!usuarioLogueado) {
    if (modalLogin) modalLogin.classList.remove('hidden');
  } else {
    if (modalLogin) modalLogin.classList.add('hidden');
    actualizarBadgeUsuario(usuarioLogueado);
    aplicarPermisosPerfil(usuarioLogueado);
  }
}

function configurarModalLogin() {
  const modalLogin = document.getElementById('loginModal');
  if (!modalLogin) return;

  const modalContentBox = modalLogin.querySelector('.bg-white') || modalLogin.firstElementChild;
  if (!modalContentBox) return;

  modalContentBox.innerHTML = `
    <div class="flex flex-col items-center text-center space-y-4">
      <div class="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-2xl shadow-inner">☕</div>
      <div>
        <h2 class="text-base font-bold text-slate-900">Control de Depósito y Cafetería</h2>
        <p class="text-xs text-slate-500">Selecciona tu perfil para ingresar</p>
      </div>

      <div id="gridPerfiles" class="grid grid-cols-3 gap-2 w-full my-2">
        <button type="button" data-usuario="Administrador" class="perfil-card flex flex-col items-center justify-center p-3 rounded-xl border-2 border-slate-200 hover:border-amber-500 hover:bg-amber-50/50 transition cursor-pointer group">
          <span class="text-xl mb-1">👑</span>
          <span class="font-bold text-[11px] text-slate-800 group-hover:text-amber-700">Administrador</span>
        </button>
        <button type="button" data-usuario="Usuario 1" class="perfil-card flex flex-col items-center justify-center p-3 rounded-xl border-2 border-slate-200 hover:border-sky-500 hover:bg-sky-50/50 transition cursor-pointer group">
          <span class="text-xl mb-1">👤</span>
          <span class="font-bold text-[11px] text-slate-800 group-hover:text-sky-700">Usuario 1</span>
        </button>
        <button type="button" data-usuario="Usuario 2" class="perfil-card flex flex-col items-center justify-center p-3 rounded-xl border-2 border-slate-200 hover:border-sky-500 hover:bg-sky-50/50 transition cursor-pointer group">
          <span class="text-xl mb-1">👤</span>
          <span class="font-bold text-[11px] text-slate-800 group-hover:text-sky-700">Usuario 2</span>
        </button>
      </div>

      <div id="divPinAdminContainer" class="w-full hidden space-y-1.5 text-left">
        <label class="text-[11px] font-semibold text-slate-600 block">PIN de Administrador:</label>
        <input type="password" id="loginPinInput" placeholder="Ingrese PIN (1234)" class="w-full bg-slate-50 border border-slate-300 text-xs text-slate-900 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500 text-center tracking-widest font-bold" maxlength="4" />
      </div>

      <button id="btnConfirmarIngresoPerfil" type="button" class="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-3 rounded-xl transition shadow-md hidden">
        Ingresar al Sistema
      </button>
    </div>
  `;

  let usuarioSeleccionado = null;
  const cards = modalContentBox.querySelectorAll('.perfil-card');
  const divPinContainer = document.getElementById('divPinAdminContainer');
  const pinInput = document.getElementById('loginPinInput');
  const btnConfirmar = document.getElementById('btnConfirmarIngresoPerfil');

  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('border-amber-500', 'bg-amber-50', 'border-sky-500', 'bg-sky-50', 'ring-2', 'ring-amber-200', 'ring-sky-200'));
      
      usuarioSeleccionado = card.getAttribute('data-usuario');
      const esAdmin = usuarioSeleccionado.toLowerCase() === 'administrador';

      if (esAdmin) {
        card.classList.add('border-amber-500', 'bg-amber-50', 'ring-2', 'ring-amber-200');
        divPinContainer.classList.remove('hidden');
        btnConfirmar.classList.remove('hidden');
        if (pinInput) {
          pinInput.value = '';
          pinInput.focus();
        }
      } else {
        card.classList.add('border-sky-500', 'bg-sky-50', 'ring-2', 'ring-sky-200');
        divPinContainer.classList.add('hidden');
        btnConfirmar.classList.remove('hidden');
        if (pinInput) pinInput.value = '';
      }
    });
  });

  btnConfirmar.addEventListener('click', () => {
    if (!usuarioSeleccionado) {
      alert("Selecciona un perfil primero.");
      return;
    }

    const esAdmin = usuarioSeleccionado.toLowerCase() === 'administrador';
    if (esAdmin) {
      const pinVal = pinInput ? pinInput.value.trim() : '';
      if (pinVal !== ADMIN_PIN) {
        alert("❌ PIN incorrecto. Intenta nuevamente.");
        if (pinInput) {
          pinInput.value = '';
          pinInput.focus();
        }
        return;
      }
    }

    sessionStorage.setItem('usuarioLogueado', usuarioSeleccionado);
    if (pinInput) pinInput.value = '';
    verificarSesion();
    renderTodo();
  });

  pinInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      btnConfirmar.click();
    }
  });
}

function aplicarPermisosPerfil(nombreUsuario) {
  const tabNuevoProd = document.getElementById('tab-nuevo_prod');
  const thAdminAcciones = document.querySelectorAll('.thAdminAcciones');
  const panelAdminCafe = document.getElementById('panelAdminAgregarCafe');
  const esAdmin = nombreUsuario.trim().toLowerCase() === 'administrador';

  if (tabNuevoProd) {
    const labelTab = document.querySelector('label[for="tab-nuevo_prod"]');
    if (labelTab) labelTab.style.display = esAdmin ? '' : 'none';
  }

  thAdminAcciones.forEach(el => {
    if (esAdmin) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });

  if (panelAdminCafe) {
    if (esAdmin) panelAdminCafe.classList.remove('hidden');
    else panelAdminCafe.classList.add('hidden');
  }

  renderPanelMantenimiento(nombreUsuario);
}

function actualizarBadgeUsuario(nombre) {
  const container = document.getElementById('usuarioHeaderBadge');
  const badgeBarra = document.getElementById('badgeUsuarioBarra');
  if (!container) return;

  container.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="text-[11px] font-bold text-slate-200 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
        👤 ${nombre}
      </span>
      <button onclick="cerrarSesion()" title="Cerrar sesión" class="text-xs bg-rose-600/85 hover:bg-rose-600 text-white font-bold p-1 rounded-lg transition">
        🚪
      </button>
    </div>
  `;

  if (badgeBarra) {
    badgeBarra.textContent = `Operador: ${nombre}`;
  }
}

window.cerrarSesion = function() {
  if (confirm("¿Deseas cerrar la sesión activa?")) {
    sessionStorage.removeItem('usuarioLogueado');
    listaTraspasoActual = [];
    listaIngresoActual = [];
    listaBajaActual = [];
    listaTicketBarraActual = [];
    verificarSesion();
    window.location.reload();
  }
};

function irASeccion(tabId) {
  const radio = document.getElementById(tabId);
  if (radio) {
    radio.checked = true;
    radio.dispatchEvent(new Event('change'));
  }
}

// --- CONTROL DE CAFÉ EN GRANO ---
function renderControlCafe() {
  const elInicial = document.getElementById('cafeMontoInicial');
  const elReal = document.getElementById('cafeRestanteReal');
  if (elInicial) elInicial.textContent = `${cafeGranoData.inicial.toFixed(2)} g`;
  if (elReal) elReal.textContent = `${cafeGranoData.actual.toFixed(2)} g`;
}

window.agregarCafeGranoAdmin = function() {
  if (sessionStorage.getItem('usuarioLogueado')?.toLowerCase() !== 'administrador') return;
  const input = document.getElementById('inputAdminCafeGramos');
  const gramos = parseFloat(input?.value);
  if (isNaN(gramos) || gramos <= 0) {
    alert("Ingresa una cantidad válida en gramos.");
    return;
  }

  cafeGranoData.inicial += gramos;
  cafeGranoData.actual += gramos;
  set(cafeGranoRef, cafeGranoData);
  input.value = '';
  alert(`✅ Se agregaron ${gramos}g al control de café en grano.`);
};

// --- GESTIÓN DE PRODUCTOS Y GRAMAJE ---
function configurarSelectorTipoProducto() {
  const tipoInput = document.getElementById('prodTipo');
  if (tipoInput) {
    if (!tipoInput.querySelector('option[value="cafe"]')) {
      const opt = document.createElement('option');
      opt.value = 'cafe';
      opt.textContent = 'Café (Preparación de Barra)';
      tipoInput.appendChild(opt);
    }

    let contenedorGramos = document.getElementById('contenedorGramosCafeGroup');
    if (!contenedorGramos && tipoInput.parentElement) {
      contenedorGramos = document.createElement('div');
      contenedorGramos.id = 'contenedorGramosCafeGroup';
      contenedorGramos.className = 'flex flex-col gap-1 mt-3 hidden';
      contenedorGramos.innerHTML = `
        <label class="text-xs font-semibold text-slate-300">Gramos por Taza (Personalizado):</label>
        <input type="number" id="prodGramosCafe" class="bg-slate-950 border border-slate-700 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500" value="18" min="1" step="0.5" />
        <span class="text-[10px] text-slate-500">Permite configurar gramos exactos (ej. 14g, 18g, 20g, 22g, etc.)</span>
      `;
      tipoInput.parentElement.insertAdjacentElement('afterend', contenedorGramos);
    }

    const actualizarVisibilidadGramos = () => {
      const val = tipoInput.value;
      if (val === 'cafe') {
        contenedorGramos?.classList.remove('hidden');
      } else {
        contenedorGramos?.classList.add('hidden');
      }
    };

    tipoInput.addEventListener('change', actualizarVisibilidadGramos);
    actualizarVisibilidadGramos();
  }
}

function guardarProductoNuevo() {
  if (sessionStorage.getItem('usuarioLogueado')?.toLowerCase() !== 'administrador') return;

  const nombreInput = document.getElementById('prodNombre');
  const tipoInput = document.getElementById('prodTipo');
  const stockDepInput = document.getElementById('prodStockDep');
  const stockCafInput = document.getElementById('prodStockCaf');
  const gramosCafeInput = document.getElementById('prodGramosCafe');

  const nombre = nombreInput?.value.trim();
  const tipo = tipoInput ? tipoInput.value : 'producto';
  const stockDep = parseInt(stockDepInput?.value) || 0;
  const stockCaf = parseInt(stockCafInput?.value) || 0;
  const gramosPorTaza = tipo === 'cafe' ? (parseFloat(gramosCafeInput?.value) || GRAMOS_POR_CAFE_DEF) : 0;

  if (!nombre) {
    alert("Ingresa el nombre del ítem.");
    return;
  }

  const nuevoProd = {
    id: Date.now(),
    nombre: nombre,
    tipo: tipo, 
    stockDeposito: tipo === 'cafe' ? 0 : stockDep,
    stockCafeteria: tipo === 'cafe' ? 0 : stockCaf,
    precio: 0,
    gramosPorTaza: gramosPorTaza
  };

  inventario.push(nuevoProd);
  set(inventoryRef, inventario);

  if (nombreInput) nombreInput.value = '';
  if (stockDepInput) stockDepInput.value = 0;
  if (stockCafInput) stockCafInput.value = 0;
  if (gramosCafeInput) gramosCafeInput.value = GRAMOS_POR_CAFE_DEF;

  alert(`✅ "${nombre}" agregado correctamente.`);
  irASeccion(tipo === 'insumo' ? 'tab-insumos' : 'tab-stock');
}

window.eliminarProducto = function(id, nombre) {
  if (sessionStorage.getItem('usuarioLogueado')?.toLowerCase() !== 'administrador') return;

  if (confirm(`🗑️ ¿Eliminar permanentemente "${nombre}" del inventario?`)) {
    inventario = inventario.filter(p => p.id !== id);
    set(inventoryRef, inventario);
  }
};

// --- REGISTRO ROBUSTO CON ACOPLAMIENTO POR TURNO ---
function registrarMovimientoEnTurno(tipo, itemsNuevos, origen) {
  const usuario = sessionStorage.getItem('usuarioLogueado') || 'Usuario';
  const ahora = new Date();
  const fechaCorta = getFechaHoy();
  const horaStr = ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Si es Traspaso, Ingreso o Baja, intentamos agrupar/acoplar al registro del mismo día y tipo
  if (tipo === 'TRASPASO' || tipo === 'INGRESO' || tipo === 'BAJA_CORTESIA') {
    const registroExistente = historialMovimientos.find(m => 
      m.fechaCorta === fechaCorta && 
      m.usuario === usuario && 
      m.tipo === tipo &&
      m.origen === origen
    );

    if (registroExistente && registroExistente._firebaseKey) {
      itemsNuevos.forEach(nuevoIt => {
        const itemEnDb = registroExistente.items.find(i => i.nombre === nuevoIt.nombre);
        if (itemEnDb) {
          itemEnDb.cantidad += nuevoIt.cantidad;
          itemEnDb.hora = horaStr;
        } else {
          registroExistente.items.push({
            id: nuevoIt.id || Date.now(),
            nombre: nuevoIt.nombre,
            cantidad: nuevoIt.cantidad,
            hora: horaStr
          });
        }
      });
      registroExistente.fecha = `${fechaCorta} - ${horaStr}`;

      const key = registroExistente._firebaseKey;
      const dataToSave = { ...registroExistente };
      delete dataToSave._firebaseKey;
      set(ref(db, `historial/${key}`), dataToSave);
      return;
    }
  }

  // De lo contrario, se crea un registro nuevo (para Ventas u otros)
  const nuevoRegistro = {
    id: Date.now() + (counterMovimiento++),
    tipo: tipo,
    usuario: usuario,
    fechaCorta: fechaCorta,
    fecha: `${fechaCorta} - ${horaStr}`,
    origen: origen || 'General',
    items: itemsNuevos.map(it => ({
      id: it.id || Date.now(),
      nombre: it.nombre || 'Ítem',
      cantidad: it.cantidad || 0,
      hora: horaStr
    }))
  };

  push(historyRef, nuevoRegistro).catch(err => {
    console.error("Error al registrar movimiento:", err);
    alert("❌ Error al guardar el movimiento en la base de datos.");
  });
}

// --- ANULACIÓN POR ÍTEM INDIVIDUAL Y REVERSIÓN DE STOCK ---
window.anularItemMovimiento = function(firebaseKey, itemIndex) {
  const reg = historialMovimientos.find(m => m._firebaseKey === firebaseKey);
  if (!reg) return;

  const usuarioLogueado = sessionStorage.getItem('usuarioLogueado');
  const esAdmin = usuarioLogueado?.toLowerCase() === 'administrador';

  if (!esAdmin && reg.usuario !== usuarioLogueado) {
    alert("❌ Solo puedes modificar tus propios registros o ser Administrador.");
    return;
  }

  const itemEliminar = reg.items[itemIndex];
  if (!itemEliminar) return;

  if (confirm(`¿Eliminar el ítem "${itemEliminar.nombre} (x${itemEliminar.cantidad})" y revertir su stock?`)) {
    const prod = inventario.find(p => p.nombre === itemEliminar.nombre);
    if (prod && prod.tipo !== 'cafe') {
      if (reg.tipo === 'TRASPASO') {
        prod.stockDeposito += itemEliminar.cantidad;
        prod.stockCafeteria = Math.max(0, prod.stockCafeteria - itemEliminar.cantidad);
      } else if (reg.tipo === 'INGRESO') {
        if (reg.origen?.includes('Depósito')) {
          prod.stockDeposito = Math.max(0, prod.stockDeposito - itemEliminar.cantidad);
        } else {
          prod.stockCafeteria = Math.max(0, prod.stockCafeteria - itemEliminar.cantidad);
        }
      } else if (reg.tipo === 'BAJA_CORTESIA') {
        if (reg.origen?.toLowerCase().includes('cafeteria')) {
          prod.stockCafeteria += itemEliminar.cantidad;
        } else {
          prod.stockDeposito += itemEliminar.cantidad;
        }
      } else if (reg.tipo.includes('VENTA')) {
        prod.stockCafeteria += itemEliminar.cantidad;
      }
      set(inventoryRef, inventario);
    }

    reg.items.splice(itemIndex, 1);

    if (reg.items.length === 0) {
      remove(ref(db, `historial/${firebaseKey}`));
    } else {
      const dataToSave = { ...reg };
      delete dataToSave._firebaseKey;
      set(ref(db, `historial/${firebaseKey}`), dataToSave);
    }

    alert("✅ Ítem anulado y stock revertido correctamente.");
  }
};

window.anularMovimientoBitacora = function(firebaseKey, usuarioMovimiento) {
  const usuarioLogueado = sessionStorage.getItem('usuarioLogueado');
  const esAdmin = usuarioLogueado?.toLowerCase() === 'administrador';

  if (!esAdmin && usuarioLogueado !== usuarioMovimiento) {
    alert("❌ Solo puedes anular tus propios movimientos o debes ser Administrador.");
    return;
  }

  if (confirm("¿Estás seguro de anular y eliminar todo este registro completo de la bitácora?")) {
    remove(ref(db, `historial/${firebaseKey}`))
      .then(() => {
        alert("✅ Movimiento anulado correctamente.");
      })
      .catch((error) => {
        alert("❌ Error al anular: " + error.message);
      });
  }
};

// --- TRASPASOS ---
function agregarATraspaso() {
  const select = document.getElementById('selectProductoTraspaso');
  const cantInput = document.getElementById('cantTraspaso');

  const idProd = parseInt(select?.value);
  const cantidad = parseInt(cantInput?.value) || 1;

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

  if (cantInput) cantInput.value = 1;
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
      alert(`Stock insuficiente para "${item.nombre}".`);
      return;
    }
  }

  listaTraspasoActual.forEach(itemTraspaso => {
    const prod = inventario.find(p => p.id === itemTraspaso.id);
    if (prod) {
      prod.stockDeposito = Math.max(0, prod.stockDeposito - itemTraspaso.cantidad);
      if (prod.tipo !== 'insumo' && prod.tipo !== 'cafe') {
        prod.stockCafeteria += itemTraspaso.cantidad;
      }
    }
  });

  set(inventoryRef, inventario);
  registrarMovimientoEnTurno('TRASPASO', [...listaTraspasoActual], 'Depósito ➔ Cafetería');

  listaTraspasoActual = [];
  alert(`✅ Traspaso registrado y acoplado correctamente.`);
  irASeccion('tab-stock');
}

// --- VENTAS DE BARRA ---
function renderBotonesBarra() {
  const grid = document.getElementById('gridBotonesBarra');
  if (!grid) return;

  let containerPadre = grid.parentElement;
  let buscadorInput = document.getElementById('inputBuscadorBarra');
  if (!buscadorInput && containerPadre) {
    const wrapper = document.createElement('div');
    wrapper.className = 'mb-3 flex items-center bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 shadow-inner';
    wrapper.innerHTML = `
      <span class="text-sm mr-2">🔍</span>
      <input type="text" id="inputBuscadorBarra" placeholder="Buscar producto en barra..." class="bg-transparent text-xs text-white focus:outline-none w-full" value="${filtroBusquedaBarra}" />
    `;
    containerPadre.insertBefore(wrapper, grid);
    
    document.getElementById('inputBuscadorBarra').addEventListener('input', (e) => {
      filtroBusquedaBarra = e.target.value.toLowerCase();
      renderBotonesBarra();
    });
  }

  grid.innerHTML = '';
  let productosVisibles = ordenarInventario(inventario.filter(p => p.tipo !== 'insumo'));

  if (filtroBusquedaBarra) {
    productosVisibles = productosVisibles.filter(p => p.nombre.toLowerCase().includes(filtroBusquedaBarra));
  }

  if (productosVisibles.length === 0) {
    grid.innerHTML = `<p class="col-span-full text-xs text-slate-500 italic text-center py-4">No se encontraron productos.</p>`;
    return;
  }

  productosVisibles.forEach(prod => {
    const esCafe = prod.tipo === 'cafe';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bg-slate-800 hover:bg-slate-700 border border-slate-700 p-2 rounded-xl text-left flex flex-col justify-between transition active:scale-95 shadow';
    
    let infoStockHtml = esCafe 
      ? `<span class="text-[10px] text-amber-400 font-semibold">⚡ Café (${prod.gramosPorTaza || GRAMOS_POR_CAFE_DEF}g)</span>` 
      : `<span class="text-[10px] text-sky-400">Stock: ${prod.stockCafeteria}</span>`;

    btn.innerHTML = `
      <div>
        <span class="font-bold text-slate-100 text-xs block truncate">${prod.nombre}</span>
        ${infoStockHtml}
      </div>
    `;
    btn.addEventListener('click', () => agregarItemTicketBarra(prod.id));
    grid.appendChild(btn);
  });
}

function agregarItemTicketBarra(idProd) {
  const prod = inventario.find(p => p.id === idProd);
  if (!prod) return;

  const existente = listaTicketBarraActual.find(it => it.id === idProd);
  const cantActual = existente ? existente.cantidad : 0;

  if (prod.tipo !== 'cafe' && (cantActual + 1 > prod.stockCafeteria)) {
    alert(`Stock insuficiente en Cafetería para "${prod.nombre}".`);
    return;
  }

  if (existente) {
    existente.cantidad += 1;
  } else {
    listaTicketBarraActual.push({ id: prod.id, nombre: prod.nombre, cantidad: 1, precio: prod.precio || 0, tipo: prod.tipo, gramosPorTaza: prod.gramosPorTaza || GRAMOS_POR_CAFE_DEF });
  }

  renderTicketActualBarra();
}

window.quitarItemTicketBarra = function(idx) {
  listaTicketBarraActual.splice(idx, 1);
  renderTicketActualBarra();
};

function renderTicketActualBarra() {
  const container = document.getElementById('listaTicketActualBarra');
  const btnEmitir = document.getElementById('btnEmitirTicketVenta');
  const totalMontoEl = document.getElementById('ticketTotalMonto');

  if (!container) return;
  container.innerHTML = '';

  if (listaTicketBarraActual.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-500 text-center py-2">No hay ítems seleccionados.</p>`;
    if (btnEmitir) btnEmitir.disabled = true;
    if (totalMontoEl) totalMontoEl.textContent = '0.00 BOB';
    return;
  }

  if (btnEmitir) btnEmitir.disabled = false;
  let totalMonto = 0;

  listaTicketBarraActual.forEach((item, idx) => {
    const subtotal = item.cantidad * item.precio;
    totalMonto += subtotal;
    const div = document.createElement('div');
    div.className = 'flex justify-between items-center bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 text-xs';
    div.innerHTML = `
      <div>
        <span class="text-slate-200 font-medium">${item.nombre}</span>
        <span class="text-[10px] text-slate-400 block">Cant: ${item.cantidad}</span>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-sky-300 font-bold">${subtotal.toFixed(2)} BOB</span>
        <button type="button" onclick="quitarItemTicketBarra(${idx})" class="text-slate-500 hover:text-rose-400 font-bold px-1">✕</button>
      </div>
    `;
    container.appendChild(div);
  });

  if (totalMontoEl) totalMontoEl.textContent = `${totalMonto.toFixed(2)} BOB`;
}

function emitirTicketVenta() {
  if (listaTicketBarraActual.length === 0) return;

  for (let item of listaTicketBarraActual) {
    if (item.tipo !== 'cafe') {
      const prod = inventario.find(p => p.id === item.id);
      if (!prod || prod.stockCafeteria < item.cantidad) {
        alert(`Stock insuficiente para "${item.nombre}" en cafetería.`);
        return;
      }
    }
  }

  let gramosConsumidosTotal = 0;

  listaTicketBarraActual.forEach(item => {
    const prod = inventario.find(p => p.id === item.id);
    if (prod) {
      if (prod.tipo === 'cafe') {
        const gramosItem = item.cantidad * (prod.gramosPorTaza || GRAMOS_POR_CAFE_DEF);
        gramosConsumidosTotal += gramosItem;
      } else {
        prod.stockCafeteria = Math.max(0, prod.stockCafeteria - item.cantidad);
      }
    }
  });

  if (gramosConsumidosTotal > 0) {
    cafeGranoData.actual = Math.max(0, cafeGranoData.actual - gramosConsumidosTotal);
    set(cafeGranoRef, cafeGranoData);
  }

  set(inventoryRef, inventario);
  registrarMovimientoEnTurno('VENTA_BARRA', [...listaTicketBarraActual], gramosConsumidosTotal > 0 ? `Ventas Barra (-${gramosConsumidosTotal}g Café)` : 'Ventas Barra');

  listaTicketBarraActual = [];
  renderTicketActualBarra();
  renderBotonesBarra();
  alert("✅ Ticket emitido y stock actualizado correctamente.");
  irASeccion('tab-tickets');
}

// --- RECIBOS / TICKETS (Con cancelación por ítem) ---
function renderRecibosTickets() {
  const contenedor = document.getElementById('contenedorRecibosTickets');
  const empty = document.getElementById('emptyRecibos');
  if (!contenedor) return;

  contenedor.innerHTML = '';
  const ventas = historialMovimientos.filter(m => m.tipo === 'VENTA_BARRA' || m.tipo.includes('VENTA'));

  if (ventas.length === 0) {
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  const ventasCronologicas = [...ventas].sort((a, b) => a.id - b.id);
  const usuarioLogueado = sessionStorage.getItem('usuarioLogueado');
  const esAdmin = usuarioLogueado?.toLowerCase() === 'administrador';

  ventas.forEach(reg => {
    const indexCorrelativo = ventasCronologicas.findIndex(v => v._firebaseKey === reg._firebaseKey) + 1;
    const numeroTicketStr = `T-${String(indexCorrelativo).padStart(4, '0')}`;
    const puedeBorrar = esAdmin || reg.usuario === usuarioLogueado;

    const card = document.createElement('div');
    card.className = 'bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs';
    
    const itemsHTML = reg.items ? reg.items.map((it, idxIt) => `
      <div class="flex justify-between items-center py-1 border-b border-slate-200/60 last:border-0">
        <span class="text-slate-800">${it.nombre} (x${it.cantidad})</span>
        <div class="flex items-center gap-2">
          <span class="font-bold text-sky-700">${it.hora || ''}</span>
          ${puedeBorrar ? `<button onclick="anularItemMovimiento('${reg._firebaseKey}',${idxIt})" class="text-rose-500 hover:text-rose-700 text-[10px] font-bold px-1 rounded bg-rose-50" title="Eliminar este ítem">✕</button>` : ''}
        </div>
      </div>
    `).join('') : '';

    card.innerHTML = `
      <div class="flex justify-between items-center border-b border-slate-200 pb-2">
        <span class="font-bold text-slate-900">🧾 Ticket #${numeroTicketStr}</span>
        <div class="flex items-center gap-2">
          <span class="text-[10px] bg-sky-100 text-sky-800 px-2 py-0.5 rounded font-semibold">👤 ${reg.usuario}</span>
          ${puedeBorrar ? `<button onclick="anularMovimientoBitacora('${reg._firebaseKey}', '${reg.usuario}')" class="text-rose-600 hover:text-rose-800 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100" title="Anular ticket entero">Anular</button>` : ''}
        </div>
      </div>
      <div class="space-y-1 bg-white p-2.5 rounded-lg border border-slate-200">${itemsHTML}</div>
      <div class="text-[10px] text-slate-500 text-right font-mono">${reg.fecha} | ${reg.origen || ''}</div>
    `;
    contenedor.appendChild(card);
  });
}

// --- INGRESOS ---
function agregarAIngreso() {
  const selectDestino = document.getElementById('selectDestinoIngreso');
  const selectProd = document.getElementById('selectProductoIngreso');
  const cantInput = document.getElementById('cantIngreso');

  const idProd = parseInt(selectProd?.value);
  const cantidad = parseInt(cantInput?.value) || 0;
  const destino = selectDestino?.value || 'deposito';

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

  if (cantInput) cantInput.value = 1;
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
    if (prod && prod.tipo !== 'cafe') {
      if (item.destino === 'deposito') prod.stockDeposito += item.cantidad;
      else prod.stockCafeteria += item.cantidad;
    }
  });

  set(inventoryRef, inventario);

  const grupos = {};
  listaIngresoActual.forEach(it => {
    if (!grupos[it.origenTexto]) grupos[it.origenTexto] = [];
    grupos[it.origenTexto].push({ id: it.id, nombre: it.nombre, cantidad: it.cantidad });
  });

  Object.keys(grupos).forEach(origen => {
    registrarMovimientoEnTurno('INGRESO', [...grupos[origen]], origen);
  });

  listaIngresoActual = [];
  alert(`✅ Ingresos guardados y acoplados correctamente.`);
  renderListaIngreso();
  irASeccion('tab-stock');
}

// --- BAJAS Y CORTESÍAS ---
function agregarABaja() {
  const selectUbicacion = document.getElementById('selectUbicacionBaja');
  const selectProd = document.getElementById('selectProductoBaja');
  const cantInput = document.getElementById('cantBaja');
  const motivoInput = document.getElementById('selectMotivoBaja');

  const idProd = parseInt(selectProd?.value);
  const cantidad = parseInt(cantInput?.value) || 0;
  const ubicacion = selectUbicacion?.value || 'cafeteria';
  const motivo = motivoInput?.value || 'Cortesía';

  if (!idProd || cantidad <= 0) return;

  const prod = inventario.find(p => p.id === idProd);
  if (!prod) return;

  const stockDisponible = ubicacion === 'cafeteria' ? prod.stockCafeteria : prod.stockDeposito;
  if (prod.tipo !== 'cafe' && cantidad > stockDisponible) {
    alert(`Stock insuficiente. Stock actual: ${stockDisponible}`);
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
      origenTexto: `Baja/Cortesía (${motivo} - ${ubicacion})`
    });
  }

  if (cantInput) cantInput.value = 1;
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
    if (prod && prod.tipo !== 'cafe') {
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
    grupos[it.origenTexto].push({ id: it.id, nombre: it.nombre, cantidad: it.cantidad });
  });

  Object.keys(grupos).forEach(origen => {
    registrarMovimientoEnTurno('BAJA_CORTESIA', [...grupos[origen]], origen);
  });

  listaBajaActual = [];
  alert(`✅ Salidas registradas y acopladas correctamente.`);
  renderListaBaja();
  irASeccion('tab-stock');
}

// --- Insumos ---
window.pasarInsumo = function(idInsumo) {
  const prod = inventario.find(p => p.id === idInsumo);
  if (!prod) return;

  const cantidadStr = prompt(`¿Cuántas unidades deseas pasar desde el depósito? (Stock actual: ${prod.stockDeposito})`, "1");
  if (!cantidadStr) return;
  const cantidad = parseInt(cantidadStr);

  if (isNaN(cantidad) || cantidad <= 0 || cantidad > prod.stockDeposito) {
    alert("Cantidad inválida o insuficiente.");
    return;
  }

  prod.stockDeposito -= cantidad;
  set(inventoryRef, inventario);
  registrarMovimientoEnTurno('TRASPASO_INSUMO', [{ id: prod.id, nombre: prod.nombre, cantidad: cantidad }], 'Depósito Insumos');
  alert(`✅ Se pasaron ${cantidad} de "${prod.nombre}".`);
};

// --- MANTENIMIENTO ADMIN ---
function renderPanelMantenimiento(nombreUsuario) {
  let panel = document.getElementById('panelMantenimientoAdmin');
  const tabContent = document.getElementById('sec-nuevo_prod');
  const esAdmin = nombreUsuario.trim().toLowerCase() === 'administrador';
  if (!tabContent) return;

  if (!esAdmin) {
    if (panel) panel.remove();
    return;
  }

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
        <label class="font-semibold text-slate-300">Borrar Historial:</label>
        <div class="flex gap-2">
          <select id="selectBorradoTiempo" class="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2 py-1 flex-1">
            <option value="todo">⚠️ BORRAR TODO EL HISTORIAL</option>
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
  if (confirm("⚠️ ¿Confirmas borrar TODO el historial permanentemente?")) {
    remove(historyRef).then(() => {
      historialMovimientos = [];
      renderTodo();
      alert("✅ Historial borrado por completo.");
    });
  }
};

window.reiniciarStockTodo = function() {
  if (confirm("⚠️ ¿Poner en 0 el stock de Depósito y Cafetería para todos los ítems?")) {
    inventario.forEach(p => { if (p.tipo !== 'cafe') { p.stockDeposito = 0; p.stockCafeteria = 0; } });
    set(inventoryRef, inventario).then(() => {
      renderTodo();
      alert("✅ Stock reiniciado a 0.");
    });
  }
};

// --- RENDER GENERAL ---
function renderTodo() {
  renderInventario();
  renderInsumos();
  renderSelectores();
  renderBotonesBarra();
  renderTicketActualBarra();
  renderRecibosTickets();
  renderReporteExcel();
  renderHistorial();
  renderListaTraspaso();
  renderListaIngreso();
  renderListaBaja();
  renderCierreTurno();
}

function renderInventario() {
  const productosVisibles = inventario.filter(p => p.tipo !== 'insumo' && p.tipo !== 'cafe');
  const ordenados = ordenarInventario(productosVisibles);
  const esAdmin = sessionStorage.getItem('usuarioLogueado')?.trim().toLowerCase() === 'administrador';

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
              if (m.tipo === 'VENTA_BARRA' || m.tipo.includes('VENTA')) ventasHoy += it.cantidad;
              else if (m.tipo === 'TRASPASO') entradasHoy += it.cantidad;
              else if (m.tipo === 'INGRESO' && m.origen?.includes('Cafetería')) entradasHoy += it.cantidad;
              else if (m.tipo === 'BAJA_CORTESIA' && m.origen?.includes('Cafetería')) ventasHoy += it.cantidad;
            }
          });
        }
      });

      const stockActual = prod.stockCafeteria;
      const stockAnterior = Math.max(0, prod.stockCafeteria - entradasHoy + ventasHoy);

      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition border-b border-slate-100 text-xs';
      tr.innerHTML = `
        <td class="py-3 px-3 font-semibold text-slate-800">${prod.nombre}</td>
        <td class="py-3 px-3 text-center text-slate-600 font-mono">${stockAnterior}</td>
        <td class="py-3 px-3 text-center text-sky-700 font-mono font-bold">${stockActual}</td>
        <td class="py-3 px-3 text-center text-emerald-600 font-mono font-bold">${ventasHoy}</td>
      `;
      tbodyCaf.appendChild(tr);
    });
  }

  const tbodyDep = document.getElementById('tablaDeposito');
  if (tbodyDep) {
    tbodyDep.innerHTML = '';
    const depositoItems = inventario.filter(p => p.tipo !== 'cafe');
    ordenarInventario(depositoItems).forEach(prod => {
      const esCafe = prod.tipo === 'cafe';
      const esInsumo = prod.tipo === 'insumo';
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition border-b border-slate-100 text-xs';
      tr.innerHTML = `
        <td class="py-3 px-3 font-semibold text-slate-800">
          ${prod.nombre} 
          ${esCafe ? `<span class="ml-1 text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-normal">Café (${prod.gramosPorTaza || GRAMOS_POR_CAFE_DEF}g)</span>` : ''}
          ${esInsumo ? `<span class="ml-1 text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-normal">Insumo</span>` : ''}
        </td>
        <td class="py-3 px-3 text-center text-slate-700 font-mono font-bold">${esCafe ? 'N/A' : prod.stockDeposito}</td>
        ${esAdmin ? `<td class="py-3 px-3 text-center thAdminAcciones"><button onclick="eliminarProducto(${prod.id}, '${prod.nombre}')" class="text-rose-500 hover:text-rose-700 bg-rose-50 p-1 rounded transition">🗑️</button></td>` : ''}
      `;
      tbodyDep.appendChild(tr);
    });
  }

  const tbodyTot = document.getElementById('tablaTotal');
  if (tbodyTot) {
    tbodyTot.innerHTML = '';
    const totalItems = inventario.filter(p => p.tipo !== 'insumo' && p.tipo !== 'cafe');
    ordenarInventario(totalItems).forEach(prod => {
      const total = prod.stockDeposito + prod.stockCafeteria;
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition border-b border-slate-100 text-xs';
      tr.innerHTML = `
        <td class="py-3 px-3 font-semibold text-slate-800">${prod.nombre}</td>
        <td class="py-3 px-3 text-center text-slate-500 font-mono">${prod.stockDeposito}</td>
        <td class="py-3 px-3 text-center text-sky-600 font-mono">${prod.stockCafeteria}</td>
        <td class="py-3 px-3 text-right font-extrabold text-slate-900 font-mono">${total}</td>
      `;
      tbodyTot.appendChild(tr);
    });
  }

  const elTotalProd = document.getElementById('statTotalProductos');
  if (elTotalProd) elTotalProd.textContent = inventario.filter(p => p.tipo !== 'insumo' && p.tipo !== 'cafe').length;

  const elTotalPases = document.getElementById('statTotalPases');
  if (elTotalPases) {
    const hoyStr = getFechaHoy();
    elTotalPases.textContent = historialMovimientos.filter(m => m.fechaCorta === hoyStr && (m.tipo.includes('TRASPASO') || m.tipo.includes('INGRESO') || m.tipo.includes('BAJA'))).length;
  }
}

function renderInsumos() {
  const tbodyIns = document.getElementById('tablaInsumos');
  if (!tbodyIns) return;

  const insumos = ordenarInventario(inventario.filter(p => p.tipo === 'insumo'));
  const esAdmin = sessionStorage.getItem('usuarioLogueado')?.trim().toLowerCase() === 'administrador';

  tbodyIns.innerHTML = '';
  if (insumos.length === 0) {
    tbodyIns.innerHTML = `<tr><td colspan="3" class="text-center text-slate-400 py-4 text-xs italic">No hay insumos.</td></tr>`;
    return;
  }

  insumos.forEach(ins => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition border-b border-slate-100 text-xs';
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
  const selIngreso = document.getElementById('selectProductoIngreso');
  const selBaja = document.getElementById('selectProductoBaja');

  if (!selTraspaso || !selIngreso || !selBaja) return;

  selTraspaso.innerHTML = '';
  selIngreso.innerHTML = '';
  selBaja.innerHTML = '';

  const todosOrdenados = ordenarInventario(inventario.filter(p => p.tipo !== 'cafe'));

  todosOrdenados.forEach(prod => {
    const optT = document.createElement('option');
    optT.value = prod.id;
    optT.textContent = `${prod.nombre} (Depósito: ${prod.stockDeposito})`;
    if (prod.stockDeposito <= 0) optT.disabled = true;
    selTraspaso.appendChild(optT);
  });

  todosOrdenados.forEach(prod => {
    const optI = document.createElement('option');
    optI.value = prod.id;
    optI.textContent = prod.nombre;
    selIngreso.appendChild(optI);
  });

  todosOrdenados.forEach(prod => {
    const optJ = document.createElement('option');
    optJ.value = prod.id;
    optJ.textContent = `${prod.nombre} (Dep: ${prod.stockDeposito} | Caf: ${prod.stockCafeteria})`;
    selBaja.appendChild(optJ);
  });
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
        <span class="bg-indigo-950 text-indigo-300 font-bold px-2 py-0.5 rounded border border-indigo-800">+${item.cantidad}</span>
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
    lista.innerHTML = `<p class="text-xs text-slate-400 italic py-2">Ningún ítem agregado.</p>`;
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
        <span class="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">+${item.cantidad}</span>
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
    lista.innerHTML = `<p class="text-xs text-slate-400 italic py-2">Ningún ítem agregado.</p>`;
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
      <span class="text-slate-800 font-medium">${item.nombre} <span class="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded">${item.motivo}</span></span>
      <div class="flex items-center gap-2">
        <span class="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded">-${item.cantidad} (${item.ubicacion})</span>
        <button type="button" onclick="quitarDeBaja(${idx})" class="text-slate-400 hover:text-rose-600 font-bold px-1">✕</button>
      </div>
    `;
    lista.appendChild(div);
  });

  if (resCount) resCount.textContent = `${listaBajaActual.length} tipo(s) | Total: ${totalUnidades}`;
}

function renderCierreTurno() {
  const container = document.getElementById('tablaCierreTurno');
  if (!container) return;

  const productosVisibles = ordenarInventario(inventario.filter(p => p.tipo !== 'insumo' && p.tipo !== 'cafe'));
  container.innerHTML = '';

  productosVisibles.forEach(prod => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition border-b border-slate-100 text-xs';
    tr.innerHTML = `
      <td class="py-2.5 px-3 font-medium text-slate-800">${prod.nombre}</td>
      <td class="py-2.5 px-3 text-center text-sky-700 font-mono font-bold">${prod.stockCafeteria}</td>
      <td class="py-2.5 px-3 text-center text-slate-600 font-mono">${prod.stockDeposito}</td>
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
  texto += `*STOCK EN VITRINA/CAFETERÍA:*\n`;

  const productosVisibles = ordenarInventario(inventario.filter(p => p.tipo !== 'insumo' && p.tipo !== 'cafe'));
  productosVisibles.forEach(prod => {
    texto += `• ${prod.nombre}: *${prod.stockCafeteria} unids*\n`;
  });

  navigator.clipboard.writeText(texto).then(() => {
    alert("✅ ¡Reporte copiado al portapapeles!");
  });
};

function renderReporteExcel() {
  const tbody = document.getElementById('tablaReporteExcel');
  if (!tbody) return;

  const inputDesde = document.getElementById('filtroFechaDesde');
  const inputHasta = document.getElementById('filtroFechaHasta');

  const hoyIso = new Date().toISOString().split('T')[0];
  if (inputDesde && !inputDesde.value) inputDesde.value = hoyIso;
  if (inputHasta && !inputHasta.value) inputHasta.value = hoyIso;

  const desdeVal = inputDesde ? inputDesde.value : hoyIso;
  const hastaVal = inputHasta ? inputHasta.value : hoyIso;

  const movsFiltrados = historialMovimientos.filter(m => {
    const partes = (m.fechaCorta || '').split('/');
    if (partes.length !== 3) return false;
    const isoFecha = `${partes[2]}-${partes[1]}-${partes[0]}`;
    return isoFecha >= desdeVal && isoFecha <= hastaVal;
  });

  tbody.innerHTML = '';
  if (movsFiltrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-slate-400 py-4 text-xs italic">No hay movimientos en este rango.</td></tr>`;
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
    alert("No hay datos para exportar.");
    return;
  }

  let csvContent = "\uFEFFFecha,Tipo Movimiento,Usuario,Origen,Producto,Cantidad\n";
  movsFiltrados.forEach(reg => {
    if (reg.items) {
      reg.items.forEach(it => {
        csvContent += `"${reg.fechaCorta}","${reg.tipo}","${reg.usuario}","${reg.origen || ''}","${it.nombre}",${it.cantidad}\n`;
      });
    }
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Reporte_${desdeVal}_al_${hastaVal}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// --- BITÁCORA DE MOVIMIENTOS (Con anulación de ítems individuales) ---
function renderHistorial() {
  const contenedor = document.getElementById('contenedorHistorial');
  const empty = document.getElementById('emptyHistorial');
  if (!contenedor) return;

  contenedor.innerHTML = '';
  
  const movsBitacora = historialMovimientos.filter(m => {
    const tipo = (m.tipo || '').toUpperCase();
    return tipo.includes('TRASPASO') || tipo.includes('INGRESO') || tipo.includes('BAJA');
  });

  if (movsBitacora.length === 0) {
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  const gruposTurno = {};
  movsBitacora.forEach(reg => {
    const clave = `${reg.fechaCorta}_${reg.usuario}`;
    if (!gruposTurno[clave]) {
      gruposTurno[clave] = {
        fechaCorta: reg.fechaCorta,
        usuario: reg.usuario,
        registros: []
      };
    }
    gruposTurno[clave].registros.push(reg);
  });

  Object.values(gruposTurno).forEach(grupo => {
    const card = document.createElement('div');
    card.className = 'bg-white border border-slate-200 rounded-xl p-3 space-y-3 shadow-sm text-xs';
    
    grupo.registros.sort((a, b) => a.id - b.id);

    let contenidoRegistrosHTML = '';
    grupo.registros.forEach(reg => {
      const horaMovimiento = reg.fecha ? reg.fecha.split(' - ')[1] || '' : '';
      const usuarioLogueado = sessionStorage.getItem('usuarioLogueado');
      const esAdmin = usuarioLogueado?.toLowerCase() === 'administrador';
      const puedeBorrar = esAdmin || reg.usuario === usuarioLogueado;

      const itemsHTML = reg.items ? reg.items.map((it, idxIt) => `
        <div class="flex justify-between items-center py-1 border-b border-slate-100 last:border-0">
          <span class="text-slate-800">${it.nombre}</span>
          <div class="flex items-center gap-2">
            <span class="font-bold text-sky-600">${it.cantidad}</span>
            ${puedeBorrar ? `<button onclick="anularItemMovimiento('${reg._firebaseKey}',${idxIt})" class="text-rose-500 hover:text-rose-700 text-[10px] font-bold px-1 rounded bg-rose-50" title="Eliminar este ítem">✕</button>` : ''}
          </div>
        </div>
      `).join('') : '';

      contenidoRegistrosHTML += `
        <div class="bg-slate-50 border border-slate-100 rounded-lg p-2.5 space-y-1.5">
          <div class="flex justify-between items-center border-b border-slate-200/60 pb-1">
            <span class="font-bold px-1.5 py-0.5 rounded text-[10px] bg-sky-100 text-sky-800">${reg.tipo}</span>
            <div class="flex items-center gap-2">
              <span class="text-[10px] text-slate-500 font-mono">⏰ ${horaMovimiento} | ${reg.origen || ''}</span>
              ${puedeBorrar ? `<button onclick="anularMovimientoBitacora('${reg._firebaseKey}', '${reg.usuario}')" class="text-rose-500 hover:text-rose-700 text-xs font-bold px-1.5 py-0.5 rounded bg-rose-50 transition" title="Anular todo este bloque">❌ Anular</button>` : ''}
            </div>
          </div>
          <div class="space-y-0.5">${itemsHTML}</div>
        </div>
      `;
    });

    card.innerHTML = `
      <div class="flex justify-between items-center border-b border-slate-200 pb-2">
        <span class="font-bold text-slate-900 flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span> 
          Turno / Movimientos de ${grupo.usuario}
        </span>
        <span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-bold">${grupo.fechaCorta}</span>
      </div>
      <div class="space-y-2">
        ${contenidoRegistrosHTML}
      </div>
    `;
    contenedor.appendChild(card);
  });
}

function iniciarApp() {
  configurarModalLogin();
  configurarSelectorTipoProducto();
  verificarSesion();

  const radioTabs = document.querySelectorAll('input[name="seccion"]');
  const tituloEl = document.getElementById('tituloSeccion');

  const titulosMap = {
    'tab-stock': 'Stock Depósito y Vitrina',
    'tab-total': 'Inventario Total Consolidado',
    'tab-transferencia': 'Traspaso (Depósito ➔ Cafetería)',
    'tab-barra': 'Ventas de Barra',
    'tab-tickets': 'Recibos / Tickets',
    'tab-ingreso': 'Ingreso de Mercadería',
    'tab-insumos': 'Insumos y Depósito Puro',
    'tab-bajas': 'Bajas, Mermas y Cortesías',
    'tab-cierre': 'Planilla Cierre de Turno',
    'tab-reportes': 'Reportes e Historial (Excel)',
    'tab-nuevo_prod': 'Nuevo Producto (Admin)',
    'tab-historial': 'Bitácora de Movimientos'
  };

  radioTabs.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked && tituloEl && titulosMap[e.target.id]) {
        tituloEl.textContent = titulosMap[e.target.id];
      }
    });
  });

  document.getElementById('btnGuardarNuevoProd')?.addEventListener('click', guardarProductoNuevo);
  document.getElementById('btnAgregarATraspaso')?.addEventListener('click', agregarATraspaso);
  document.getElementById('btnConfirmarTraspaso')?.addEventListener('click', confirmarTraspasoMultiple);
  document.getElementById('btnEmitirTicketVenta')?.addEventListener('click', emitirTicketVenta);
  document.getElementById('btnAgregarAIngreso')?.addEventListener('click', agregarAIngreso);
  document.getElementById('btnGuardarIngreso')?.addEventListener('click', confirmarIngresoStockMultiple);
  document.getElementById('btnAgregarABaja')?.addEventListener('click', agregarABaja);
  document.getElementById('btnGuardarBajas')?.addEventListener('click', confirmarBajasMultiple);
  document.getElementById('btnCopiarWhatsApp')?.addEventListener('click', copiarReporteWhatsApp);
  document.getElementById('btnDescargarExcel')?.addEventListener('click', descargarExcelMovimientos);
  document.getElementById('filtroFechaDesde')?.addEventListener('change', renderReporteExcel);
  document.getElementById('filtroFechaHasta')?.addEventListener('change', renderReporteExcel);
}

window.addEventListener('DOMContentLoaded', iniciarApp);
