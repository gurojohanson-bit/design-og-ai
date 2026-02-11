// Lightweight, framework-free to-do list
// - Stores tasks in localStorage (browser only, no backend)
// - Features: add, remove, mark done, clear completed

const STORAGE_KEY = "light_todo_tasks_v1";

/**
 * @typedef {{ id: string, title: string, completed: boolean, createdAt: number, tags: string[] }} Task
 */

/**
 * Simple in-memory list of tasks, hydrated from localStorage on load.
 * @type {Task[]}
 */
let tasks = [];

const elements = {
  form: document.getElementById("task-form"),
  input: document.getElementById("task-input"),
  tagsInput: document.getElementById("task-tags-input"),
  list: document.getElementById("task-list"),
  count: document.getElementById("task-count"),
  clearCompleted: document.getElementById("clear-completed"),
  sortSelect: document.getElementById("sort-select"),
  tagFilterStatus: document.getElementById("tag-filter-status"),
  tagFilterName: document.getElementById("tag-filter-name"),
  clearTagFilter: document.getElementById("clear-tag-filter"),
};

let sortMode = "createdAt";
let activeTagFilter = null; // lowercased tag used for filtering
let activeTagLabel = ""; // original label for display

function setActiveTagFilter(tagLabel) {
  if (tagLabel == null || tagLabel === "") {
    activeTagFilter = null;
    activeTagLabel = "";
  } else {
    activeTagFilter = String(tagLabel).toLowerCase();
    activeTagLabel = String(tagLabel);
  }

  if (elements.tagFilterStatus && elements.tagFilterName) {
    if (activeTagFilter) {
      elements.tagFilterStatus.classList.remove("hidden");
      elements.tagFilterName.textContent = activeTagLabel;
    } else {
      elements.tagFilterStatus.classList.add("hidden");
      elements.tagFilterName.textContent = "";
    }
  }

  renderTasks();
}

function loadTasks() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      tasks = parsed.map((t) => ({
        id: String(t.id ?? crypto.randomUUID?.() ?? Date.now()),
        title: String(t.title ?? "").trim(),
        completed: Boolean(t.completed),
        createdAt: Number(t.createdAt ?? Date.now()),
        tags: Array.isArray(t.tags)
          ? t.tags.map((tag) => String(tag).trim()).filter(Boolean)
          : [],
      }));
    }
  } catch {
    // If anything goes wrong, we just fall back to an empty list.
    tasks = [];
  }
}

function saveTasks() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // Ignore storage errors (e.g. private mode limits)
  }
}

function formatCreatedAt(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function updateTaskCount() {
  const remaining = tasks.filter((t) => !t.completed).length;
  const total = tasks.length;
  let text = "No tasks";
  if (total > 0) {
    text =
      remaining === 0
        ? "All done"
        : `${remaining} of ${total} task${total === 1 ? "" : "s"} left`;
  }
  elements.count.textContent = text;
  elements.clearCompleted.disabled = tasks.every((t) => !t.completed);
}

function createTaskElement(task) {
  const li = document.createElement("li");
  li.className = "task-item" + (task.completed ? " completed" : "");
  li.dataset.taskId = task.id;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task-toggle";
  checkbox.checked = task.completed;
  checkbox.setAttribute("aria-label", "Mark task as done");

  const content = document.createElement("div");
  content.className = "task-content";

  const titleEl = document.createElement("p");
  titleEl.className = "task-title";
  titleEl.textContent = task.title;

  const tagsEl = document.createElement("div");
  tagsEl.className = "task-tags";
  if (task.tags && task.tags.length > 0) {
    for (const tag of task.tags) {
      const tagEl = document.createElement("span");
      tagEl.className = "task-tag-pill";
      tagEl.textContent = tag;
      tagEl.addEventListener("click", () => {
        // Toggle filter if clicking the same tag again
        if (activeTagFilter && activeTagFilter === String(tag).toLowerCase()) {
          setActiveTagFilter(null);
        } else {
          setActiveTagFilter(tag);
        }
      });
      tagsEl.appendChild(tagEl);
    }
  } else {
    tagsEl.classList.add("hidden");
  }

  const metaEl = document.createElement("div");
  metaEl.className = "task-meta";
  metaEl.textContent = `Added at ${formatCreatedAt(task.createdAt)}`;

  content.appendChild(titleEl);
  content.appendChild(tagsEl);
  content.appendChild(metaEl);

  const removeButton = document.createElement("button");
  removeButton.className = "task-remove";
  removeButton.type = "button";

  const removeIcon = document.createElement("span");
  removeIcon.textContent = "×";
  removeButton.appendChild(removeIcon);
  removeButton.setAttribute("aria-label", "Remove task");

  li.appendChild(checkbox);
  li.appendChild(content);
  li.appendChild(removeButton);

  // Event wiring
  checkbox.addEventListener("change", () => toggleTaskCompleted(task.id));
  removeButton.addEventListener("click", () => removeTask(task.id));

  return li;
}

function renderTasks() {
  elements.list.innerHTML = "";

  const visibleTasks =
    activeTagFilter == null
      ? tasks
      : tasks.filter(
          (t) =>
            Array.isArray(t.tags) &&
            t.tags.some((tag) => String(tag).toLowerCase() === activeTagFilter)
        );

  if (visibleTasks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const message =
      activeTagFilter && activeTagLabel
        ? `No tasks with tag “${activeTagLabel}”. Clear the tag filter to see all tasks.`
        : "Nothing here yet. Add your first task above.";
    empty.innerHTML = `
      <div class="empty-state-icon">☕️</div>
      <div>${message}</div>
    `;
    elements.list.appendChild(empty);
  } else {
    const fragment = document.createDocumentFragment();
    const sorted = [...visibleTasks].sort((a, b) => {
      if (sortMode === "tag") {
        const aTag = (a.tags && a.tags[0] ? a.tags[0] : "").toLowerCase();
        const bTag = (b.tags && b.tags[0] ? b.tags[0] : "").toLowerCase();

        // If both have no tag, fall back to createdAt
        if (!aTag && !bTag) {
          return a.createdAt - b.createdAt;
        }
        // Tasks without tags go last
        if (!aTag) return 1;
        if (!bTag) return -1;

        const tagCompare = aTag.localeCompare(bTag);
        return tagCompare !== 0 ? tagCompare : a.createdAt - b.createdAt;
      }

      // Default sort: by creation time (oldest first)
      return a.createdAt - b.createdAt;
    });
    for (const task of sorted) {
      fragment.appendChild(createTaskElement(task));
    }
    elements.list.appendChild(fragment);
  }

  updateTaskCount();
}

function parseTags(input) {
  if (!input) return [];
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function addTask(title, tagsInput) {
  const trimmed = title.trim();
  if (!trimmed) return;

  const newTask = {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    title: trimmed,
    completed: false,
    createdAt: Date.now(),
    tags: parseTags(tagsInput),
  };

  tasks.push(newTask);
  saveTasks();
  renderTasks();
}

function removeTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  saveTasks();
  renderTasks();
}

function toggleTaskCompleted(id) {
  tasks = tasks.map((t) =>
    t.id === id ? { ...t, completed: !t.completed } : t
  );
  saveTasks();
  renderTasks();
}

function clearCompletedTasks() {
  tasks = tasks.filter((t) => !t.completed);
  saveTasks();
  renderTasks();
}

function handleFormSubmit(event) {
  event.preventDefault();
  const value = elements.input.value;
  const tagsValue = elements.tagsInput?.value ?? "";
  addTask(value, tagsValue);
  elements.input.value = "";
  if (elements.tagsInput) {
    elements.tagsInput.value = "";
  }
  elements.input.focus();
}

function init() {
  loadTasks();
  renderTasks();

  elements.form.addEventListener("submit", handleFormSubmit);
  elements.clearCompleted.addEventListener("click", clearCompletedTasks);

  if (elements.sortSelect) {
    elements.sortSelect.addEventListener("change", (event) => {
      const value = event.target.value;
      sortMode = value === "tag" ? "tag" : "createdAt";
      renderTasks();
    });
  }

  if (elements.clearTagFilter) {
    elements.clearTagFilter.addEventListener("click", () => {
      setActiveTagFilter(null);
    });
  }

  // Add a tiny UX touch: submit with Cmd/Ctrl+Enter from the input
  elements.input.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      elements.form.requestSubmit();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

