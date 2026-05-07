/* ============================================
   CALCULADORA PWA — app.js
   Lógica de la calculadora + registro del
   Service Worker + detección offline.
   ============================================ */


/* ==========================================
   1. REGISTRO DEL SERVICE WORKER (PWA)
   Esto es lo que convierte nuestra web en PWA.
   Se registra solo si el navegador lo soporta.
   ========================================== */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('sw.js')
      .then(registration => {
        console.log('[PWA] Service Worker registrado con éxito.');
        console.log('[PWA] Scope:', registration.scope);
      })
      .catch(error => {
        console.error('[PWA] Error al registrar el Service Worker:', error);
      });
  });
}


/* ==========================================
   2. DETECCIÓN OFFLINE / ONLINE (PWA)
   Escuchamos eventos de red para mostrar
   el estado en la interfaz.
   ========================================== */
const statusBadge = document.getElementById('statusBadge');
const statusText  = document.getElementById('statusText');

function actualizarEstadoRed() {
  if (navigator.onLine) {
    statusBadge.classList.remove('offline');
    statusText.textContent = 'Online';
  } else {
    statusBadge.classList.add('offline');
    statusText.textContent = 'Offline — usando caché';
  }
}

window.addEventListener('online',  actualizarEstadoRed);
window.addEventListener('offline', actualizarEstadoRed);
actualizarEstadoRed(); // Ejecutar al cargar


/* ==========================================
   3. PROMPT DE INSTALACIÓN (PWA)
   El navegador dispara 'beforeinstallprompt'
   cuando la PWA es instalable. Lo capturamos
   para mostrar nuestro propio botón.
   ========================================== */
let installPrompt = null;
const installBtn  = document.getElementById('installBtn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();           // Evitar el popup automático del browser
  installPrompt = e;            // Guardar el evento para usarlo después
  installBtn.style.display = 'block'; // Mostrar nuestro botón
  console.log('[PWA] App lista para instalar.');
});

installBtn.addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();       // Mostrar el diálogo de instalación
  const { outcome } = await installPrompt.userChoice;
  console.log('[PWA] Usuario eligió:', outcome); // 'accepted' o 'dismissed'
  installPrompt = null;
  installBtn.style.display = 'none';
});

// Cuando la app se instala, ocultar el botón
window.addEventListener('appinstalled', () => {
  installBtn.style.display = 'none';
  console.log('[PWA] ¡App instalada exitosamente!');
});


/* ==========================================
   4. LÓGICA DE LA CALCULADORA
   Estado de la calculadora y manejadores
   de eventos para cada botón.
   ========================================== */

// Estado interno de la calculadora
const estado = {
  resultado:       '0',   // Número en pantalla
  operador:        null,   // Operador pendiente (+, -, ×, ÷)
  primerOperando:  null,   // Primer número guardado
  esperarSegundo:  false,  // ¿Esperamos el segundo número?
  expresion:       '',     // Texto de la expresión (fila superior)
};

// Referencias al DOM
const displayResultado  = document.getElementById('result');
const displayExpresion  = document.getElementById('expression');

// Actualizar pantalla
function actualizarPantalla() {
  displayResultado.textContent = estado.resultado;
  displayExpresion.textContent = estado.expresion;
}

// Animar el resultado (pequeño "pop")
function animarResultado() {
  displayResultado.classList.remove('pop');
  void displayResultado.offsetWidth; // reflow para reiniciar animación
  displayResultado.classList.add('pop');
  setTimeout(() => displayResultado.classList.remove('pop'), 150);
}

// ---- Acciones de los botones ----

// Ingresa un dígito
function ingresarNumero(valor) {
  if (estado.esperarSegundo) {
    estado.resultado     = valor;
    estado.esperarSegundo = false;
  } else {
    // Máximo 10 dígitos en pantalla
    if (estado.resultado.length >= 10 && valor !== '.') return;
    estado.resultado = estado.resultado === '0' ? valor : estado.resultado + valor;
  }
  actualizarPantalla();
}

// Ingresa punto decimal
function ingresarDecimal() {
  if (estado.esperarSegundo) {
    estado.resultado      = '0.';
    estado.esperarSegundo  = false;
    actualizarPantalla();
    return;
  }
  if (!estado.resultado.includes('.')) {
    estado.resultado += '.';
    actualizarPantalla();
  }
}

// Selecciona un operador
function ingresarOperador(op) {
  const actual = parseFloat(estado.resultado);

  // Si ya hay un operador y seguimos operando, calculamos primero
  if (estado.operador && estado.esperarSegundo) {
    estado.operador = op;
    estado.expresion = `${estado.primerOperando} ${op}`;
    actualizarPantalla();
    return;
  }

  if (estado.primerOperando !== null && !estado.esperarSegundo) {
    const res = calcular(estado.primerOperando, actual, estado.operador);
    estado.resultado = formatear(res);
    estado.primerOperando = res;
  } else {
    estado.primerOperando = actual;
  }

  estado.operador      = op;
  estado.esperarSegundo = true;
  estado.expresion     = `${formatear(estado.primerOperando)} ${op}`;

  // Resaltar botón activo
  document.querySelectorAll('.btn-op').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.btn-op').forEach(b => {
    if (b.dataset.value === op) b.classList.add('active');
  });

  actualizarPantalla();
}

// Calcula el resultado final
function calcularResultado() {
  if (!estado.operador || estado.primerOperando === null) return;

  const segundo = parseFloat(estado.resultado);
  const res     = calcular(estado.primerOperando, segundo, estado.operador);

  estado.expresion      = `${formatear(estado.primerOperando)} ${estado.operador} ${formatear(segundo)} =`;
  estado.resultado      = formatear(res);
  estado.primerOperando = null;
  estado.operador       = null;
  estado.esperarSegundo  = false;

  document.querySelectorAll('.btn-op').forEach(b => b.classList.remove('active'));
  animarResultado();
  actualizarPantalla();
}

// Operación aritmética pura
function calcular(a, b, op) {
  switch (op) {
    case '+': return a + b;
    case '−': return a - b;
    case '×': return a * b;
    case '÷': return b !== 0 ? a / b : 'Error';
    default:  return b;
  }
}

// Formatea el número para la pantalla (evita decimales infinitos)
function formatear(num) {
  if (num === 'Error') return 'Error';
  if (Number.isInteger(num)) return String(num);
  return parseFloat(num.toFixed(8)).toString();
}

// AC: limpiar todo
function limpiar() {
  estado.resultado      = '0';
  estado.operador       = null;
  estado.primerOperando  = null;
  estado.esperarSegundo  = false;
  estado.expresion      = '';
  document.querySelectorAll('.btn-op').forEach(b => b.classList.remove('active'));
  actualizarPantalla();
}

// +/-: cambiar signo
function cambiarSigno() {
  estado.resultado = formatear(parseFloat(estado.resultado) * -1);
  actualizarPantalla();
}

// %: convertir a porcentaje
function porcentaje() {
  estado.resultado = formatear(parseFloat(estado.resultado) / 100);
  actualizarPantalla();
}


/* ==========================================
   5. MANEJO DE EVENTOS DEL TECLADO
   Los botones del keypad escuchan clicks.
   También soportamos el teclado físico.
   ========================================== */

// Escuchar clicks en todos los botones
document.querySelectorAll('.btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const { action, value } = btn.dataset;
    switch (action) {
      case 'number':   ingresarNumero(value);   break;
      case 'operator': ingresarOperador(value); break;
      case 'decimal':  ingresarDecimal();        break;
      case 'equals':   calcularResultado();      break;
      case 'clear':    limpiar();                break;
      case 'sign':     cambiarSigno();           break;
      case 'percent':  porcentaje();             break;
    }
  });
});

// Soporte de teclado físico
document.addEventListener('keydown', (e) => {
  if (e.key >= '0' && e.key <= '9') ingresarNumero(e.key);
  else if (e.key === '.')           ingresarDecimal();
  else if (e.key === '+')           ingresarOperador('+');
  else if (e.key === '-')           ingresarOperador('−');
  else if (e.key === '*')           ingresarOperador('×');
  else if (e.key === '/')           { e.preventDefault(); ingresarOperador('÷'); }
  else if (e.key === 'Enter' || e.key === '=') calcularResultado();
  else if (e.key === 'Escape')      limpiar();
  else if (e.key === 'Backspace') {
    // Borrar último dígito
    if (estado.resultado.length > 1) {
      estado.resultado = estado.resultado.slice(0, -1);
    } else {
      estado.resultado = '0';
    }
    actualizarPantalla();
  }
});

// Pantalla inicial
actualizarPantalla();
console.log('[App] Calculadora PWA lista 🚀');
