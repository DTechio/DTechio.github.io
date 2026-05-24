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

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text || "";
  return element;
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
    throw new Error("Usuário sem perfil administrativo ativo.");
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

function renderSuggestions(suggestions) {
  const list = document.querySelector("#suggestions-list");
  list.innerHTML = "";

  if (suggestions.length === 0) {
    list.append(createTextElement("p", "empty-state", "Nenhuma sugestão pendente."));
    return;
  }

  suggestions.forEach((suggestion) => {
    const article = document.createElement("article");
    article.className = "suggestion-card";

    const meta = createTextElement(
      "p",
      "suggestion-meta",
      `${suggestion.tip_categories?.name || "Sem categoria"} · ${formatDate(suggestion.created_at)}`
    );
    const title = createTextElement("h2", "suggestion-title", suggestion.title);
    const content = createTextElement("p", "suggestion-content", suggestion.content);

    article.append(meta, title, content);

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
  setStatus("#admin-status", "Carregando sugestões...", "neutral");

  const { data, error } = await supabaseClient
    .from("tip_suggestions")
    .select(
      "id, title, content, example, example2, suggested_by_name, suggested_by_email, created_at, tip_categories(name)"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    setStatus("#admin-status", "Não foi possível carregar sugestões.", "error");
    throw error;
  }

  renderSuggestions(data || []);
  setStatus("#admin-status", "", "neutral");
}

async function convertSuggestion(suggestionId) {
  setStatus("#admin-status", "Convertendo sugestão em draft...", "neutral");

  const { error } = await supabaseClient.rpc("convert_suggestion_to_tip", {
    target_suggestion_id: suggestionId
  });

  if (error) {
    console.error(error);
    setStatus("#admin-status", "Não foi possível converter a sugestão.", "error");
    return;
  }

  setStatus("#admin-status", "Sugestão convertida em draft.", "success");
  loadSuggestions();
}

async function rejectSuggestion(suggestionId) {
  const notes = window.prompt("Observação da rejeição (opcional):") || null;
  setStatus("#admin-status", "Rejeitando sugestão...", "neutral");

  const { error } = await supabaseClient.rpc("reject_suggestion", {
    target_suggestion_id: suggestionId,
    notes
  });

  if (error) {
    console.error(error);
    setStatus("#admin-status", "Não foi possível rejeitar a sugestão.", "error");
    return;
  }

  setStatus("#admin-status", "Sugestão rejeitada.", "success");
  loadSuggestions();
}

async function handleLogin(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);
  const email = formData.get("email").trim();
  const password = formData.get("password");

  setStatus("#admin-login-status", "Entrando...", "neutral");

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    setStatus("#admin-login-status", "E-mail ou senha inválidos.", "error");
    return;
  }

  try {
    const profile = await getAdminProfile(data.user.id);
    showDashboard(profile);
    setStatus("#admin-login-status", "", "neutral");
    loadSuggestions();
  } catch (profileError) {
    await supabaseClient.auth.signOut();
    console.error(profileError);
    setStatus("#admin-login-status", "Usuário sem acesso administrativo.", "error");
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
    showDashboard(profile);
    loadSuggestions();
  } catch (error) {
    console.error(error);
    await supabaseClient.auth.signOut();
    showLogin();
  }
}

function init() {
  applyRandomLandscape();

  if (!supabaseClient) {
    setStatus("#admin-login-status", "Não foi possível conectar ao Supabase.", "error");
    return;
  }

  document.querySelector("#admin-login-form").addEventListener("submit", handleLogin);
  document.querySelector("#logout-button").addEventListener("click", handleLogout);
  document.querySelector("#refresh-suggestions").addEventListener("click", loadSuggestions);
  restoreSession();
}

init();
