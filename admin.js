const landscapes = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1920&q=80"
];

const SUPABASE_URL = "https://bqahyhmtezaadsfrbgtf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QOk7JxF1hzynK3W-ouAfpw_MjgPAyQo";
const supabaseClient = window.supabase?.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

let categories = [];
let activeTab = "suggestions";

function applyRandomLandscape() {
  const randomIndex = Math.floor(Math.random() * landscapes.length);
  document.documentElement.style.setProperty(
    "--landscape-image",
    `url("${landscapes[randomIndex]}")`
  );
}

function setStatus(elementId, message, type = "neutral") {
  const status = document.querySelector(elementId);
  status.textContent = message;
  status.dataset.type = type;
}

function formatDate(dateValue) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(dateValue));
}

function normalizeOptionalValue(value) {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text || "";
  return element;
}

function createField(labelText, inputElement) {
  const field = document.createElement("div");
  field.className = "form-field";

  const label = document.createElement("label");
  label.textContent = labelText;

  field.append(label, inputElement);
  return field;
}

function createInput(name, value, required = true) {
  const input = document.createElement("input");
  input.name = name;
  input.type = "text";
  input.value = value || "";
  input.required = required;
  return input;
}

function createTextarea(name, value) {
  const textarea = document.createElement("textarea");
  textarea.name = name;
  textarea.rows = 4;
  textarea.required = true;
  textarea.value = value || "";
  return textarea;
}

function createCategorySelect(selectedCategoryId) {
  const select = document.createElement("select");
  select.name = "category_id";
  select.required = true;

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    option.selected = category.id === selectedCategoryId;
    select.append(option);
  });

  return select;
}

async function getAdminProfile(userId) {
  const { data, error } = await supabaseClient
    .from("admin_profiles")
    .select("name, role, status")
    .eq("user_id", userId)
    .single();

  if (error) {
    throw error;
  }

  if (!data || data.status !== "active") {
    throw new Error("Usuario sem perfil administrativo ativo.");
  }

  return data;
}

function showDashboard(profile) {
  document.querySelector("#admin-login-form").hidden = true;
  document.querySelector("#admin-dashboard").hidden = false;
  document.querySelector("#admin-user").textContent = `${profile.name} · ${profile.role}`;
}

function showLogin() {
  document.querySelector("#admin-login-form").hidden = false;
  document.querySelector("#admin-dashboard").hidden = true;
  document.querySelector("#admin-user").textContent = "Administrador";
}

function setActiveTab(tabName) {
  activeTab = tabName;

  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.adminTab === tabName);
  });

  document.querySelector("#suggestions-panel").hidden = tabName !== "suggestions";
  document.querySelector("#tips-panel").hidden = tabName !== "tips";
  loadActiveTab();
}

async function loadCategories() {
  const { data, error } = await supabaseClient
    .from("tip_categories")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  categories = data || [];
}

function renderSuggestions(suggestions) {
  const list = document.querySelector("#suggestions-list");
  list.innerHTML = "";

  if (suggestions.length === 0) {
    list.append(createTextElement("p", "empty-state", "Nenhuma sugestao pendente."));
    return;
  }

  suggestions.forEach((suggestion) => {
    const article = document.createElement("article");
    article.className = "suggestion-card";

    article.append(
      createTextElement(
        "p",
        "suggestion-meta",
        `${suggestion.tip_categories?.name || "Sem categoria"} · ${formatDate(suggestion.created_at)}`
      ),
      createTextElement("h2", "suggestion-title", suggestion.title),
      createTextElement("p", "suggestion-content", suggestion.content)
    );

    [suggestion.example, suggestion.example2].filter(Boolean).forEach((example, index) => {
      article.append(
        createTextElement(
          "blockquote",
          "suggestion-example",
          `${index === 0 ? "Exemplo" : "Outro exemplo"}: ${example}`
        )
      );
    });

    const authorText = [suggestion.suggested_by_name, suggestion.suggested_by_email]
      .filter(Boolean)
      .join(" · ");

    if (authorText) {
      article.append(createTextElement("p", "suggestion-author", authorText));
    }

    const actions = document.createElement("div");
    actions.className = "suggestion-actions";

    const convertButton = document.createElement("button");
    convertButton.className = "submit-button compact-button";
    convertButton.type = "button";
    convertButton.textContent = "Converter em draft";
    convertButton.addEventListener("click", () => convertSuggestion(suggestion.id));

    const rejectButton = document.createElement("button");
    rejectButton.className = "text-button danger-button";
    rejectButton.type = "button";
    rejectButton.textContent = "Rejeitar";
    rejectButton.addEventListener("click", () => rejectSuggestion(suggestion.id));

    actions.append(convertButton, rejectButton);
    article.append(actions);
    list.append(article);
  });
}

async function loadSuggestions() {
  setStatus("#admin-status", "Carregando sugestoes...", "neutral");

  const { data, error } = await supabaseClient
    .from("tip_suggestions")
    .select(
      "id, title, content, example, example2, suggested_by_name, suggested_by_email, created_at, tip_categories(name)"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    setStatus("#admin-status", "Nao foi possivel carregar sugestoes.", "error");
    throw error;
  }

  renderSuggestions(data || []);
  setStatus("#admin-status", "", "neutral");
}

function renderTips(tips) {
  const list = document.querySelector("#tips-list");
  list.innerHTML = "";

  if (tips.length === 0) {
    list.append(createTextElement("p", "empty-state", "Nenhuma dica encontrada para este status."));
    return;
  }

  tips.forEach((tip) => {
    const article = document.createElement("article");
    article.className = "suggestion-card";

    article.append(
      createTextElement(
        "p",
        "suggestion-meta",
        `${tip.tip_categories?.name || "Sem categoria"} · ${tip.status}`
      ),
      createTextElement("h2", "suggestion-title", tip.title)
    );

    const form = document.createElement("form");
    form.className = "admin-tip-form";
    form.dataset.tipId = tip.id;

    const grid = document.createElement("div");
    grid.className = "form-grid";
    grid.append(
      createField("Titulo", createInput("title", tip.title)),
      createField("Categoria", createCategorySelect(tip.category_id))
    );

    form.append(
      grid,
      createField("Explicacao", createTextarea("content", tip.content)),
      createField("Exemplo", createInput("example", tip.example, false)),
      createField("Outro exemplo", createInput("example2", tip.example2, false))
    );

    const actions = document.createElement("div");
    actions.className = "suggestion-actions";

    const saveButton = document.createElement("button");
    saveButton.className = "submit-button compact-button";
    saveButton.type = "submit";
    saveButton.textContent = "Salvar";

    const activateButton = document.createElement("button");
    activateButton.className = "text-button";
    activateButton.type = "button";
    activateButton.textContent = "Ativar";
    activateButton.hidden = tip.status === "active";
    activateButton.addEventListener("click", () => changeTipStatus(tip.id, "active"));

    const draftButton = document.createElement("button");
    draftButton.className = "text-button";
    draftButton.type = "button";
    draftButton.textContent = "Voltar para draft";
    draftButton.hidden = tip.status === "draft";
    draftButton.addEventListener("click", () => changeTipStatus(tip.id, "draft"));

    const inactiveButton = document.createElement("button");
    inactiveButton.className = "text-button danger-button";
    inactiveButton.type = "button";
    inactiveButton.textContent = "Inativar";
    inactiveButton.hidden = tip.status === "inactive";
    inactiveButton.addEventListener("click", () => changeTipStatus(tip.id, "inactive"));

    actions.append(saveButton, activateButton, draftButton, inactiveButton);
    form.append(actions);
    form.addEventListener("submit", (event) => saveTip(event, tip.id));

    article.append(form);
    list.append(article);
  });
}

async function loadTips() {
  const status = document.querySelector("#tip-status-filter").value;
  setStatus("#admin-status", "Carregando dicas...", "neutral");

  const { data, error } = await supabaseClient
    .from("tips")
    .select("id, title, category_id, content, example, example2, status, tip_categories(name)")
    .eq("status", status)
    .order("updated_at", { ascending: false });

  if (error) {
    setStatus("#admin-status", "Nao foi possivel carregar dicas.", "error");
    throw error;
  }

  renderTips(data || []);
  setStatus("#admin-status", "", "neutral");
}

async function loadActiveTab() {
  try {
    if (activeTab === "suggestions") {
      await loadSuggestions();
    } else {
      await loadTips();
    }
  } catch (error) {
    console.error(error);
  }
}

async function convertSuggestion(suggestionId) {
  setStatus("#admin-status", "Convertendo sugestao em draft...", "neutral");

  const { error } = await supabaseClient.rpc("convert_suggestion_to_tip", {
    target_suggestion_id: suggestionId
  });

  if (error) {
    console.error(error);
    setStatus("#admin-status", "Nao foi possivel converter a sugestao.", "error");
    return;
  }

  setStatus("#admin-status", "Sugestao convertida em draft.", "success");
  await loadSuggestions();
}

async function rejectSuggestion(suggestionId) {
  const notes = window.prompt("Observacao da rejeicao (opcional):") || null;
  setStatus("#admin-status", "Rejeitando sugestao...", "neutral");

  const { error } = await supabaseClient.rpc("reject_suggestion", {
    target_suggestion_id: suggestionId,
    notes
  });

  if (error) {
    console.error(error);
    setStatus("#admin-status", "Nao foi possivel rejeitar a sugestao.", "error");
    return;
  }

  setStatus("#admin-status", "Sugestao rejeitada.", "success");
  await loadSuggestions();
}

async function saveTip(event, tipId) {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const payload = {
    target_tip_id: tipId,
    new_title: formData.get("title").trim(),
    new_category_id: formData.get("category_id"),
    new_content: formData.get("content").trim(),
    new_example: normalizeOptionalValue(formData.get("example")),
    new_example2: normalizeOptionalValue(formData.get("example2"))
  };

  setStatus("#admin-status", "Salvando dica...", "neutral");

  const { error } = await supabaseClient.rpc("update_tip_content", payload);

  if (error) {
    console.error(error);
    setStatus("#admin-status", "Nao foi possivel salvar a dica.", "error");
    return;
  }

  setStatus("#admin-status", "Dica salva.", "success");
  await loadTips();
}

async function changeTipStatus(tipId, status) {
  setStatus("#admin-status", "Atualizando status da dica...", "neutral");

  const { error } = await supabaseClient.rpc("set_tip_status", {
    target_tip_id: tipId,
    new_status: status
  });

  if (error) {
    console.error(error);
    setStatus("#admin-status", "Nao foi possivel alterar o status.", "error");
    return;
  }

  setStatus("#admin-status", "Status atualizado.", "success");
  await loadTips();
}

async function handleLogin(event) {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const email = formData.get("email").trim();
  const password = formData.get("password");

  setStatus("#admin-login-status", "Entrando...", "neutral");

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    setStatus("#admin-login-status", "E-mail ou senha invalidos.", "error");
    return;
  }

  try {
    const profile = await getAdminProfile(data.user.id);
    await loadCategories();
    showDashboard(profile);
    setStatus("#admin-login-status", "", "neutral");
    await loadActiveTab();
  } catch (profileError) {
    await supabaseClient.auth.signOut();
    console.error(profileError);
    setStatus("#admin-login-status", "Usuario sem acesso administrativo.", "error");
  }
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  showLogin();
  setStatus("#admin-login-status", "", "neutral");
}

async function restoreSession() {
  const { data } = await supabaseClient.auth.getSession();

  if (!data.session?.user) {
    showLogin();
    return;
  }

  try {
    const profile = await getAdminProfile(data.session.user.id);
    await loadCategories();
    showDashboard(profile);
    await loadActiveTab();
  } catch (error) {
    console.error(error);
    await supabaseClient.auth.signOut();
    showLogin();
  }
}

function init() {
  applyRandomLandscape();

  if (!supabaseClient) {
    setStatus("#admin-login-status", "Nao foi possivel conectar ao Supabase.", "error");
    return;
  }

  document.querySelector("#admin-login-form").addEventListener("submit", handleLogin);
  document.querySelector("#logout-button").addEventListener("click", handleLogout);
  document.querySelector("#refresh-admin").addEventListener("click", loadActiveTab);
  document.querySelector("#tip-status-filter").addEventListener("change", loadTips);
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.adminTab));
  });
  restoreSession();
}

init();
