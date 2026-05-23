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

function normalizeOptionalValue(value) {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function setStatus(message, type = "neutral") {
  const status = document.querySelector("#form-status");
  status.textContent = message;
  status.dataset.type = type;
}

async function loadCategories() {
  const select = document.querySelector("#category");

  if (!supabaseClient) {
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("tip_categories")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    data.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      select.append(option);
    });
  } catch (error) {
    console.warn("Nao foi possivel carregar categorias.", error);
  }
}

async function submitSuggestion(event) {
  event.preventDefault();

  if (!supabaseClient) {
    setStatus("Não foi possível conectar ao banco agora. Tente novamente depois.", "error");
    return;
  }

  const form = event.currentTarget;
  const submitButton = form.querySelector("button[type='submit']");
  const formData = new FormData(form);

  const suggestion = {
    title: formData.get("title").trim(),
    category_id: normalizeOptionalValue(formData.get("category_id")),
    content: formData.get("content").trim(),
    example: normalizeOptionalValue(formData.get("example")),
    example2: normalizeOptionalValue(formData.get("example2")),
    suggested_by_name: normalizeOptionalValue(formData.get("suggested_by_name")),
    suggested_by_email: normalizeOptionalValue(formData.get("suggested_by_email")),
    status: "pending"
  };

  if (!suggestion.title || !suggestion.content) {
    setStatus("Preencha pelo menos o título e a explicação.", "error");
    return;
  }

  submitButton.disabled = true;
  setStatus("Enviando sugestão...", "neutral");

  try {
    const { error } = await supabaseClient.from("tip_suggestions").insert(suggestion);

    if (error) {
      throw error;
    }

    form.reset();
    setStatus("Sugestão enviada. Obrigado por colaborar!", "success");
  } catch (error) {
    console.error(error);
    setStatus("Não foi possível enviar agora. Tente novamente em instantes.", "error");
  } finally {
    submitButton.disabled = false;
  }
}

function init() {
  applyRandomLandscape();
  loadCategories();
  document.querySelector("#suggestion-form").addEventListener("submit", submitSuggestion);
}

init();
