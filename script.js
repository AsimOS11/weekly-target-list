(function(){
  "use strict";

  var SESSIONS_KEY = "weeklyTarget.sessions";
  var THEME_KEY = "weeklyTarget.theme";

  // ---------- storage helpers ----------
  function loadSessions(){
    try{
      var raw = localStorage.getItem(SESSIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    }catch(e){ return []; }
  }
  function saveSessions(sessions){
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  }
  function uid(){
    if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  // ---------- date helpers ----------
  function parseLocalDate(str){
    var parts = str.split('-').map(Number);
    return new Date(parts[0], parts[1]-1, parts[2]);
  }
  function todayStr(){
    var d = new Date();
    var y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
    return y + '-' + m + '-' + day;
  }
  function formatDate(str, withYear){
    var d = parseLocalDate(str);
    return d.toLocaleDateString('en-US', withYear ? {month:'short', day:'numeric', year:'numeric'} : {month:'short', day:'numeric'});
  }
  function formatRange(start, end){
    var sameYear = parseLocalDate(start).getFullYear() === parseLocalDate(end).getFullYear();
    return formatDate(start, false) + ' \u2013 ' + formatDate(end, true);
  }
  function distanceDays(session){
    var t = todayStr();
    if(t >= session.start && t <= session.end) return 0;
    var tt = parseLocalDate(t).getTime();
    var s = parseLocalDate(session.start).getTime();
    var e = parseLocalDate(session.end).getTime();
    return Math.min(Math.abs(tt-s), Math.abs(tt-e));
  }
  function sessionProgress(session){
    var t = todayStr();
    var s = parseLocalDate(session.start).getTime();
    var e = parseLocalDate(session.end).getTime();
    var tt = parseLocalDate(t).getTime();
    var totalDays = Math.round((e-s)/86400000) + 1;
    if(tt < s){
      var daysAway = Math.round((s-tt)/86400000);
      return {percent:0, label: 'Starts in ' + daysAway + ' day' + (daysAway===1?'':'s')};
    }
    if(tt > e){
      return {percent:100, label:'Session ended'};
    }
    var dayIndex = Math.round((tt-s)/86400000) + 1;
    dayIndex = Math.min(Math.max(dayIndex,1), totalDays);
    return {percent: Math.round((dayIndex/totalDays)*100), label: 'Day ' + dayIndex + ' of ' + totalDays};
  }
  function currentTag(session){
    var t = todayStr();
    if(t >= session.start && t <= session.end) return 'Current session';
    if(t < session.start) return 'Upcoming session';
    return 'Most recent session';
  }

  // ---------- session/task mutations ----------
  function addSession(start, end, title){
    var sessions = loadSessions();
    var session = { id: uid(), start: start, end: end, title: (title || '').trim(), tasks: [] };
    sessions.push(session);
    saveSessions(sessions);
    return session;
  }
  function getSession(id){
    return loadSessions().find(function(s){ return s.id === id; });
  }
  function updateSession(updated){
    var sessions = loadSessions();
    var idx = sessions.findIndex(function(s){ return s.id === updated.id; });
    if(idx !== -1){ sessions[idx] = updated; saveSessions(sessions); }
  }
  function addTask(sessionId, text){
    var session = getSession(sessionId);
    if(!session) return;
    session.tasks.push({ id: uid(), text: text, done: false });
    updateSession(session);
  }
  function toggleTask(sessionId, taskId){
    var session = getSession(sessionId);
    if(!session) return;
    var task = session.tasks.find(function(t){ return t.id === taskId; });
    if(task){ task.done = !task.done; updateSession(session); }
  }
  function deleteTask(sessionId, taskId){
    var session = getSession(sessionId);
    if(!session) return;
    session.tasks = session.tasks.filter(function(t){ return t.id !== taskId; });
    updateSession(session);
  }
  function editTaskText(sessionId, taskId, newText){
    var session = getSession(sessionId);
    if(!session) return;
    var task = session.tasks.find(function(t){ return t.id === taskId; });
    if(task && newText.trim()){ task.text = newText.trim(); updateSession(session); }
  }
  function moveTask(sessionId, index, direction){
    var session = getSession(sessionId);
    if(!session) return;
    var newIndex = index + direction;
    if(newIndex < 0 || newIndex >= session.tasks.length) return;
    var tmp = session.tasks[index];
    session.tasks[index] = session.tasks[newIndex];
    session.tasks[newIndex] = tmp;
    updateSession(session);
  }
  function deleteSession(sessionId){
    var sessions = loadSessions().filter(function(s){ return s.id !== sessionId; });
    saveSessions(sessions);
  }

  // ---------- confirm modal ----------
  var confirmOverlay = document.getElementById('confirmModal');
  var confirmMessageEl = document.getElementById('modalMessage');
  var confirmYesBtn = document.getElementById('modalConfirm');
  var confirmNoBtn = document.getElementById('modalCancel');
  var pendingConfirmAction = null;

  function openConfirm(message, onYes){
    confirmMessageEl.textContent = message;
    pendingConfirmAction = onYes;
    confirmOverlay.hidden = false;
    requestAnimationFrame(function(){ confirmOverlay.classList.add('open'); });
  }
  function closeConfirm(){
    confirmOverlay.classList.remove('open');
    pendingConfirmAction = null;
    window.setTimeout(function(){
      if(!confirmOverlay.classList.contains('open')) confirmOverlay.hidden = true;
    }, 200);
  }
  confirmYesBtn.addEventListener('click', function(){
    var action = pendingConfirmAction;
    closeConfirm();
    if(action) action();
  });
  confirmNoBtn.addEventListener('click', closeConfirm);
  confirmOverlay.addEventListener('click', function(e){
    if(e.target === confirmOverlay) closeConfirm();
  });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && !confirmOverlay.hidden) closeConfirm();
  });

  // ---------- theme ----------
  function initTheme(){
    var saved = localStorage.getItem(THEME_KEY) || 'light';
    document.documentElement.setAttribute('data-theme', saved);
  }
  function toggleTheme(){
    var current = document.documentElement.getAttribute('data-theme');
    var next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
  }

  // ---------- routing ----------
  function goHome(){ location.hash = '#home'; }
  function goToWeek(id){ location.hash = '#week/' + id; }

  function showPage(pageId){
    document.querySelectorAll('.page').forEach(function(p){
      p.hidden = (p.id !== pageId);
      p.classList.remove('page-enter');
    });
    var el = document.getElementById(pageId);
    void el.offsetWidth;
    el.classList.add('page-enter');
  }

  function render(){
    var hash = location.hash || '#home';
    if(hash.indexOf('#week/') === 0){
      var id = hash.slice(6);
      var session = getSession(id);
      if(!session){ goHome(); return; }
      renderWeekPage(session);
      showPage('page-week');
    } else {
      renderHomePage();
      showPage('page-home');
    }
  }

  // ---------- render: home ----------
  function renderHomePage(){
    var sessions = loadSessions();
    var currentWrap = document.getElementById('currentSessionWrap');
    var otherWrap = document.getElementById('otherSessionsWrap');
    var emptyState = document.getElementById('emptyState');
    currentWrap.innerHTML = '';
    otherWrap.innerHTML = '';

    if(sessions.length === 0){
      emptyState.hidden = false;
      return;
    }
    emptyState.hidden = true;

    var sorted = sessions.slice().sort(function(a,b){ return distanceDays(a) - distanceDays(b); });
    var current = sorted[0];
    var rest = sorted.slice(1);

    // current session full card
    var prog = sessionProgress(current);
    var card = document.createElement('div');
    card.className = 'current-card';
    var doneCount = current.tasks.filter(function(t){return t.done;}).length;

    var taskListHtml = '';
    if(current.tasks.length === 0){
      taskListHtml = '<p class="mini-empty">No tasks added yet for this session.</p>';
    } else {
      taskListHtml = '<ul class="mini-task-list">' + current.tasks.map(function(t){
        return '<li class="mini-task-row">' +
          '<span class="mini-check ' + (t.done?'done':'') + '" data-task="' + t.id + '">' + (t.done ? '&#10003;' : '') + '</span>' +
          '<span class="mini-task-text ' + (t.done?'done':'') + '">' + escapeHtml(t.text) + '</span>' +
        '</li>';
      }).join('') + '</ul>';
    }

    var mainLabel = current.title ? escapeHtml(current.title) : formatRange(current.start, current.end);
    var subLabel = current.title ? formatRange(current.start, current.end) : '';

    card.innerHTML =
      '<div class="current-card-top">' +
        '<div>' +
          '<span class="current-tag">' + currentTag(current) + '</span>' +
          '<div class="current-range">' + mainLabel + '</div>' +
          (subLabel ? '<div class="current-range-sub">' + subLabel + '</div>' : '') +
        '</div>' +
        '<span class="chevron">&rsaquo;</span>' +
      '</div>' +
      '<div class="mini-progress-track"><div class="mini-progress-fill" style="width:' + prog.percent + '%"></div></div>' +
      '<span class="mini-progress-label">' + prog.label + (current.tasks.length ? (' &middot; ' + doneCount + '/' + current.tasks.length + ' done') : '') + '</span>' +
      taskListHtml;

    card.addEventListener('click', function(){ goToWeek(current.id); });
    card.querySelectorAll('.mini-check').forEach(function(el){
      el.addEventListener('click', function(e){
        e.stopPropagation();
        toggleTask(current.id, el.getAttribute('data-task'));
        renderHomePage();
      });
    });
    currentWrap.appendChild(card);

    // other sessions
    if(rest.length > 0){
      var label = document.createElement('p');
      label.className = 'section-label';
      label.textContent = 'Other sessions';
      otherWrap.appendChild(label);

      var list = document.createElement('div');
      list.className = 'other-sessions';
      rest.forEach(function(s){
        var done = s.tasks.filter(function(t){return t.done;}).length;
        var taskCountText = s.tasks.length + ' task' + (s.tasks.length===1?'':'s') + (s.tasks.length ? (' &middot; ' + done + ' done') : '');
        var mainLabel = s.title ? escapeHtml(s.title) : formatRange(s.start, s.end);
        var subLabel = s.title ? (formatRange(s.start, s.end) + ' &middot; ' + taskCountText) : taskCountText;
        var bar = document.createElement('div');
        bar.className = 'session-bar';
        bar.innerHTML =
          '<div>' +
            '<div class="session-bar-range">' + mainLabel + '</div>' +
            '<div class="session-bar-sub">' + subLabel + '</div>' +
          '</div>' +
          '<span class="chevron">&rsaquo;</span>';
        bar.addEventListener('click', function(){ goToWeek(s.id); });
        list.appendChild(bar);
      });
      otherWrap.appendChild(list);
    }
  }

  // ---------- render: week ----------
  function renderWeekPage(session){
    var titleEl = document.getElementById('weekTitle');
    var subEl = document.getElementById('weekSubrange');
    if(session.title){
      titleEl.textContent = session.title;
      subEl.textContent = formatRange(session.start, session.end);
      subEl.hidden = false;
    } else {
      titleEl.textContent = formatRange(session.start, session.end);
      subEl.hidden = true;
    }
    var prog = sessionProgress(session);
    document.getElementById('progressFill').style.width = prog.percent + '%';
    document.getElementById('progressLabel').textContent = prog.label;

    var total = session.tasks.length;
    var done = session.tasks.filter(function(t){ return t.done; }).length;
    var left = total - done;
    document.getElementById('statsRow').innerHTML =
      '<span class="stat"><strong>' + total + '</strong> task' + (total===1?'':'s') + '</span>' +
      '<span class="stat"><strong>' + done + '</strong> done</span>' +
      '<span class="stat"><strong>' + left + '</strong> left</span>';

    var priorityBox = document.getElementById('priorityBox');
    var priorityList = document.getElementById('priorityList');
    var taskList = document.getElementById('taskList');
    var emptyTasks = document.getElementById('emptyTasks');
    priorityList.innerHTML = '';
    taskList.innerHTML = '';

    if(total === 0){
      priorityBox.hidden = true;
      emptyTasks.hidden = false;
      return;
    }
    emptyTasks.hidden = true;

    var top = session.tasks.slice(0,3);
    var rest = session.tasks.slice(3);
    priorityBox.hidden = top.length === 0;

    top.forEach(function(task, i){
      priorityList.appendChild(buildTaskRow(session, task, i));
    });
    rest.forEach(function(task, i){
      taskList.appendChild(buildTaskRow(session, task, i + 3));
    });
  }

  function buildTaskRow(session, task, index){
    var li = document.createElement('li');
    li.className = 'task-row';

    var arrowStack = document.createElement('div');
    arrowStack.className = 'arrow-stack';
    var upBtn = document.createElement('button');
    upBtn.className = 'arrow-btn';
    upBtn.type = 'button';
    upBtn.innerHTML = '&#9650;';
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', function(){ moveTask(session.id, index, -1); renderWeekPage(getSession(session.id)); });
    var downBtn = document.createElement('button');
    downBtn.className = 'arrow-btn';
    downBtn.type = 'button';
    downBtn.innerHTML = '&#9660;';
    downBtn.disabled = index === session.tasks.length - 1;
    downBtn.addEventListener('click', function(){ moveTask(session.id, index, 1); renderWeekPage(getSession(session.id)); });
    arrowStack.appendChild(upBtn);
    arrowStack.appendChild(downBtn);

    var check = document.createElement('span');
    check.className = 'check-circle' + (task.done ? ' done' : '');
    check.innerHTML = task.done ? '&#10003;' : '';
    check.addEventListener('click', function(){ toggleTask(session.id, task.id); renderWeekPage(getSession(session.id)); });

    var text = document.createElement('span');
    text.className = 'task-text' + (task.done ? ' done' : '');
    text.textContent = task.text;

    var editBtn = document.createElement('button');
    editBtn.className = 'icon-btn edit';
    editBtn.type = 'button';
    editBtn.innerHTML = '&#9998;';
    editBtn.title = 'Edit task';
    editBtn.addEventListener('click', function(){
      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'task-edit-input';
      input.value = task.text;
      li.replaceChild(input, text);
      input.focus();
      input.select();
      function save(){
        editTaskText(session.id, task.id, input.value || task.text);
        renderWeekPage(getSession(session.id));
      }
      input.addEventListener('blur', save);
      input.addEventListener('keydown', function(e){
        if(e.key === 'Enter'){ e.preventDefault(); input.blur(); }
        if(e.key === 'Escape'){ e.preventDefault(); renderWeekPage(getSession(session.id)); }
      });
    });

    var deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-btn delete';
    deleteBtn.type = 'button';
    deleteBtn.innerHTML = '&#10005;';
    deleteBtn.title = 'Delete task';
    deleteBtn.addEventListener('click', function(){
      openConfirm('Delete this task? This can\'t be undone.', function(){
        deleteTask(session.id, task.id);
        renderWeekPage(getSession(session.id));
      });
    });

    li.appendChild(arrowStack);
    li.appendChild(check);
    li.appendChild(text);
    li.appendChild(editBtn);
    li.appendChild(deleteBtn);
    return li;
  }

  function escapeHtml(str){
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- events ----------
  document.getElementById('logoBtn').addEventListener('click', goHome);
  document.getElementById('backBtn').addEventListener('click', goHome);
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  document.getElementById('deleteSessionBtn').addEventListener('click', function(){
    var hash = location.hash;
    if(hash.indexOf('#week/') !== 0) return;
    var id = hash.slice(6);
    var session = getSession(id);
    if(!session) return;
    var label = session.title ? (session.title + ', ' + formatRange(session.start, session.end)) : formatRange(session.start, session.end);
    openConfirm('Delete this whole session (' + label + ') and all its tasks? This can\'t be undone.', function(){
      deleteSession(id);
      goHome();
    });
  });

  document.getElementById('sessionForm').addEventListener('submit', function(e){
    e.preventDefault();
    var start = document.getElementById('startDate').value;
    var end = document.getElementById('endDate').value;
    var title = document.getElementById('sessionTitle').value;
    var errorEl = document.getElementById('formError');
    errorEl.hidden = true;
    if(!start || !end){
      errorEl.textContent = 'Please choose both a start and end date.';
      errorEl.hidden = false;
      return;
    }
    if(end < start){
      errorEl.textContent = 'End date must be on or after the start date.';
      errorEl.hidden = false;
      return;
    }
    var session = addSession(start, end, title);
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('sessionTitle').value = '';
    goToWeek(session.id);
  });

  document.getElementById('taskForm').addEventListener('submit', function(e){
    e.preventDefault();
    var hash = location.hash;
    if(hash.indexOf('#week/') !== 0) return;
    var id = hash.slice(6);
    var input = document.getElementById('taskInput');
    var text = input.value.trim();
    if(!text) return;
    addTask(id, text);
    input.value = '';
    renderWeekPage(getSession(id));
  });

  window.addEventListener('hashchange', render);

  // ---------- init ----------
  initTheme();
  (function setDefaultDates(){
    var s = document.getElementById('startDate');
    var e = document.getElementById('endDate');
    var today = todayStr();
    var d = parseLocalDate(today);
    d.setDate(d.getDate() + 6);
    var y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
    s.value = today;
    e.value = y + '-' + m + '-' + day;
  })();
  if(!location.hash) location.hash = '#home';
  render();
})();
