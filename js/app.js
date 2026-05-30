// Import Firebase services from our configuration
import { auth, db, googleProvider } from "./firebase-config.js";
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  collection, 
  addDoc, 
  setDoc,
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  runTransaction,
  serverTimestamp,
  getDoc,
  getDocs,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ==========================================================================
// APP STATE & CONSTANTS
// ==========================================================================
let currentUser = null;
let productsMap = new Map(); // Key: productId, Value: product object
let allMovements = []; // Array of all movements fetched
let activeView = "dashboard";
let activeMovementFilter = "all";

// DOM Elements
const loadingOverlay = document.getElementById("loading-overlay");
const loginSection = document.getElementById("login-section");
const appShell = document.getElementById("app-shell");
const googleLoginBtn = document.getElementById("google-login-btn");
const logoutBtn = document.getElementById("logout-btn");

const userNameEl = document.getElementById("user-name");
const userEmailEl = document.getElementById("user-email");
const userPhotoEl = document.getElementById("user-photo");

const navItems = document.querySelectorAll(".nav-item");
const appViews = document.querySelectorAll(".app-view");
const navAdminBtn = document.getElementById("nav-admin");

// Admin Panel Elements
const usersTableBody = document.getElementById("users-table-body");
const usersEmptyState = document.getElementById("users-empty-state");
const btnAddUser = document.getElementById("btn-add-user");
const modalUser = document.getElementById("modal-user");
const formUser = document.getElementById("form-user");
const userEmailInput = document.getElementById("user-email-input");
const userRoleSelect = document.getElementById("user-role-select");

// Dashboard metrics
const metricMonthlySales = document.getElementById("metric-monthly-sales");
const metricAlertsCount = document.getElementById("metric-alerts-count");
const metricProductsCount = document.getElementById("metric-products-count");
const dashboardAlertsList = document.getElementById("dashboard-alerts-list");

// Quick Actions
const btnQuickSale = document.getElementById("btn-quick-sale");
const btnQuickConsumption = document.getElementById("btn-quick-consumption");
const btnQuickEntry = document.getElementById("btn-quick-entry");

// Inventory elements
const btnAddProduct = document.getElementById("btn-add-product");
const productsContainer = document.getElementById("products-container");
const inventorySearch = document.getElementById("inventory-search");
const inventoryFilterCategory = document.getElementById("inventory-filter-category");

// Movements elements
const movementsTableBody = document.getElementById("movements-table-body");
const movementsEmptyState = document.getElementById("movements-empty-state");
const movementsSearch = document.getElementById("movements-search");
const movementNavTabs = document.querySelectorAll(".movement-nav-tab");

// Modals & Forms
const modalProduct = document.getElementById("modal-product");
const formProduct = document.getElementById("form-product");
const modalProductTitle = document.getElementById("modal-product-title");
const productIdInput = document.getElementById("product-id");
const initialStockGroup = document.getElementById("product-initial-stock-group");

const modalMovement = document.getElementById("modal-movement");
const formMovement = document.getElementById("form-movement");
const modalMovementTitle = document.getElementById("modal-movement-title");
const movementTypeInput = document.getElementById("movement-type");
const movementProductIdSelect = document.getElementById("movement-product-id");
const movementQuantityInput = document.getElementById("movement-quantity");
const movementPriceGroup = document.getElementById("movement-price-group");
const movementPriceInput = document.getElementById("movement-price");
const movementStockInfo = document.getElementById("movement-stock-info");
const currentStockBadge = document.getElementById("current-stock-badge");
const currentUnitBadge = document.getElementById("current-unit-badge");
const movementDetailsLabel = document.getElementById("movement-details-label");
const movementDetailsInput = document.getElementById("movement-details-input");
const btnSubmitMovement = document.getElementById("btn-submit-movement");

// Close buttons for modals
const closeModalButtons = document.querySelectorAll(".btn-close-modal");

// ==========================================================================
// AUTHENTICATION & INITIALIZATION
// ==========================================================================

// Check Auth State
onAuthStateChanged(auth, async (user) => {
  if (user) {
    loadingOverlay.classList.remove("hidden");
    
    // Seed admin users if collection is empty
    await seedInitialUsers();

    // Verify authorization
    const isAuthorized = await checkUserAuthorization(user.email);
    
    if (!isAuthorized) {
      await signOut(auth);
      showToast("Acceso denegado. Tu correo no está autorizado.", "error");
      loadingOverlay.classList.add("hidden");
      return;
    }

    currentUser = user;
    userNameEl.textContent = user.displayName || "Operador";
    userEmailEl.textContent = user.email;
    userPhotoEl.src = user.photoURL || "https://picsum.photos/100";
    
    loginSection.classList.add("hidden");
    appShell.classList.remove("hidden");
    
    // Admin access check
    if (isAuthorized.role === 'admin') {
      navAdminBtn.classList.remove("hidden");
    } else {
      navAdminBtn.classList.add("hidden");
      if (activeView === 'admin') switchView('dashboard');
    }

    // Subscribe to Firestore collections
    initRealtimeSubscribers();
    initAdminSubscribers(isAuthorized.role);
    
    showToast("Sesión iniciada correctamente", "success");
  } else {
    currentUser = null;
    appShell.classList.add("hidden");
    loginSection.classList.remove("hidden");
  }
  
  // Hide loading once status is determined
  loadingOverlay.classList.add("hidden");
  lucide.createIcons();
});

async function checkUserAuthorization(email) {
  try {
    const userDocRef = doc(db, "authorizedUsers", email.toLowerCase());
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      return userDoc.data();
    }
    return false;
  } catch (e) {
    console.error("Auth check error", e);
    return false;
  }
}

async function seedInitialUsers() {
  try {
    const usersSnap = await getDocs(collection(db, "authorizedUsers"));
    if (usersSnap.empty) {
      const initialUsers = [
        { email: "ferreteriasapi@gmail.com", role: "admin" },
        { email: "constructoramonrui@gmail.com", role: "operador" },
        { email: "jpelaez@mecla.net", role: "operador" }
      ];
      for (const u of initialUsers) {
        await setDoc(doc(db, "authorizedUsers", u.email.toLowerCase()), u);
      }
      console.log("Usuarios iniciales registrados.");
    }
  } catch(e) {
    console.error("Error seeding users", e);
  }
}

// Google Login
googleLoginBtn.addEventListener("click", async () => {
  try {
    loadingOverlay.classList.remove("hidden");
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Login Error: ", error);
    showToast("Error al iniciar sesión con Google", "error");
    loadingOverlay.classList.add("hidden");
  }
});

// Logout
logoutBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    loadingOverlay.classList.remove("hidden");
    await signOut(auth);
    showToast("Sesión cerrada correctamente", "info");
  } catch (error) {
    console.error("Logout Error: ", error);
    showToast("Error al cerrar sesión", "error");
    loadingOverlay.classList.add("hidden");
  }
});

// ==========================================================================
// ROUTING / VIEW NAVIGATION
// ==========================================================================
function switchView(viewName) {
  activeView = viewName;
  
  // Update Bottom Nav
  navItems.forEach(item => {
    if (item.getAttribute("data-view") === viewName) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  // Update View visibility
  appViews.forEach(view => {
    if (view.id === `view-${viewName}`) {
      view.classList.remove("hidden");
    } else {
      view.classList.add("hidden");
    }
  });

  // Specific triggers per view
  if (viewName === "dashboard") {
    updateDashboardMetrics();
  } else if (viewName === "inventory") {
    filterProducts();
  } else if (viewName === "movements") {
    filterMovements();
  } else if (viewName === "admin") {
    renderUsersTable();
  }

  // Rerender Lucide icons
  lucide.createIcons();
}

navItems.forEach(item => {
  item.addEventListener("click", () => {
    switchView(item.getAttribute("data-view"));
  });
});

// ==========================================================================
// REAL-TIME FIRESTORE DATA SYNC
// ==========================================================================
let productsUnsubscribe = null;
let movementsUnsubscribe = null;

function initRealtimeSubscribers() {
  // 1. Subscribe to Products
  const productsQuery = query(collection(db, "products"), orderBy("name"));
  productsUnsubscribe = onSnapshot(productsQuery, (snapshot) => {
    productsMap.clear();
    snapshot.forEach(doc => {
      productsMap.set(doc.id, { id: doc.id, ...doc.data() });
    });
    
    // Update elements
    updateProductsSelect();
    filterProducts();
    updateDashboardMetrics();
    lucide.createIcons();
  }, (error) => {
    console.error("Products Sync Error: ", error);
    showToast("Error de conexión al sincronizar catálogo", "error");
  });

  // 2. Subscribe to Movements
  const movementsQuery = query(collection(db, "movements"), orderBy("timestamp", "desc"));
  movementsUnsubscribe = onSnapshot(movementsQuery, (snapshot) => {
    allMovements = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Handle server timestamp loading state
      const timestamp = data.timestamp ? data.timestamp.toDate() : new Date();
      allMovements.push({ id: doc.id, ...data, timestamp });
    });
    
    // Update elements
    filterMovements();
    updateDashboardMetrics();
    lucide.createIcons();
  }, (error) => {
    console.error("Movements Sync Error: ", error);
    showToast("Error de conexión al sincronizar historial", "error");
  });
}

// Unsubscribe on logout
onAuthStateChanged(auth, (user) => {
  if (!user) {
    if (productsUnsubscribe) productsUnsubscribe();
    if (movementsUnsubscribe) movementsUnsubscribe();
    if (usersUnsubscribe) usersUnsubscribe();
  }
});

// ==========================================================================
// PRODUCTS LIST (INVENTORY VIEW)
// ==========================================================================
function filterProducts() {
  const searchTerm = inventorySearch.value.toLowerCase();
  const selectedCategory = inventoryFilterCategory.value;
  
  productsContainer.innerHTML = "";
  
  let filteredCount = 0;
  productsMap.forEach(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm) || 
                          product.category.toLowerCase().includes(searchTerm);
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    
    if (matchesSearch && matchesCategory) {
      renderProductCard(product);
      filteredCount++;
    }
  });

  if (filteredCount === 0) {
    productsContainer.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i data-lucide="package-search" class="empty-icon"></i>
        <p>No se encontraron productos en el inventario.</p>
      </div>
    `;
    lucide.createIcons();
  }
}

function renderProductCard(product) {
  const isAlert = product.stock <= (product.minAlarm !== undefined ? product.minAlarm : 1);
  const card = document.createElement("div");
  card.className = `product-card ${isAlert ? 'stock-alert' : ''}`;
  
  card.innerHTML = `
    <span class="product-category-badge">${product.category}</span>
    <div class="product-info">
      <h4>${product.name}</h4>
      <div class="product-stock-display">
        <span class="stock-val">${product.stock}</span>
        <span class="stock-unit">${product.unit}</span>
      </div>
    </div>
    <div class="product-footer-metrics">
      <span>Precio Base: <strong>$${product.basePrice.toFixed(2)}</strong></span>
      <span>Alerta Min: <strong>${product.minAlarm !== undefined ? product.minAlarm : 1}</strong></span>
    </div>
    <div class="product-actions">
      <button class="btn btn-secondary btn-edit-product" data-id="${product.id}">
        <i data-lucide="edit-3"></i> Editar
      </button>
      <button class="btn btn-secondary btn-action-entry" data-id="${product.id}" style="padding: 10px;">
        <i data-lucide="plus"></i> Ingreso
      </button>
    </div>
  `;
  
  productsContainer.appendChild(card);
  
  // Edit Action listener
  card.querySelector(".btn-edit-product").addEventListener("click", () => {
    openProductModal(product);
  });

  // Action entry shortcut listener
  card.querySelector(".btn-action-entry").addEventListener("click", () => {
    openMovementModal("entry", product.id);
  });
}

inventorySearch.addEventListener("input", filterProducts);
inventoryFilterCategory.addEventListener("change", filterProducts);

// Pre-fill Select Option inside Movement Modal
function updateProductsSelect() {
  // Clear select except first option
  movementProductIdSelect.innerHTML = `<option value="" disabled selected>-- Elige un producto --</option>`;
  productsMap.forEach(product => {
    const option = document.createElement("option");
    option.value = product.id;
    option.textContent = `${product.name} (Stock: ${product.stock} ${product.unit})`;
    movementProductIdSelect.appendChild(option);
  });
}

// ==========================================================================
// AUDIT LOGS / HISTORIAL VIEW
// ==========================================================================
function filterMovements() {
  const searchTerm = movementsSearch.value.toLowerCase();
  
  movementsTableBody.innerHTML = "";
  
  let filteredCount = 0;
  
  allMovements.forEach(m => {
    const product = productsMap.get(m.productId) || { name: "Producto Eliminado", unit: "unidades" };
    
    // Categorize tab filter
    const matchesFilter = activeMovementFilter === "all" || m.type === activeMovementFilter;
    
    // Search Term match
    const friendlyDate = formatDate(m.timestamp);
    const friendlyType = getFriendlyTypeLabel(m.type);
    const opName = m.operator ? m.operator.name.toLowerCase() : "";
    const opEmail = m.operator ? m.operator.email.toLowerCase() : "";
    const deviceFriendly = m.device ? m.device.friendlyLabel.toLowerCase() : "";
    const clientDetail = m.details && m.details.client ? m.details.client.toLowerCase() : "";
    const worksiteDetail = m.details && m.details.worksite ? m.details.worksite.toLowerCase() : "";
    
    const matchesSearch = product.name.toLowerCase().includes(searchTerm) || 
                          friendlyType.toLowerCase().includes(searchTerm) ||
                          opName.includes(searchTerm) ||
                          opEmail.includes(searchTerm) ||
                          deviceFriendly.includes(searchTerm) ||
                          clientDetail.includes(searchTerm) ||
                          worksiteDetail.includes(searchTerm);
                          
    if (matchesFilter && matchesSearch) {
      renderMovementRow(m, product);
      filteredCount++;
    }
  });

  if (filteredCount === 0) {
    movementsTableBody.innerHTML = "";
    movementsEmptyState.classList.remove("hidden");
  } else {
    movementsEmptyState.classList.add("hidden");
  }
}

function renderMovementRow(movement, product) {
  const row = document.createElement("tr");
  
  // Format Type badge
  let typeBadge = "";
  if (movement.type === "sale") {
    typeBadge = `<span class="badge badge-sale"><i data-lucide="shopping-cart" style="width: 12px; height: 12px; margin-right: 4px;"></i>Venta</span>`;
  } else if (movement.type === "consumption") {
    typeBadge = `<span class="badge badge-consumption"><i data-lucide="wrench" style="width: 12px; height: 12px; margin-right: 4px;"></i>Consumo</span>`;
  } else if (movement.type === "entry") {
    typeBadge = `<span class="badge badge-entry"><i data-lucide="download" style="width: 12px; height: 12px; margin-right: 4px;"></i>Ingreso</span>`;
  }

  // Format Price & total
  const hasPrice = movement.type === "sale" || movement.type === "entry";
  const unitPrice = hasPrice && movement.price ? `$${movement.price.toFixed(2)}` : "-";
  const totalPrice = hasPrice && movement.price ? `$${(movement.quantity * movement.price).toFixed(2)}` : "-";

  // Operator email tooltip or label
  const opLabel = movement.operator 
    ? `<span class="user-name" title="${movement.operator.email}">${movement.operator.name}</span>`
    : `<span class="text-muted">Desconocido</span>`;

  // Device friendly indicator
  const devLabel = movement.device
    ? `<span class="badge-text" title="${movement.device.userAgent}"><i data-lucide="smartphone" style="width: 12px; height: 12px; vertical-align: middle; margin-right: 4px;"></i>${movement.device.friendlyLabel}</span>`
    : `<span class="text-muted">-</span>`;

  row.innerHTML = `
    <td data-label="Fecha/Hora">${formatDate(movement.timestamp)}</td>
    <td data-label="Producto">
      <strong>${product.name}</strong>
      ${movement.details && movement.details.client ? `<br><small class="text-muted">Detalle: ${movement.details.client}</small>` : ''}
    </td>
    <td data-label="Tipo">${typeBadge}</td>
    <td data-label="Cant.">${movement.quantity} ${product.unit || ''}</td>
    <td data-label="P. Unitario">${unitPrice}</td>
    <td data-label="Monto Total">${totalPrice}</td>
    <td data-label="Operador">${opLabel}</td>
    <td data-label="Equipo">${devLabel}</td>
  `;
  
  movementsTableBody.appendChild(row);
}

// Movements category tabs logic
movementNavTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    movementNavTabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    activeMovementFilter = tab.getAttribute("data-filter");
    filterMovements();
    lucide.createIcons();
  });
});

movementsSearch.addEventListener("input", filterMovements);

// ==========================================================================
// DASHBOARD VIEW LOGIC & CALCULATION
// ==========================================================================
function updateDashboardMetrics() {
  if (activeView !== "dashboard") return;

  // 1. Total Catalog Count
  metricProductsCount.textContent = productsMap.size;

  // 2. Alert Count (stock <= minAlarm) and build Dashboard Alert list
  let alertsCount = 0;
  dashboardAlertsList.innerHTML = "";
  
  productsMap.forEach(product => {
    const minThreshold = product.minAlarm !== undefined ? product.minAlarm : 1;
    if (product.stock <= minThreshold) {
      alertsCount++;
      renderDashboardAlertItem(product);
    }
  });

  metricAlertsCount.textContent = alertsCount;
  if (alertsCount === 0) {
    dashboardAlertsList.innerHTML = `
      <div class="empty-state">
        <i data-lucide="check-circle" class="empty-icon text-success"></i>
        <p>Todo el inventario está en niveles óptimos.</p>
      </div>
    `;
  }

  // 3. Recaudo Mensual (Filter: type == 'sale', and timestamp matches current month)
  let monthlySalesTotal = 0;
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  allMovements.forEach(m => {
    if (m.type === "sale") {
      const mDate = new Date(m.timestamp);
      if (mDate.getMonth() === currentMonth && mDate.getFullYear() === currentYear) {
        if (m.price && m.quantity) {
          monthlySalesTotal += (m.quantity * m.price);
        }
      }
    }
  });

  metricMonthlySales.textContent = `$${monthlySalesTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function renderDashboardAlertItem(product) {
  const item = document.createElement("div");
  item.className = "alert-item";
  item.innerHTML = `
    <div class="alert-item-info">
      <span class="alert-item-title">${product.name}</span>
      <span class="alert-item-stock">Stock actual: <strong>${product.stock} ${product.unit}</strong> (Mínimo: ${product.minAlarm !== undefined ? product.minAlarm : 1})</span>
    </div>
    <div style="display: flex; align-items: center; gap: 10px;">
      <span class="alert-badge">Bajo Stock</span>
      <button class="btn btn-secondary btn-action-entry" data-id="${product.id}" style="padding: 8px 12px;">
        Reabastecer
      </button>
    </div>
  `;
  
  dashboardAlertsList.appendChild(item);
  
  // Shortcut to entry register inside alert item
  item.querySelector(".btn-action-entry").addEventListener("click", () => {
    openMovementModal("entry", product.id);
  });
}

// ==========================================================================
// MODALS LOGIC (OPEN / CLOSE / SUBMIT)
// ==========================================================================

// Close modals when close button or overlay is clicked
closeModalButtons.forEach(btn => {
  btn.addEventListener("click", closeAllModals);
});

window.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-overlay")) {
    closeAllModals();
  }
});

function closeAllModals() {
  modalProduct.classList.add("hidden");
  modalMovement.classList.add("hidden");
  modalUser.classList.add("hidden");
  formProduct.reset();
  formMovement.reset();
  if (formUser) formUser.reset();
  movementStockInfo.classList.add("hidden");
}

// 1. OPEN PRODUCT MODAL (ADD/EDIT)
function openProductModal(product = null) {
  if (product) {
    // Edit Mode
    modalProductTitle.textContent = "Editar Producto";
    productIdInput.value = product.id;
    document.getElementById("product-name").value = product.name;
    document.getElementById("product-category").value = product.category;
    document.getElementById("product-unit").value = product.unit;
    document.getElementById("product-base-price").value = product.basePrice;
    document.getElementById("product-min-alarm").value = product.minAlarm !== undefined ? product.minAlarm : 1;
    initialStockGroup.classList.add("hidden"); // Hide stock initial on edit
  } else {
    // Add Mode
    modalProductTitle.textContent = "Nuevo Producto";
    productIdInput.value = "";
    formProduct.reset();
    document.getElementById("product-min-alarm").value = "1"; // Default is 1
    document.getElementById("product-initial-stock").value = "0";
    initialStockGroup.classList.remove("hidden");
  }
  
  modalProduct.classList.remove("hidden");
  lucide.createIcons();
}

btnAddProduct.addEventListener("click", () => openProductModal());

// Form Product Submit
formProduct.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const id = productIdInput.value;
  const name = document.getElementById("product-name").value.trim();
  const category = document.getElementById("product-category").value;
  const unit = document.getElementById("product-unit").value.trim();
  const basePrice = parseFloat(document.getElementById("product-base-price").value);
  const minAlarm = parseInt(document.getElementById("product-min-alarm").value) || 1;
  const initialStock = parseInt(document.getElementById("product-initial-stock").value) || 0;

  try {
    loadingOverlay.classList.remove("hidden");
    
    if (id) {
      // Edit: update fields (don't override stock directly here to preserve integrity)
      const productRef = doc(db, "products", id);
      await setDoc(productRef, {
        name,
        category,
        unit,
        basePrice,
        minAlarm
      }, { merge: true });
      showToast("Producto actualizado", "success");
    } else {
      // Create new
      await addDoc(collection(db, "products"), {
        name,
        category,
        unit,
        basePrice,
        minAlarm,
        stock: initialStock
      });
      showToast("Producto guardado", "success");
    }
    
    closeAllModals();
  } catch (error) {
    console.error("Save Product Error: ", error);
    showToast("Error al guardar producto", "error");
  } finally {
    loadingOverlay.classList.add("hidden");
  }
});

// 2. OPEN MOVEMENT MODAL (ENTRY / SALE / CONSUMPTION)
function openMovementModal(type, preSelectedProductId = null) {
  formMovement.reset();
  movementTypeInput.value = type;
  
  // Set Modal title and design
  if (type === "sale") {
    modalMovementTitle.textContent = "Registrar Venta Rápida";
    movementPriceGroup.classList.remove("hidden");
    movementPriceInput.required = true;
    movementDetailsLabel.textContent = "Cliente / Detalle";
    movementDetailsInput.placeholder = "Ej. Contratista Obregón / Factura 023";
    btnSubmitMovement.className = "btn btn-primary btn-action-sale";
    btnSubmitMovement.textContent = "Confirmar Venta";
  } else if (type === "consumption") {
    modalMovementTitle.textContent = "Registrar Salida por Consumo";
    movementPriceGroup.classList.add("hidden");
    movementPriceInput.required = false;
    movementPriceInput.value = "";
    movementDetailsLabel.textContent = "Obra / Destino";
    movementDetailsInput.placeholder = "Ej. Frente de Obra Sector C / Torre 2";
    btnSubmitMovement.className = "btn btn-primary btn-action-consumption";
    btnSubmitMovement.textContent = "Confirmar Consumo";
  } else if (type === "entry") {
    modalMovementTitle.textContent = "Registrar Ingreso de Stock";
    movementPriceGroup.classList.remove("hidden");
    movementPriceInput.required = true;
    movementDetailsLabel.textContent = "Proveedor / Factura";
    movementDetailsInput.placeholder = "Ej. Distribuidora Ferretera del Sur";
    btnSubmitMovement.className = "btn btn-primary btn-action-entry";
    btnSubmitMovement.textContent = "Confirmar Ingreso";
  }

  // Pre-select product if given
  if (preSelectedProductId) {
    movementProductIdSelect.value = preSelectedProductId;
    triggerProductSelectionChange(preSelectedProductId);
  } else {
    movementStockInfo.classList.add("hidden");
  }

  modalMovement.classList.remove("hidden");
  lucide.createIcons();
}

// Quick action buttons listeners
btnQuickSale.addEventListener("click", () => openMovementModal("sale"));
btnQuickConsumption.addEventListener("click", () => openMovementModal("consumption"));
btnQuickEntry.addEventListener("click", () => openMovementModal("entry"));

// Prefill price and stock info when product changes in the modal
movementProductIdSelect.addEventListener("change", () => {
  triggerProductSelectionChange(movementProductIdSelect.value);
});

function triggerProductSelectionChange(productId) {
  const product = productsMap.get(productId);
  if (product) {
    currentStockBadge.textContent = product.stock;
    currentUnitBadge.textContent = product.unit;
    movementStockInfo.classList.remove("hidden");
    
    // Fill product's basePrice for entry/sale
    if (movementTypeInput.value !== "consumption") {
      movementPriceInput.value = product.basePrice;
    }
  } else {
    movementStockInfo.classList.add("hidden");
  }
}

// Register movement inside a Firestore transaction (highly secure for inventory stock changes)
formMovement.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const type = movementTypeInput.value;
  const productId = movementProductIdSelect.value;
  const quantity = parseInt(movementQuantityInput.value);
  const price = movementPriceGroup.classList.contains("hidden") ? 0 : parseFloat(movementPriceInput.value);
  const detailsText = movementDetailsInput.value.trim();

  if (!productId) {
    showToast("Por favor selecciona un producto", "error");
    return;
  }

  try {
    loadingOverlay.classList.remove("hidden");

    // Gather Audit log details
    const operator = {
      name: currentUser ? currentUser.displayName : "Operador Anónimo",
      email: currentUser ? currentUser.email : "anonimo@sapi.com"
    };

    const device = {
      userAgent: navigator.userAgent,
      friendlyLabel: getFriendlyDevice()
    };

    const productRef = doc(db, "products", productId);

    // Run transaction
    await runTransaction(db, async (transaction) => {
      const productDoc = await transaction.get(productRef);
      if (!productDoc.exists()) {
        throw new Error("El producto no existe en el catálogo");
      }

      const currentStock = productDoc.data().stock || 0;
      let newStock = currentStock;

      if (type === "sale" || type === "consumption") {
        if (currentStock < quantity) {
          throw new Error(`Stock insuficiente. Solo hay ${currentStock} disponible.`);
        }
        newStock = currentStock - quantity;
      } else if (type === "entry") {
        newStock = currentStock + quantity;
      }

      // Update product's stock and lastPrice
      const updateData = { stock: newStock };
      if (type === "sale" || type === "entry") {
        updateData.lastPrice = price;
      }
      transaction.update(productRef, updateData);

      // Create new movement log document
      const movementRef = doc(collection(db, "movements"));
      transaction.set(movementRef, {
        timestamp: serverTimestamp(),
        type,
        productId,
        quantity,
        price: (type === "sale" || type === "entry") ? price : 0,
        operator,
        device,
        details: {
          client: detailsText
        }
      });
    });

    showToast("Operación registrada correctamente", "success");
    closeAllModals();
  } catch (error) {
    console.error("Movement Transaction Error: ", error);
    showToast(error.message || "Error al registrar la transacción", "error");
  } finally {
    loadingOverlay.classList.add("hidden");
  }
});

// ==========================================================================
// HELPER FUNCTIONS (UTILS)
// ==========================================================================

// Parse userAgent to user friendly label
function getFriendlyDevice() {
  const ua = navigator.userAgent;
  let device = "Escritorio";
  let os = "Windows";
  let browser = "Chrome";

  // Mobile check
  if (/Android/i.test(ua)) {
    device = "Android";
    os = "Android OS";
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    device = "Móvil iOS";
    os = "iOS";
  } else if (/Macintosh/i.test(ua)) {
    device = "Mac";
    os = "macOS";
  } else if (/Linux/i.test(ua)) {
    device = "Linux";
    os = "Linux OS";
  }

  // Browser check
  if (/Chrome/i.test(ua) && !/Edge/i.test(ua)) {
    browser = "Chrome";
  } else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
    browser = "Safari";
  } else if (/Firefox/i.test(ua)) {
    browser = "Firefox";
  } else if (/Edg/i.test(ua)) {
    browser = "Edge";
  }

  return `${device} (${browser} en ${os})`;
}

// Simple Date Formatter
function formatDate(date) {
  if (!date) return "-";
  const d = new Date(date);
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

// Get friendly label for types
function getFriendlyTypeLabel(type) {
  if (type === "sale") return "Venta";
  if (type === "consumption") return "Consumo";
  if (type === "entry") return "Ingreso";
  return "Otro";
}

// Toast notification helper
function showToast(message, type = "info") {
  const toastContainer = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  let icon = "info";
  if (type === "success") icon = "check-circle";
  if (type === "error") icon = "alert-circle";

  toast.innerHTML = `
    <i data-lucide="${icon}" style="width: 20px; height: 20px;"></i>
    <span class="toast-message">${message}</span>
  `;
  
  toastContainer.appendChild(toast);
  lucide.createIcons();

  // Slide out after 3 seconds
  setTimeout(() => {
    toast.style.animation = "slideIn 0.3s reverse forwards";
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3500);
}

// ==========================================================================
// ADMIN PANEL (USER MANAGEMENT)
// ==========================================================================
let authorizedUsersList = [];
let usersUnsubscribe = null;

function initAdminSubscribers(role) {
  if (role !== 'admin' || usersUnsubscribe) return;
  const usersQuery = query(collection(db, "authorizedUsers"));
  usersUnsubscribe = onSnapshot(usersQuery, (snapshot) => {
    authorizedUsersList = [];
    snapshot.forEach(doc => {
      authorizedUsersList.push({ id: doc.id, ...doc.data() });
    });
    if(activeView === 'admin') {
      renderUsersTable();
    }
  });
}

function renderUsersTable() {
  usersTableBody.innerHTML = "";
  if (authorizedUsersList.length === 0) {
    usersEmptyState.classList.remove("hidden");
  } else {
    usersEmptyState.classList.add("hidden");
    authorizedUsersList.forEach(u => {
      const row = document.createElement("tr");
      const roleBadge = u.role === 'admin' 
        ? `<span class="badge badge-sale">Admin</span>` 
        : `<span class="badge">Operador</span>`;
      
      const isSelf = currentUser && u.email === currentUser.email;
      const deleteBtn = isSelf 
        ? `<span class="text-muted" style="font-size:0.8rem">Actual</span>`
        : `<button class="btn-icon text-danger btn-delete-user" data-email="${u.email}" title="Eliminar Acceso"><i data-lucide="trash-2"></i></button>`;

      row.innerHTML = `
        <td data-label="Correo"><strong>${u.email}</strong></td>
        <td data-label="Rol">${roleBadge}</td>
        <td data-label="Acciones">${deleteBtn}</td>
      `;
      usersTableBody.appendChild(row);
    });
    
    // Delete events
    document.querySelectorAll(".btn-delete-user").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const email = e.currentTarget.getAttribute("data-email");
        if (confirm(`¿Estás seguro de revocar el acceso a ${email}?`)) {
          try {
            await deleteDoc(doc(db, "authorizedUsers", email));
            showToast("Acceso revocado", "success");
          } catch(err) {
            console.error("Delete user error", err);
            showToast("Error al revocar acceso", "error");
          }
        }
      });
    });
    lucide.createIcons();
  }
}

// Add User Event Listeners
btnAddUser.addEventListener("click", () => {
  formUser.reset();
  modalUser.classList.remove("hidden");
  lucide.createIcons();
});

formUser.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = userEmailInput.value.trim().toLowerCase();
  const role = userRoleSelect.value;
  
  if(!email) return;

  try {
    loadingOverlay.classList.remove("hidden");
    await setDoc(doc(db, "authorizedUsers", email), {
      email: email,
      role: role
    });
    showToast("Usuario autorizado correctamente", "success");
    closeAllModals();
  } catch (error) {
    console.error("Add user error", error);
    showToast("Error al autorizar usuario", "error");
  } finally {
    loadingOverlay.classList.add("hidden");
  }
});

// Expose switchView to window for simple dynamic routing
window.switchView = switchView;
