const landscapes = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1920&q=80"
];

const mockTips = window.portuguesDiarioTips || [];
const DAILY_TIP_STORAGE_KEY = "portugues-diario-rotation";
const SUPABASE_URL = "https://bqahyhmtezaadsfrbgtf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QOk7JxF1hzynK3W-ouAfpw_MjgPAyQo";
const supabaseClient = window.supabase?.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric"
});

function applyRandomLandscape() {
  const randomIndex = Math.floor(Math.random() * landscapes.length);
  document.documentElement.style.setProperty(
    "--landscape-image",
    `url("${landscapes[randomIndex]}")`
  );
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function seededRandom(seed) {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }

  const value = Math.sin(hash) * 10000;
  return value - Math.floor(value);
}

function getTipById(id) {
  return mockTips.find((tip) => tip.id === id);
}

function createDefaultRotationState() {
  return {
    currentDate: null,
    currentTipId: null,
    shownTipIds: [],
    cycle: 1
  };
}

function loadRotationState() {
  try {
    const rawState = localStorage.getItem(DAILY_TIP_STORAGE_KEY);

    if (!rawState) {
      return createDefaultRotationState();
    }

    const state = JSON.parse(rawState);
    const validTipIds = new Set(mockTips.map((tip) => tip.id));

    return {
      currentDate: typeof state.currentDate === "string" ? state.currentDate : null,
      currentTipId: validTipIds.has(state.currentTipId) ? state.currentTipId : null,
      shownTipIds: Array.isArray(state.shownTipIds)
        ? state.shownTipIds.filter((id) => validTipIds.has(id))
        : [],
      cycle: Number.isInteger(state.cycle) && state.cycle > 0 ? state.cycle : 1
    };
  } catch (error) {
    console.warn("Nao foi possivel ler a rotacao local.", error);
    return createDefaultRotationState();
  }
}

function saveRotationState(state) {
  try {
    localStorage.setItem(DAILY_TIP_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Nao foi possivel salvar a rotacao local.", error);
  }
}

function selectDailyTip(today) {
  const state = loadRotationState();
  const currentTip = getTipById(state.currentTipId);

  if (state.currentDate === today && currentTip) {
    return currentTip;
  }

  let cycle = state.cycle;
  let shownTipIds = state.shownTipIds;
  let availableTips = mockTips.filter((tip) => !shownTipIds.includes(tip.id));

  if (availableTips.length === 0) {
    cycle += 1;
    shownTipIds = [];
    availableTips = [...mockTips];
  }

  const randomIndex = Math.floor(
    seededRandom(`${today}-${cycle}-${shownTipIds.length}`) * availableTips.length
  );
  const selectedTip = availableTips[randomIndex];

  saveRotationState({
    currentDate: today,
    currentTipId: selectedTip.id,
    shownTipIds: [...shownTipIds, selectedTip.id],
    cycle
  });

  return selectedTip;
}

async function getDailyTip() {
  const today = getLocalDateKey();

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.rpc("get_daily_tip", {
        target_date: today
      });

      if (error) {
        throw error;
      }

      if (Array.isArray(data) && data.length > 0) {
        return data[0];
      }
    } catch (error) {
      console.warn("Nao foi possivel carregar a dica pelo Supabase.", error);
    }
  }

  if (mockTips.length === 0) {
    throw new Error("Nenhuma dica local foi encontrada.");
  }

  const selectedTip = selectDailyTip(today);

  return {
    ...selectedTip,
    date: today
  };
}

function renderExamples(tip) {
  const examplesContainer = document.querySelector("#examples");
  const examples = [tip.example, tip.example2].filter(Boolean);

  examplesContainer.innerHTML = "";
  examplesContainer.hidden = examples.length === 0;

  examples.forEach((example, index) => {
    const paragraph = document.createElement("p");
    paragraph.className = "example";

    const label = document.createElement("strong");
    label.textContent = index === 0 ? "Exemplo" : "Outro exemplo";

    paragraph.append(label, document.createTextNode(example));
    examplesContainer.append(paragraph);
  });
}

function renderTip(tip) {
  document.querySelector("#tip-date").textContent =
    tip.date === getLocalDateKey()
      ? `Dica de hoje, ${dateFormatter.format(new Date())}`
      : `Dica de ${tip.date}`;
  document.querySelector("#tip-category").textContent = tip.category;
  document.querySelector("#tip-title").textContent = tip.title;
  document.querySelector("#tip-content").textContent = tip.content;

  renderExamples(tip);
}

function renderFallback() {
  document.querySelector("#tip-date").textContent = "Dica de hoje";
  document.querySelector("#tip-category").textContent = "Indisponível";
  document.querySelector("#tip-title").textContent = "Não foi possível carregar a dica";
  document.querySelector("#tip-content").textContent =
    "Tente novamente em alguns instantes. A estrutura da página já está preparada para receber a API futura.";
  document.querySelector("#examples").hidden = true;
}

async function init() {
  try {
    applyRandomLandscape();
    const tip = await getDailyTip();
    renderTip(tip);
  } catch (error) {
    console.error(error);
    renderFallback();
  }
}

init();
