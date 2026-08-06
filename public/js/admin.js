// Help-Shelf — Admin logic

// NOTE: this is a simple client-side passcode gate, not real authentication.
// Fine for now since only you have the link + passcode, but before adding
// your two developers as vendors we should switch this to real Supabase
// Auth (same pattern as your Field Service PWA) so each vendor only sees
// their own products.
const ADMIN_PASSCODE = "helpshelf2026";

function checkGate() {
  const val = document.getElementById("gate-pass").value;
  if (val === ADMIN_PASSCODE) {
    document.getElementById("gate").classList.add("hidden");
    document.getElementById("admin-app").classList.remove("hidden");
    sessionStorage.setItem("hs_admin_ok", "1");
    initAdmin();
  } else {
    document.getElementById("gate-error").textContent = "Wrong passcode.";
  }
}

if (sessionStorage.getItem("hs_admin_ok") === "1") {
  document.getElementById("gate").classList.add("hidden");
  document.getElementById("admin-app").classList.remove("hidden");
  initAdmin();
}

const CATEGORY_BUCKETS = {
  ebook: "ebooks",
  doc: "docs",
  photo: "photos",
  video: "videos",
  script: "scripts",
  app: "apps",
};

let vendorsCache = [];
let categoriesCache = [];
let productsCache = [];
let editingProductId = null;

async function initAdmin() {
  await loadVendors();
  await loadCategories();
  await loadProducts();
  await loadOrders();
  bindForms();
  toggleServiceFields();
}

function bindForms() {
  document.getElementById("vendor-form").addEventListener("submit", handleAddVendor);
  document.getElementById("product-form").addEventListener("submit", handleAddProduct);
  document.getElementById("p-is-service").addEventListener("change", toggleServiceFields);
}

function toggleServiceFields() {
  const isService = document.getElementById("p-is-service").checked;
  document.getElementById("license-fields").style.display = isService ? "none" : "block";
  document.getElementById("deliverable-label").style.display = isService ? "none" : "block";
  document.getElementById("price-label").querySelector("input").required = false;
}

// ---------- Vendors ----------
async function loadVendors() {
  const { data, error } = await supabaseClient.from("vendors").select("*").order("name");
  if (error) return console.error(error);
  vendorsCache = data;

  const select = document.getElementById("p-vendor");
  select.innerHTML = data.map((v) => `<option value="${v.id}">${escapeHtml(v.name)}</option>`).join("");

  document.getElementById("vendor-list").innerHTML = data
    .map((v) => `<span class="chip">${escapeHtml(v.name)}</span>`)
    .join("");
}

async function handleAddVendor(e) {
  e.preventDefault();
  const name = document.getElementById("v-name").value.trim();
  const email = document.getElementById("v-email").value.trim();
  if (!name || !email) return;

  const { error } = await supabaseClient.from("vendors").insert({ name, email });
  if (error) {
    alert("Could not add vendor: " + error.message);
    return;
  }
  document.getElementById("vendor-form").reset();
  await loadVendors();
}

// ---------- Categories ----------
async function loadCategories() {
  const { data, error } = await supabaseClient.from("categories").select("*").order("sort_order");
  if (error) return console.error(error);
  categoriesCache = data;

  document.getElementById("p-category").innerHTML = data
    .map((c) => `<option value="${c.id}">${escapeHtml(c.label)}</option>`)
    .join("");
}

// ---------- Products ----------
async function handleAddProduct(e) {
  e.preventDefault();

  const statusEl = document.getElementById("p-status");
  const submitBtn = document.getElementById("p-submit");
  statusEl.textContent = "";

  const vendor_id = document.getElementById("p-vendor").value;
  const category_id = document.getElementById("p-category").value;
  const title = document.getElementById("p-title").value.trim();
  const description = document.getElementById("p-desc").value.trim();
  const is_service = document.getElementById("p-is-service").checked;
  const price = parseFloat(document.getElementById("p-price").value) || 0;
  const download_limit = parseInt(document.getElementById("p-download-limit").value) || 3;
  const license_days = parseInt(document.getElementById("p-license-days").value) || 7;
  const thumbFile = document.getElementById("p-thumbnail").files[0];
  const deliverableFile = document.getElementById("p-file").files[0];

  const existing = editingProductId ? productsCache.find((p) => p.id === editingProductId) : null;

  if (!vendor_id || !title) {
    statusEl.textContent = "Vendor and title are required.";
    return;
  }
  if (!is_service && !deliverableFile && !(existing && existing.storage_path)) {
    statusEl.textContent = "Please attach a file, or check 'this is a service'.";
    return;
  }

  submitBtn.disabled = true;
  statusEl.textContent = editingProductId ? "Saving…" : "Uploading…";

  try {
    // Thumbnail: upload new one if provided, otherwise keep existing
    let thumbnail_path = existing ? existing.thumbnail_path : null;
    if (thumbFile) {
      const path = `${category_id}/${Date.now()}_${sanitizeFilename(thumbFile.name)}`;
      const { error: upErr } = await supabaseClient.storage.from("thumbnails").upload(path, thumbFile);
      if (upErr) throw new Error("Thumbnail upload failed: " + upErr.message);
      thumbnail_path = path;
    }

    // Deliverable file: upload new one if provided, otherwise keep existing
    let storage_bucket = existing ? existing.storage_bucket : null;
    let storage_path = existing ? existing.storage_path : null;
    if (!is_service && deliverableFile) {
      storage_bucket = CATEGORY_BUCKETS[category_id] || "docs";
      const path = `${Date.now()}_${sanitizeFilename(deliverableFile.name)}`;
      const { error: upErr } = await supabaseClient.storage.from(storage_bucket).upload(path, deliverableFile);
      if (upErr) throw new Error("File upload failed: " + upErr.message);
      storage_path = path;
    }
    if (is_service) {
      storage_bucket = null;
      storage_path = null;
    }

    const payload = {
      vendor_id,
      category_id,
      title,
      description,
      price_cents: Math.round(price * 100),
      thumbnail_path,
      storage_bucket,
      storage_path,
      is_service,
      download_limit,
      license_days,
    };

    if (editingProductId) {
      const { error: updateErr } = await supabaseClient
        .from("products")
        .update(payload)
        .eq("id", editingProductId);
      if (updateErr) throw new Error("Save failed: " + updateErr.message);
      statusEl.textContent = "Product updated.";
    } else {
      const { error: insertErr } = await supabaseClient.from("products").insert({ ...payload, active: true });
      if (insertErr) throw new Error("Save failed: " + insertErr.message);
      statusEl.textContent = "Product added.";
    }

    cancelEdit();
    await loadProducts();
  } catch (err) {
    console.error(err);
    statusEl.textContent = err.message;
  } finally {
    submitBtn.disabled = false;
  }
}

function startEdit(id) {
  const p = productsCache.find((x) => x.id === id);
  if (!p) return;

  editingProductId = id;
  document.getElementById("product-form-heading").textContent = "Edit Product";
  document.getElementById("p-submit").textContent = "Save Changes";
  document.getElementById("p-cancel-edit").classList.remove("hidden");

  document.getElementById("p-vendor").value = p.vendor_id;
  document.getElementById("p-category").value = p.category_id;
  document.getElementById("p-title").value = p.title;
  document.getElementById("p-desc").value = p.description || "";
  document.getElementById("p-is-service").checked = p.is_service;
  document.getElementById("p-price").value = (p.price_cents / 100).toFixed(2);
  document.getElementById("p-download-limit").value = p.download_limit;
  document.getElementById("p-license-days").value = p.license_days;
  document.getElementById("p-thumbnail").value = "";
  document.getElementById("p-file").value = "";

  toggleServiceFields();
  document.getElementById("product-form").scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelEdit() {
  editingProductId = null;
  document.getElementById("product-form-heading").textContent = "Add a Product";
  document.getElementById("p-submit").textContent = "Add Product";
  document.getElementById("p-cancel-edit").classList.add("hidden");
  document.getElementById("product-form").reset();
  toggleServiceFields();
}

async function loadProducts() {
  const { data, error } = await supabaseClient
    .from("products")
    .select("*, vendors(name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }
  productsCache = data;
  renderAdminProducts();
}

function renderAdminProducts() {
  const container = document.getElementById("admin-product-list");
  if (productsCache.length === 0) {
    container.innerHTML = '<p class="empty-state">No products yet.</p>';
    return;
  }

  container.innerHTML = productsCache
    .map((p) => {
      const price = p.is_service ? "Quote" : `$${(p.price_cents / 100).toFixed(2)}`;
      return `
        <div class="admin-product-row">
          <div class="admin-product-main">
            <span class="product-cat">${p.category_id}</span>
            <strong>${escapeHtml(p.title)}</strong>
            <span class="admin-vendor">— ${escapeHtml(p.vendors?.name || "")}</span>
          </div>
          <div class="admin-product-meta">
            <span>${price}</span>
            <label class="toggle-label">
              <input type="checkbox" ${p.active ? "checked" : ""} onchange="toggleActive('${p.id}', this.checked)" />
              Active
            </label>
            <button class="edit-btn" onclick="startEdit('${p.id}')">Edit</button>
            <button class="delete-btn" onclick="deleteProduct('${p.id}')">Delete</button>
          </div>
        </div>
      `;
    })
    .join("");
}

async function toggleActive(id, active) {
  const { error } = await supabaseClient.from("products").update({ active }).eq("id", id);
  if (error) alert("Could not update: " + error.message);
  await loadProducts();
}

async function deleteProduct(id) {
  if (!confirm("Delete this product? This can't be undone.")) return;
  const { error } = await supabaseClient.from("products").delete().eq("id", id);
  if (error) {
    alert("Could not delete: " + error.message);
    return;
  }
  await loadProducts();
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// ---------- Orders ----------
async function loadOrders() {
  const container = document.getElementById("admin-order-list");
  const { data, error } = await supabaseClient
    .from("orders")
    .select("*, products(title), vendors(name), licenses(license_key, download_count, max_downloads, expires_at, revoked)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error(error);
    container.innerHTML = '<p class="empty-state">Could not load orders.</p>';
    return;
  }

  if (data.length === 0) {
    container.innerHTML = '<p class="empty-state">No orders yet.</p>';
    return;
  }

  container.innerHTML = data
    .map((o) => {
      const license = Array.isArray(o.licenses) ? o.licenses[0] : o.licenses;
      const amount = o.amount_cents === 0 ? "Free" : `$${(o.amount_cents / 100).toFixed(2)}`;
      const date = new Date(o.created_at).toLocaleString();
      const licenseInfo = license
        ? `${license.license_key} · ${license.download_count}/${license.max_downloads} used${license.revoked ? " · REVOKED" : ""}`
        : "no license";

      return `
        <div class="admin-product-row">
          <div class="admin-product-main">
            <strong>${escapeHtml(o.products?.title || "Unknown product")}</strong>
            <span class="admin-vendor">— ${escapeHtml(o.vendors?.name || "")}</span>
          </div>
          <div class="admin-product-meta" style="flex-wrap: wrap; justify-content: flex-end; text-align: right;">
            <span>${escapeHtml(o.buyer_email)}</span>
            <span>${amount}</span>
            <span>${date}</span>
            <span style="font-family: var(--font-mono); font-size: 0.7rem;">${escapeHtml(licenseInfo)}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}