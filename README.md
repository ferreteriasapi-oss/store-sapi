# STORE SAPI - Control de Almacén

Aplicación web móvil-primero diseñada para el control ágil de inventarios, transacciones de venta e histórico de consumo en almacenes de construcción. 

Desarrollada utilizando **HTML5 semántico, CSS3 Vanilla con tema oscuro-industrial y Javascript modular (ESM)**. Conectada en tiempo real con **Firebase Cloud Firestore y Google Authentication**.

---

## 🛠️ Configuración de Firebase

Para que la aplicación funcione a la perfección con tu base de datos en tiempo real y el login de Google, asegúrate de tener configurado lo siguiente en tu [Firebase Console](https://console.firebase.google.com/):

### 1. Métodos de Inicio de Sesión (Authentication)
*   Ve a **Authentication** > **Sign-in method**.
*   Activa el proveedor de **Google**.
*   Configura tu correo de soporte y haz clic en **Guardar**.

### 2. Reglas de Seguridad de Firestore Database
Para permitir que los operadores autenticados puedan leer y escribir en el inventario y movimientos de forma segura, ve a **Firestore Database** > **Reglas** (Rules) y pega las siguientes reglas:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Regla para el catálogo de productos e histórico de movimientos
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

*Estas reglas aseguran que solo las personas que hayan iniciado sesión mediante Google puedan interactuar con los datos de tu almacén.*

---

## 🚀 ¿Cómo Ejecutar el Proyecto Localmente?

La aplicación está diseñada bajo una arquitectura estática moderna (Jamstack) por lo que no necesita compilación ni Node.js.

### Método Rápido (Recomendado)
Puedes abrir directamente el archivo `index.html` en un servidor local para habilitar las funcionalidades web de redirección y cookies de Firebase:

1.  Abre Visual Studio Code o tu editor preferido en la carpeta `store-sapi`.
2.  Si usas VS Code, instala la extensión **Live Server**.
3.  Haz clic derecho en `index.html` y selecciona **Open with Live Server**.
4.  La app se abrirá automáticamente en tu navegador (ej. `http://127.5.0.1:5500`).

---

## 📱 Funcionalidades Clave Implementadas

1.  **Dashboard de Métricas**:
    *   **Recaudo de Ventas Mensual**: Suma en tiempo real el dinero generado por operaciones del tipo `sale` registradas durante el mes actual.
    *   **Alerta de Stock Bajo**: Indicador numérico dinámico y lista roja con los productos cuyo stock se encuentra igual o menor que su cantidad mínima (1 por defecto).
2.  **Operaciones Rápidas**:
    *   **Venta Rápida** (`sale`): Modifica el stock, registra el precio unitario pactado en esa transacción y acumula al recaudo mensual.
    *   **Consumo Interno** (`consumption`): Descarga stock para uso en obras/sectores sin asociar un valor comercial de venta.
    *   **Ingresar Stock** (`entry`): Abastece el almacén sumando cantidades al stock disponible.
3.  **Auditoría Integral Universal (Log)**:
    *   Cada movimiento de inventario (venta, consumo, ingreso) almacena obligatoriamente:
        *   **Operador**: Nombre y correo de la cuenta de Google que lo registró.
        *   **Equipo / Dispositivo**: Detección inteligente del tipo de dispositivo y navegador (ej. *"Móvil iOS (Safari en iOS)"* o *"Escritorio (Chrome en Windows)"*).
4.  **Diseño Industrial Premium**:
    *   Tema oscuro basado en tonos HSL de alta legibilidad en campos de construcción.
    *   Interfaz móvil-primero con navegación por pestañas en la parte inferior para emular la experiencia de una aplicación nativa.
