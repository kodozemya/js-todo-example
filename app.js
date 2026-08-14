/*
  Застосунок «Список справ» — приклад виконаного бою з босом
  регіону «Землі Живого Скрипту».

  Файл читається зверху вниз трьома частинами:
    1. СТАН       — дані застосунку і збереження їх у localStorage;
    2. ДІЇ        — функції, що змінюють стан (і більше нічого);
    3. РЕНДЕР     — функції, що показують стан (і нічого не змінюють).

  Такий поділ — головна ідея цього бою. Поки дії й малювання перемішані,
  застосунок можна писати «як ідеться»; щойно їх розділено, з'являється
  єдиний шлях: змінити стан → перемалювати. Саме так працює React,
  до якого ти дійдеш за два регіони.
*/

/* ==========================================================================
   1. СТАН
   ========================================================================== */

/** Ключ, під яким список лежить у сховищі браузера. */
const STORAGE_KEY = "kodozemya-todo";

/**
 * Єдине джерело правди про те, що зараз у списку.
 * Кожна справа — об'єкт { id, text, done }.
 *
 * Це let, а не const: функції нижче замінюють масив новим,
 * а не змінюють наявний. Так важче випадково зіпсувати стан
 * із чужого місця в коді.
 */
let tasks = loadTasks();

/**
 * Читає список зі сховища браузера.
 * @returns {{ id: string, text: string, done: boolean }[]}
 */
function loadTasks() {
  /*
    JSON.parse кидає помилку на зіпсованому рядку, а localStorage може бути
    взагалі недоступним (режим анонімного перегляду в деяких браузерах).
    Тому — try/catch: краще почати з порожнього списку, ніж упасти на старті.
  */
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    // У сховищі могло опинитися що завгодно — перевіряємо, що це масив.
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Записує поточний список у сховище браузера. */
function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    /*
      Сховище може бути переповнене або заборонене налаштуваннями.
      Втратити збереження — прикро, але не смертельно: застосунок
      має працювати далі, тож помилку просто ковтаємо.
    */
  }
}

/* ==========================================================================
   2. ДІЇ — кожна змінює стан і просить перемалювати
   ========================================================================== */

/**
 * Додає справу в початок списку.
 * @param {string} text текст справи, як його ввів користувач
 */
function addTask(text) {
  // trim прибирає пробіли з країв: рядок з самих пробілів — це порожній рядок.
  const trimmed = text.trim();
  if (trimmed === "") return; // порожня справа у список не потрапляє

  const task = {
    /*
      crypto.randomUUID() дає унікальний ідентифікатор. Індекс масиву
      для цього не годиться: після видалення чи сортування індекси
      з'їжджають, і id перестає вказувати на ту саму справу.
    */
    id: crypto.randomUUID(),
    text: trimmed,
    done: false,
  };

  // Нова справа стає першою — так само, як у другому кадрі макета.
  tasks = [task, ...tasks];

  saveTasks();
  render();
}

/**
 * Перемикає справу між «виконано» і «не виконано».
 * @param {string} id ідентифікатор справи
 */
function toggleTask(id) {
  /*
    map повертає НОВИЙ масив, у якому змінена лише потрібна справа.
    Можна було б знайти об'єкт і присвоїти task.done = !task.done —
    але звичка не чіпати наявні об'єкти рятує в React, де мутований
    стан просто не викликає перемальовування.
  */
  tasks = tasks.map((task) =>
    task.id === id ? { ...task, done: !task.done } : task,
  );

  saveTasks();
  render();
}

/**
 * Прибирає справу зі списку.
 * @param {string} id ідентифікатор справи
 */
function deleteTask(id) {
  /*
    filter теж повертає НОВИЙ масив — без тієї справи, чий id збігся.
    Той самий підхід, що й у toggleTask: наявний масив не чіпаємо.
  */
  tasks = tasks.filter((task) => task.id !== id);

  saveTasks();
  render();
}

/* ==========================================================================
   3. РЕНДЕР — читає стан і будує розмітку
   ========================================================================== */

// Посилання на елементи беремо один раз: шукати їх на кожен рендер — марна робота.
const form = document.getElementById("new-task-form");
const input = document.getElementById("new-task-input");
const list = document.getElementById("tasks");
const empty = document.getElementById("empty");

/**
 * Будує один рядок списку.
 * @param {{ id: string, text: string, done: boolean }} task
 * @returns {HTMLLIElement}
 */
function createTaskElement(task) {
  const item = document.createElement("li");
  item.className = task.done ? "task task--done" : "task";
  // dataset кладе значення в атрибут data-id — звідти його дістане обробник події.
  item.dataset.id = task.id;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task__checkbox";
  checkbox.checked = task.done;
  checkbox.id = `task-${task.id}`;

  const label = document.createElement("label");
  label.className = "task__text";
  // for + id зв'язують підпис із чекбоксом: клік по тексту теж перемикає справу.
  label.htmlFor = checkbox.id;

  /*
    ОСЬ ГОЛОВНЕ МІСЦЕ ЦЬОГО ФАЙЛА.

    textContent кладе рядок як ТЕКСТ. innerHTML поклав би його як РОЗМІТКУ —
    і справа з текстом <img src=x onerror=alert(1)> виконала б чужий код
    просто тому, що її хтось увів у поле.

    Правило без винятків: усе, що прийшло від користувача, — тільки textContent.
  */
  label.textContent = task.text;

  /*
    Хрестик видалення з макета. type="button" обов'язковий: кнопка без type
    усередині форми вважається submit — тут форми немає, але звичка ставити
    type рятує рівно тоді, коли розмітку колись перенесуть у форму.
  */
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "task__delete";
  remove.textContent = "✕";
  /*
    Сам символ ✕ читалка прочитала б як «хрестик» — і незрозуміло, що він
    видалить. aria-label каже це словами. Значення задаємо через setAttribute
    (тобто як текст), тож текст справи знову лишається текстом, не розміткою.
  */
  remove.setAttribute("aria-label", `Видалити справу: ${task.text}`);

  item.append(checkbox, label, remove);
  return item;
}

/** Показує поточний стан: перемальовує список і порожнє повідомлення. */
function render() {
  // Найпростіший спосіб перемалювати: стерти все й побудувати заново.
  list.replaceChildren(...tasks.map(createTaskElement));

  // Порожнє повідомлення видно рівно тоді, коли справ немає.
  empty.hidden = tasks.length > 0;
}

/* ==========================================================================
   ПІДПИСКА НА ПОДІЇ
   ========================================================================== */

/*
  submit, а не click по кнопці: так спрацює і кнопка, і Enter у полі.
  preventDefault зупиняє стандартну поведінку форми — перезавантаження сторінки.
*/
form.addEventListener("submit", (event) => {
  event.preventDefault();
  addTask(input.value);
  input.value = ""; // поле очищається після додавання
  input.focus(); // курсор лишається в полі — можна одразу писати наступну справу
});

/*
  Делегування подій: один обробник на <ul> замість обробника на кожен чекбокс.
  Обробники не треба перевішувати після кожного рендера, і застосунок
  однаково працює хоч із трьома справами, хоч із трьомастами.
*/
list.addEventListener("change", (event) => {
  // Нас цікавлять лише чекбокси, а не будь-яка зміна всередині списку.
  if (!event.target.matches(".task__checkbox")) return;

  // closest піднімається від чекбокса до його <li>, звідки беремо id справи.
  const id = event.target.closest(".task").dataset.id;
  toggleTask(id);

  /*
    render() побудував список наново, тож чекбокс, який щойно натиснули,
    більше не існує — а разом із ним зник і фокус. Для миші це непомітно,
    але той, хто йде Tab'ом, після Пробілу опинявся б на початку сторінки.
    Тому шукаємо новий чекбокс тієї самої справи й повертаємо фокус на нього.
  */
  document.getElementById(`task-${id}`).focus();
});

/*
  Кліки по хрестику — теж один обробник на весь <ul>.
  closest шукає кнопку від того, куди насправді влучив клік: символ ✕
  усередині кнопки теж є ціллю події, а видаляти має саме кнопка.
*/
list.addEventListener("click", (event) => {
  const button = event.target.closest(".task__delete");
  if (!button) return;

  const item = button.closest(".task");
  // Позицію запам'ятовуємо ДО видалення — після рендера цього <li> вже немає.
  const index = [...list.children].indexOf(item);

  deleteTask(item.dataset.id);

  /*
    Фокус зникає разом із видаленим рядком. Повертаємо його на хрестик
    справи, яка стала на це місце; якщо видалили останню — на попередню;
    якщо список спорожнів — у поле вводу.
  */
  const next = list.children[Math.min(index, list.children.length - 1)];
  const target = next?.querySelector(".task__delete") ?? input;
  target.focus();
});

// Перший рендер: показуємо те, що прочитали зі сховища при старті.
render();
