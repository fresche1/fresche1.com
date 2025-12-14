# app.js - Documentación Técnica Completa

## Descripción General

`app.js` contiene la **lógica completa** de la aplicación AirbnbManager (439 líneas).

---

## 📊 Estructura del Archivo

### 1. VARIABLES GLOBALES (Líneas 1-6)

```javascript
let currentUser = null;           // Usuario autenticado
let currentUserType = null;       // 'owner' | 'employee'
let selectedProperty = null;      // ID de propiedad activa
let properties = {};              // Base de datos de propiedades
let employees = {};               // Base de datos de empleados
```

### 2. INICIALIZACIÓN (Líneas 8-20)

```javascript
function initializeApp() {
    const saved = localStorage.getItem('airbnbManagerData');
    if (saved) {
        const data = JSON.parse(saved);
        properties = data.properties || {};
        employees = data.employees || {};
    }
}
```
**Propósito:** Cargar datos guardados desde localStorage al abrir la app.

### 3. PERSISTENCIA (Líneas 22-26)

```javascript
function saveData() {
    localStorage.setItem('airbnbManagerData', JSON.stringify({ properties, employees }));
}
```
**Propósito:** Guardar cambios en localStorage automáticamente.

---

## 🔐 SECCIÓN DE LOGIN (Líneas 28-91)

### 3.1 updateLoginForm() - Líneas 29-33
```javascript
function updateLoginForm() {
    const userType = document.getElementById('userType').value;
    document.getElementById('ownerCodeGroup').style.display = userType === 'owner' ? 'block' : 'none';
    document.getElementById('propertyCodeGroup').style.display = userType === 'employee' ? 'block' : 'none';
}
```
**Propósito:** Mostrar/ocultar campos dinámicamente según tipo de usuario seleccionado.

### 3.2 login() - Líneas 35-91
Función principal de autenticación con dos ramas:

#### Para Dueños:
```javascript
if (userType === 'owner') {
    // Validar código de dueño
    // Crear objeto currentUser con type:'owner'
    // Llamar showOwnerView()
}
```

#### Para Empleados:
```javascript
else if (userType === 'employee') {
    // Buscar propiedad con código ingresado
    // Validar que exista
    // Crear objeto currentUser con type:'employee' y propertyId
    // Llamar showEmployeeView()
}
```

### 3.3 logout() - Líneas 93-107
```javascript
function logout() {
    currentUser = null;
    currentUserType = null;
    selectedProperty = null;
    // Limpiar vistas
    // Limpiar formularios
    // Mostrar loginView
}
```
**Propósito:** Cerrar sesión y volver a pantalla de login.

---

## 🏠 SECCIÓN DUEÑO (Líneas 109-230)

### 4.1 showOwnerView() - Líneas 110-123
```javascript
function showOwnerView() {
    document.getElementById('loginView').style.display = 'none';
    document.getElementById('ownerView').style.display = 'block';
    document.getElementById('ownerName').textContent = currentUser.name;
    renderProperties();
    // Seleccionar primera propiedad automáticamente
    // Actualizar contenido
}
```

### 4.2 renderProperties() - Líneas 125-135
```javascript
function renderProperties() {
    const list = document.getElementById('propertiesList');
    list.innerHTML = '';
    
    for (let propId in properties) {
        // Crear botón por propiedad
        // Mostrar nombre
        // Marcar como "active" si está seleccionada
    }
}
```

### 4.3 selectProperty(propId) - Líneas 137-142
```javascript
function selectProperty(propId) {
    selectedProperty = propId;
    renderProperties();
    refreshOwnerContent();
}
```
**Propósito:** Cambiar propiedad activa y actualizar vistas.

### 4.4 showAddProperty() / closeModal() - Líneas 144-149
```javascript
function showAddProperty() {
    document.getElementById('addPropertyModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('addPropertyModal').style.display = 'none';
    // Limpiar inputs
}
```

### 4.5 saveProperty() - Líneas 151-173
```javascript
function saveProperty() {
    const name = document.getElementById('propertyNameInput').value.trim();
    const address = document.getElementById('propertyAddressInput').value.trim();
    
    // Validar campos
    // Generar ID único (timestamp)
    // Generar código único (8 caracteres)
    // Crear objeto propiedad
    // Guardar en properties
    // Actualizar UI
}
```

**Estructura de Propiedad:**
```javascript
{
    id: "prop_1703000000000",
    name: "Casa Playa",
    address: "Calle 1 No. 100",
    code: "ABC12345",
    inventory: [],
    tasks: [],
    createdAt: Date
}
```

### 4.6 refreshOwnerContent() - Líneas 175-185
```javascript
function refreshOwnerContent() {
    if (!selectedProperty) return;
    
    const prop = properties[selectedProperty];
    // Actualizar títulos
    // Llamar renderInventory()
    // Llamar renderTasks()
    // Llamar renderEmployees()
}
```

---

## 📦 SECCIÓN INVENTARIO (Líneas 187-217)

### 5.1 addInventory() - Líneas 188-206
```javascript
function addInventory() {
    if (!selectedProperty) return;
    
    const input = document.getElementById('inventoryInput');
    const text = input.value.trim();
    
    // Validar
    // Crear objeto item
    // Agregar a properties[selectedProperty].inventory
    // Guardar en localStorage
    // Limpiar input
    // Renderizar
}
```

**Estructura de Item:**
```javascript
{
    id: "inv_1703000000000",
    text: "2 Almohadas",
    completed: false,
    createdAt: Date
}
```

### 5.2 renderInventory() - Líneas 208-223
```javascript
function renderInventory() {
    // Para cada elemento del inventario
    // Crear elemento <li>
    // Mostrar texto
    // Mostrar botón eliminar
}
```

### 5.3 deleteInventory(itemId) - Líneas 225-230
```javascript
function deleteInventory(itemId) {
    // Filtrar elemento de array
    // Guardar cambios
    // Renderizar
}
```

---

## ✓ SECCIÓN TAREAS (Líneas 232-306)

### 6.1 addTask() - Líneas 233-257
```javascript
function addTask() {
    // Validar inputs
    // Crear objeto tarea con:
    //   - id único
    //   - texto
    //   - assignedTo (nombre empleado)
    //   - status: 'pending'
    //   - timestamps
    // Guardar y renderizar
}
```

**Estructura de Tarea:**
```javascript
{
    id: "task_1703000000000",
    text: "Limpiar cocina",
    assignedTo: "María Pérez",
    status: "pending",
    createdAt: Date,
    completedAt: null
}
```

### 6.2 renderTasks() - Líneas 259-289
```javascript
function renderTasks() {
    // Para cada tarea
    // Mostrar título
    // Mostrar empleado asignado
    // Mostrar badge de estado:
    //   - 'pending' → amarillo "⏳ Pendiente"
    //   - 'completed' → verde "✓ Completada"
    // Mostrar botón eliminar
}
```

### 6.3 deleteTask(taskId) - Líneas 291-296
```javascript
function deleteTask(taskId) {
    // Filtrar tarea
    // Guardar
    // Renderizar
}
```

### 6.4 completeTask(taskId) - Líneas 369-377 (desde empleado)
```javascript
function completeTask(taskId) {
    const tasks = properties[currentUser.propertyId].tasks;
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.status = 'completed';
        task.completedAt = new Date();
        saveData();
        renderEmployeeTasks();
    }
}
```

---

## 👥 SECCIÓN EMPLEADOS (Líneas 298-324)

### 7.1 renderEmployees() - Líneas 298-324
```javascript
function renderEmployees() {
    // Para cada empleado en employees
    // Agregar a <select> de "Asignar a..."
    // Crear <div> con card de empleado
    // Mostrar nombre
    // Mostrar última conexión
}
```

**Estructura de Empleado:**
```javascript
{
    name: "María Pérez",
    propertyId: "prop_id",
    loginTime: "ISO timestamp",
    lastLoginTime: "ISO timestamp"
}
```

---

## 👨‍💼 SECCIÓN VISTA EMPLEADO (Líneas 326-378)

### 8.1 showEmployeeView() - Líneas 327-350
```javascript
function showEmployeeView() {
    // Mostrar vista empleado
    // Mostrar nombre de empleado
    // Guardar empleado en employees{}
    // Actualizar lastLoginTime
    // Mostrar hora de ingreso
    // Mostrar propiedad asignada
    // Renderizar inventario
    // Renderizar tareas
}
```

### 8.2 renderEmployeeInventory() - Líneas 352-363
```javascript
function renderEmployeeInventory() {
    // Mostrar inventario de propiedad asignada
    // Solo lectura (sin botones de eliminar)
    // Cada elemento como <li>
}
```

### 8.3 renderEmployeeTasks() - Líneas 365-378
```javascript
function renderEmployeeTasks() {
    // Filtrar tareas.assignedTo === currentUser.name
    // Por cada tarea:
    //   - Mostrar título
    //   - Mostrar estado
    //   - Si status='pending' → mostrar "Marcar Completa"
    //   - Si status='completed' → no mostrar botón
}
```

---

## 🚀 EVENT LISTENERS (Línea 380)

```javascript
window.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});
```

**Propósito:** Cargar datos al abrir la página.

---

## 📋 Mapa de Flujo

### Login → Dueño:
```
login()
  ├─ Validar credenciales
  ├─ Crear currentUser
  ├─ showOwnerView()
  ├─ renderProperties()
  ├─ selectProperty() (primera)
  └─ refreshOwnerContent()
      ├─ renderInventory()
      ├─ renderTasks()
      └─ renderEmployees()
```

### Login → Empleado:
```
login()
  ├─ Buscar propiedad por código
  ├─ Crear currentUser
  ├─ showEmployeeView()
  ├─ Guardar en employees{}
  ├─ renderEmployeeInventory()
  └─ renderEmployeeTasks()
```

### Crear Tarea:
```
addTask()
  ├─ Validar
  ├─ Crear objeto
  ├─ properties[selectedProperty].tasks.push()
  ├─ saveData()
  └─ renderTasks()
```

### Completar Tarea (Empleado):
```
completeTask()
  ├─ Buscar tarea
  ├─ task.status = 'completed'
  ├─ saveData()
  └─ renderEmployeeTasks()
```

---

## 💾 localStorage Schema

```json
{
  "properties": {
    "prop_123456": {
      "id": "prop_123456",
      "name": "Casa Playa",
      "address": "Calle 1 No. 100",
      "code": "ABC12345",
      "inventory": [
        {
          "id": "inv_111",
          "text": "2 Almohadas",
          "completed": false,
          "createdAt": "2024-01-01T10:30:00.000Z"
        }
      ],
      "tasks": [
        {
          "id": "task_222",
          "text": "Limpiar cocina",
          "assignedTo": "María Pérez",
          "status": "pending",
          "createdAt": "2024-01-01T10:30:00.000Z",
          "completedAt": null
        }
      ],
      "createdAt": "2024-01-01T10:00:00.000Z"
    }
  },
  "employees": {
    "María Pérez": {
      "name": "María Pérez",
      "propertyId": "prop_123456",
      "loginTime": "2024-01-01T10:30:00.000Z",
      "lastLoginTime": "2024-01-01T10:30:00.000Z"
    }
  }
}
```

---

## 🔧 Funciones de Utilidad

| Función | Propósito | Tipo |
|---------|-----------|------|
| `initializeApp()` | Cargar datos al iniciar | Init |
| `saveData()` | Guardar a localStorage | Util |
| `updateLoginForm()` | Mostrar/ocultar campos | UI |
| `refreshOwnerContent()` | Actualizar panel dueño | UI |

---

## 🔄 Orden de Ejecución

1. **Página carga** → DOMContentLoaded dispara `initializeApp()`
2. **Usuario selecciona tipo** → `updateLoginForm()`
3. **Usuario hace click login** → `login()`
4. **Si es dueño** → `showOwnerView()` → `renderProperties()` → etc
5. **Si es empleado** → `showEmployeeView()` → `renderEmployeeTasks()` → etc
6. **Usuario hace clic agregar tarea** → `addTask()` → `saveData()` → `renderTasks()`
7. **Usuario hace clic salir** → `logout()`

---

## 📝 Líneas por Sección

| Sección | Líneas | Funciones |
|---------|--------|-----------|
| Variables | 1-6 | - |
| Init/Save | 8-26 | 2 |
| Login | 28-107 | 3 |
| Owner View | 109-230 | 7 |
| Inventory | 187-230 | 3 |
| Tasks | 232-306 | 4 |
| Employees | 298-324 | 1 |
| Employee View | 326-378 | 3 |
| Event Listeners | 380-383 | 1 |
| **TOTAL** | **439** | **24** |

---

## ✅ Validaciones Implementadas

- ✅ Campo de usuario vacío
- ✅ Campo de código vacío
- ✅ Código de propiedad válido
- ✅ Propiedad seleccionada antes de operación
- ✅ Elementos no vacíos
- ✅ Empleado seleccionado para tarea
- ✅ localStorage disponible

---

## 🎯 Funciones Llamadas desde HTML

Desde `index.html` se llaman estas funciones (con `onclick`):

```html
onclick="updateLoginForm()"           <!-- user type change -->
onclick="login()"                     <!-- login button -->
onclick="logout()"                    <!-- logout button -->
onclick="showAddProperty()"           <!-- add property button -->
onclick="closeModal()"                <!-- close modal -->
onclick="saveProperty()"              <!-- save property button -->
onclick="selectProperty(propId)"      <!-- select property -->
onclick="addInventory()"              <!-- add inventory -->
onclick="deleteInventory(itemId)"     <!-- delete inventory -->
onclick="addTask()"                   <!-- create task -->
onclick="deleteTask(taskId)"          <!-- delete task -->
onclick="completeTask(taskId)"        <!-- complete task (employee) -->
```

---

## 🚀 Próximas Mejoras Opcionales

- [ ] Agregar autenticación real con hash de contraseña
- [ ] Backend servidor para persistencia real
- [ ] API REST para comunicación
- [ ] WebSockets para sincronización real-time
- [ ] Sistema de notificaciones
- [ ] Estadísticas y reportes
- [ ] Exportar datos a CSV/PDF
- [ ] Fotos de inventario
- [ ] Sistema de comentarios
- [ ] Auditoría de cambios

---

**Archivo:** app.js
**Líneas:** 439
**Funciones:** 24
**Status:** ✅ Completado
**Última actualización:** Diciembre 2024
